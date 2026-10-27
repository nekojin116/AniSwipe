import type { Database } from "sql.js";
import { readZip } from "./zip";
import {
  decodeMessage,
  protoId,
  protoMessages,
  protoNumber,
  protoString,
  type ProtoMessage,
} from "./protobuf";

/**
 * Reads manga-reader backups entirely on-device:
 * - Tachimanga (`.tmb`): ZIP -> contents.zip -> tachimanga.db (SQLite).
 * - Tachiyomi / Mihon and forks (`.tachibk`, `.proto.gz`): gzipped protobuf.
 */

export type BackupFormat = "Tachimanga" | "Tachiyomi";

export interface BackupManga {
  /** Stable within one backup. */
  key: string;
  title: string;
  /** Extension/source name when the backup records it. */
  source: string | null;
  /** Tachiyomi publication status (SManga): 2 completed, 4 publishing finished, … */
  publication: number;
  chapterCount: number;
  readCount: number;
  /** Highest chapter number marked read, floored (AniList progress is whole chapters). */
  progress: number;
  /** Every known chapter is read (scanlator duplicates of read numbers count as read). */
  allRead: boolean;
  /** Ids from the backup's tracker links — exact matches, no title search needed. */
  anilistId: number | null;
  malId: number | null;
}

export interface ParsedBackup {
  format: BackupFormat;
  manga: BackupManga[];
}

interface ChapterLite {
  number: number;
  read: boolean;
}

/** Tachiyomi's tracker ids. */
const SYNC_MAL = 1;
const SYNC_ANILIST = 2;

const PUBLICATION_COMPLETED = 2;
const PUBLICATION_FINISHED = 4;
const PUBLICATION_CANCELLED = 5;

/** Whether the source says no more chapters are coming. */
export function isPublicationOver(publication: number): boolean {
  return (
    publication === PUBLICATION_COMPLETED ||
    publication === PUBLICATION_FINISHED ||
    publication === PUBLICATION_CANCELLED
  );
}

function summarizeChapters(chapters: ChapterLite[]) {
  let readCount = 0;
  let highestRead = -1;
  for (const chapter of chapters) {
    if (!chapter.read) continue;
    readCount += 1;
    if (chapter.number > highestRead) highestRead = chapter.number;
  }
  // Unnumbered chapters (-1) can't give a position; fall back to the count.
  const progress = highestRead > 0 ? Math.floor(highestRead) : highestRead < 0 ? readCount : 0;
  const allRead =
    chapters.length > 0 &&
    chapters.every((c) => c.read || (c.number >= 0 && c.number <= highestRead));
  return { chapterCount: chapters.length, readCount, progress, allRead };
}

function trackerIds(
  tracks: { syncId: number; remoteId: number; url: string | null }[],
): { anilistId: number | null; malId: number | null } {
  let anilistId: number | null = null;
  let malId: number | null = null;
  for (const track of tracks) {
    const url = track.url ?? "";
    const fromUrl = (host: string) => {
      const match = new RegExp(`${host}/manga/(\\d+)`).exec(url);
      return match ? Number(match[1]) : null;
    };
    const anilist =
      fromUrl("anilist\\.co") ?? (track.syncId === SYNC_ANILIST && track.remoteId > 0 ? track.remoteId : null);
    const mal =
      fromUrl("myanimelist\\.net") ?? (track.syncId === SYNC_MAL && track.remoteId > 0 ? track.remoteId : null);
    anilistId ??= anilist;
    malId ??= mal;
  }
  return { anilistId, malId };
}

/* -------------------------------- Tachimanga ------------------------------- */

async function openSqlite(bytes: Uint8Array): Promise<Database> {
  // sql.js (~1 MB of wasm) only loads when someone actually imports a backup.
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import("sql.js"),
    import("sql.js/dist/sql-wasm.wasm?url"),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  return new SQL.Database(bytes);
}

function rows(db: Database, sql: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const result of db.exec(sql)) {
    for (const values of result.values) {
      const row: Record<string, unknown> = {};
      result.columns.forEach((column, index) => {
        row[column] = values[index];
      });
      out.push(row);
    }
  }
  return out;
}

function tableExists(db: Database, name: string): boolean {
  return rows(db, `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = '${name}'`).length > 0;
}

