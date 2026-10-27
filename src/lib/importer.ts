import { alFetch, AlError } from "./anilist-client";
import { isPublicationOver, type BackupManga } from "./backup";

/**
 * AniList side of the backup import: match backup titles to AniList media,
 * then write list entries. Everything is batched with GraphQL aliases so a
 * 400-title library costs a few dozen requests, and paced to stay inside
 * AniList's rate limit (30 req/min while degraded).
 */

export type ImportStatus = "CURRENT" | "COMPLETED" | "PLANNING" | "PAUSED" | "DROPPED";

export interface MatchMedia {
  id: number;
  idMal?: number | null;
  title: { romaji: string; english?: string | null; native?: string | null };
  synonyms?: string[] | null;
  chapters?: number | null;
  status?: string | null;
  format?: string | null;
  coverImage: { medium?: string | null };
  mediaListEntry?: { id: number; status: string; progress?: number | null } | null;
}

export interface MatchResult {
  media: MatchMedia | null;
  via: "tracker" | "search" | null;
  /** 0–1 title similarity; 1 for tracker links and exact title matches. */
  confidence: number;
}

const MATCH_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  chapters
  status
  format
  coverImage { medium }
  mediaListEntry { id status progress }
`;

/** Gap between requests; AniList allows 30–90/min depending on load. */
const REQUEST_GAP_MS = 2100;
const SEARCH_BATCH = 10;
const SAVE_BATCH = 10;
const ID_BATCH = 50;

export interface RunControl {
  cancelled: () => boolean;
  onProgress: (done: number, total: number) => void;
  /** Called while waiting out a 429, with the seconds remaining. */
  onWait?: (seconds: number) => void;
}

export class ImportCancelled extends Error {
  constructor() {
    super("Import cancelled.");
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * One paced AniList request. 429s wait out Retry-After and retry; anything
 * else propagates. The gap is enforced across calls via `lastAt`.
 */
function createPacer(control: RunControl) {
  let lastAt = 0;
  return async function paced<T>(query: string, variables: Record<string, unknown>, token: string) {
    for (;;) {
      if (control.cancelled()) throw new ImportCancelled();
      const wait = lastAt + REQUEST_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastAt = Date.now();
      try {
        return await alFetch<T>(query, variables, token);
      } catch (err) {
        if (!(err instanceof AlError) || err.status !== 429) throw err;
        for (let left = (err.retryAfter ?? 60) + 1; left > 0; left -= 1) {
          if (control.cancelled()) throw new ImportCancelled();
          control.onWait?.(left);
          await sleep(1000);
        }
        control.onWait?.(0);
      }
    }
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* ------------------------------ title matching ----------------------------- */

export function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function bigrams(value: string): Map<string, number> {
  const grams = new Map<string, number>();
  const compact = value.replace(/ /g, "");
  for (let i = 0; i < compact.length - 1; i += 1) {
    const gram = compact.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice similarity over character bigrams of normalized titles. */
function similarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let overlap = 0;
  let total = 0;
  for (const count of ga.values()) total += count;
  for (const count of gb.values()) total += count;
  for (const [gram, count] of ga) overlap += Math.min(count, gb.get(gram) ?? 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

function titleScore(title: string, media: MatchMedia): number {
  const candidates = [
    media.title.romaji,
    media.title.english,
    media.title.native,
    ...(media.synonyms ?? []),
  ].filter((t): t is string => Boolean(t));
  return Math.max(0, ...candidates.map((candidate) => similarity(title, candidate)));
}

/**
 * Resolve every backup title to AniList media: tracker links first (exact),
 * then batched title searches for the rest.
 */
export async function matchBackup(
  manga: BackupManga[],
  token: string,
  control: RunControl,
): Promise<Map<string, MatchResult>> {
  const paced = createPacer(control);
  const results = new Map<string, MatchResult>();
  const total = manga.length;
  const report = () => control.onProgress(results.size, total);

  // Tracker links: look up AniList and MAL ids in bulk. A link that no longer
  // resolves falls through to the title search below.
  const lookup = async (field: "id_in" | "idMal_in", ids: number[]) => {
    const found = new Map<number, MatchMedia>();
    for (const batch of chunk([...new Set(ids)], ID_BATCH)) {
      const data = await paced<{ Page: { media: MatchMedia[] } | null }>(
        `query ($ids: [Int]) { Page(perPage: ${ID_BATCH}) { media(${field}: $ids, type: MANGA) { ${MATCH_FIELDS} } } }`,
        { ids: batch },
        token,
      );
      for (const media of data.Page?.media ?? []) {
        found.set(field === "id_in" ? media.id : (media.idMal ?? -1), media);
      }
    }
    return found;
  };

  const byAnilist = manga.filter((m) => m.anilistId);
  const anilistHits = byAnilist.length ? await lookup("id_in", byAnilist.map((m) => m.anilistId!)) : null;
  for (const m of byAnilist) {
    const media = anilistHits?.get(m.anilistId!);
    if (media) results.set(m.key, { media, via: "tracker", confidence: 1 });
  }

  const byMal = manga.filter((m) => !results.has(m.key) && m.malId);
  const malHits = byMal.length ? await lookup("idMal_in", byMal.map((m) => m.malId!)) : null;
  for (const m of byMal) {
    const media = malHits?.get(m.malId!);
    if (media) results.set(m.key, { media, via: "tracker", confidence: 1 });
  }
  report();

  // Everything else: aliased title searches, a few candidates each, keeping
  // whichever candidate's titles best match the backup title.
  const remaining = manga.filter((m) => !results.has(m.key));
  for (const batch of chunk(remaining, SEARCH_BATCH)) {
    const vars = batch.map((_, i) => `$q${i}: String`).join(", ");
    const fields = batch
      .map(
        (_, i) =>
          `s${i}: Page(perPage: 3) { media(search: $q${i}, type: MANGA, sort: SEARCH_MATCH) { ${MATCH_FIELDS} } }`,
      )
      .join("\n");
    const variables: Record<string, unknown> = {};
    batch.forEach((m, i) => {
      variables[`q${i}`] = m.title;
    });

    const data = await paced<Record<string, { media: MatchMedia[] } | null>>(
      `query (${vars}) { ${fields} }`,
      variables,
      token,
    );

    batch.forEach((m, i) => {
      let best: MatchResult = { media: null, via: null, confidence: 0 };
      for (const media of data[`s${i}`]?.media ?? []) {
        const score = titleScore(m.title, media);
        if (score > best.confidence) best = { media, via: "search", confidence: score };
      }
      results.set(m.key, best);
    });
    report();
  }

  return results;
}

/* -------------------------------- proposals -------------------------------- */

/** Below this, a search match is shown but left unticked for the user to check. */
export const CONFIDENT_MATCH = 0.75;

export function proposeStatus(backup: BackupManga, media: MatchMedia | null): ImportStatus {
  if (backup.readCount === 0) return "PLANNING";
  const total = media?.chapters ?? null;
  if (total && backup.progress >= total) return "COMPLETED";
  if (backup.allRead && (isPublicationOver(backup.publication) || media?.status === "FINISHED")) {
    return "COMPLETED";
  }
  return "CURRENT";
}

/** AniList rejects progress beyond the chapter count; completed means all of it. */
export function clampProgress(progress: number, status: ImportStatus, media: MatchMedia): number {
  const total = media.chapters ?? null;
  if (status === "PLANNING") return 0;
  if (total && (status === "COMPLETED" || progress > total)) return total;
  return Math.max(0, progress);
}

/* ---------------------------------- saving --------------------------------- */

export interface SaveRequest {
  key: string;
  mediaId: number;
  status: ImportStatus;
  progress: number;
}

export interface SaveOutcome {
  key: string;
  mediaId: number;
  entry: { id: number; status: string } | null;
  error: string | null;
}

/**
 * Write list entries in aliased batches. If a batch errors (one bad entry
 * fails the whole mutation) its entries are retried one by one so a single
 * failure doesn't sink the other nine.
 */
export async function saveImports(
  requests: SaveRequest[],
  token: string,
  control: RunControl,
  onSaved: (outcomes: SaveOutcome[]) => void,
): Promise<void> {
  const paced = createPacer(control);
  let done = 0;

  const run = async (batch: SaveRequest[]) => {
    const vars = batch
      .map((_, i) => `$m${i}: Int, $s${i}: MediaListStatus, $p${i}: Int`)
      .join(", ");
    const fields = batch
      .map(
        (_, i) =>
          `e${i}: SaveMediaListEntry(mediaId: $m${i}, status: $s${i}, progress: $p${i}) { id status }`,
      )
      .join("\n");
    const variables: Record<string, unknown> = {};
    batch.forEach((req, i) => {
      variables[`m${i}`] = req.mediaId;
      variables[`s${i}`] = req.status;
      variables[`p${i}`] = req.progress;
    });
    return paced<Record<string, { id: number; status: string } | null>>(
      `mutation (${vars}) { ${fields} }`,
      variables,
      token,
    );
  };

  for (const batch of chunk(requests, SAVE_BATCH)) {
    let outcomes: SaveOutcome[];
    try {
      const data = await run(batch);
      outcomes = batch.map((req, i) => ({
        key: req.key,
        mediaId: req.mediaId,
        entry: data[`e${i}`] ?? null,
        error: data[`e${i}`] ? null : "AniList didn't save this entry.",
      }));
    } catch (err) {
      if (err instanceof ImportCancelled || (err instanceof AlError && err.status === 401)) throw err;
      if (batch.length === 1) {
        outcomes = [
          {
            key: batch[0].key,
            mediaId: batch[0].mediaId,
            entry: null,
            error: err instanceof Error ? err.message : String(err),
          },
        ];
      } else {
        outcomes = [];
        for (const req of batch) {
          try {
            const data = await run([req]);
            outcomes.push({
              key: req.key,
              mediaId: req.mediaId,
              entry: data.e0 ?? null,
              error: data.e0 ? null : "AniList didn't save this entry.",
            });
          } catch (single) {
            if (single instanceof ImportCancelled || (single instanceof AlError && single.status === 401)) {
              throw single;
            }
            outcomes.push({
              key: req.key,
              mediaId: req.mediaId,
              entry: null,
              error: single instanceof Error ? single.message : String(single),
            });
          }
        }
      }
    }
    done += batch.length;
    onSaved(outcomes);
    control.onProgress(done, requests.length);
  }
}