async function parseTachimanga(blob: Blob): Promise<BackupManga[]> {
  const outer = await readZip(blob);
  const contents = outer.get("contents.zip");
  if (!contents) throw new Error("This .tmb file has no contents.zip — is it a Tachimanga backup?");
  const inner = await readZip(new Blob([await contents.read()]));
  const dbEntry = inner.get("tachimanga.db");
  if (!dbEntry) throw new Error("The Tachimanga backup has no library database.");

  const db = await openSqlite(await dbEntry.read());
  try {
    const hasSource = tableExists(db, "Source");
    const library = rows(
      db,
      hasSource
        ? `SELECT m.id, m.title, m.status, s.name AS source
             FROM Manga m LEFT JOIN Source s ON s.id = m.source
            WHERE m.in_library = 1`
        : "SELECT id, title, status, NULL AS source FROM Manga WHERE in_library = 1",
    );

    const chapters = new Map<number, ChapterLite[]>();
    for (const row of rows(
      db,
      `SELECT manga, chapter_number, read FROM Chapter
        WHERE manga IN (SELECT id FROM Manga WHERE in_library = 1)`,
    )) {
      const id = Number(row.manga);
      const list = chapters.get(id) ?? [];
      list.push({ number: Number(row.chapter_number), read: Number(row.read) === 1 });
      chapters.set(id, list);
    }

    const tracks = new Map<number, { syncId: number; remoteId: number; url: string | null }[]>();
    if (tableExists(db, "TrackRecord")) {
      for (const row of rows(db, "SELECT * FROM TrackRecord")) {
        if (Number(row.is_delete ?? 0) === 1) continue;
        const id = Number(row.manga_id);
        const list = tracks.get(id) ?? [];
        list.push({
          syncId: Number(row.sync_id),
          remoteId: Number(row.remote_id),
          url: typeof row.remote_url === "string" ? row.remote_url : null,
        });
        tracks.set(id, list);
      }
    }

    return library.map((row) => {
      const id = Number(row.id);
      return {
        key: `tm:${id}`,
        title: String(row.title ?? "").trim(),
        source: typeof row.source === "string" ? row.source : null,
        publication: Number(row.status ?? 0),
        ...summarizeChapters(chapters.get(id) ?? []),
        ...trackerIds(tracks.get(id) ?? []),
      };
    });
  } finally {
    db.close();
  }
}

/* ------------------------------ Tachiyomi/Mihon ---------------------------- */

// Field numbers from Mihon's backup models (Backup / BackupManga / BackupChapter /
// BackupTracking / BackupSource), shared by Tachiyomi and its forks.
const BACKUP = { manga: 1, sources: 101 };
const MANGA = {
  source: 1,
  url: 2,
  title: 3,
  status: 8,
  chapters: 16,
  tracking: 18,
  favorite: 100,
};
const CHAPTER = { read: 4, number: 9 };
const TRACK = { syncId: 1, mediaIdInt: 3, url: 4, mediaId: 100 };
const SOURCE = { name: 1, id: 2 };

async function gunzip(blob: Blob): Promise<Uint8Array> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseTachiyomi(bytes: Uint8Array): BackupManga[] {
  const backup = decodeMessage(bytes);

  const sourceNames = new Map<string, string>();
  for (const source of protoMessages(backup, BACKUP.sources)) {
    const id = protoId(source, SOURCE.id);
    const name = protoString(source, SOURCE.name);
    if (id && name) sourceNames.set(id, name);
  }

  const manga: BackupManga[] = [];
  protoMessages(backup, BACKUP.manga).forEach((entry: ProtoMessage, index) => {
    // `favorite` defaults to true and is omitted from the wire when it is.
    if (protoNumber(entry, MANGA.favorite) === 0) return;
    const sourceId = protoId(entry, MANGA.source) ?? "0";
    const chapters = protoMessages(entry, MANGA.chapters).map((chapter) => ({
      number: protoNumber(chapter, CHAPTER.number) ?? -1,
      read: protoNumber(chapter, CHAPTER.read) === 1,
    }));
    const tracks = protoMessages(entry, MANGA.tracking).map((track) => ({
      syncId: protoNumber(track, TRACK.syncId) ?? 0,
      remoteId: protoNumber(track, TRACK.mediaId) ?? protoNumber(track, TRACK.mediaIdInt) ?? 0,
      url: protoString(track, TRACK.url),
    }));
    manga.push({
      key: `tb:${index}:${sourceId}:${protoString(entry, MANGA.url) ?? ""}`,
      title: (protoString(entry, MANGA.title) ?? "").trim(),
      source: sourceNames.get(sourceId) ?? null,
      publication: protoNumber(entry, MANGA.status) ?? 0,
      ...summarizeChapters(chapters),
      ...trackerIds(tracks),
    });
  });
  return manga;
}

/* ---------------------------------- Entry ---------------------------------- */

export async function parseBackup(file: Blob): Promise<ParsedBackup> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  let result: ParsedBackup;

  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    result = { format: "Tachimanga", manga: await parseTachimanga(file) };
  } else {
    const bytes =
      head[0] === 0x1f && head[1] === 0x8b
        ? await gunzip(file)
        : new Uint8Array(await file.arrayBuffer());
    let manga: BackupManga[];
    try {
      manga = parseTachiyomi(bytes);
    } catch {
      throw new Error("Couldn't read that file — pick a Tachimanga (.tmb) or Tachiyomi/Mihon (.tachibk) backup.");
    }
    result = { format: "Tachiyomi", manga };
  }

  result.manga = result.manga.filter((m) => m.title.length > 0);
  if (result.manga.length === 0) {
    throw new Error("No library manga found in that backup.");
  }
  return result;
}
