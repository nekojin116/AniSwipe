import { alFetch, AlError } from "./anilist-client";

export { AlError };

/* ---------------------------------- Types --------------------------------- */

export type MediaType = "ANIME" | "MANGA";

export interface Anime {
  id: number;
  title: { romaji: string; english?: string | null; native?: string | null };
  coverImage: { extraLarge: string; large: string; color?: string | null };
  episodes?: number | null;
  chapters?: number | null;
  format?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  genres: string[];
  description?: string | null;
  status: string;
  mediaListEntry?: { id: number; status: string } | null;
}

/** Bulk snapshot of a viewer's list: mediaId -> entry summary. */
export type ListedMap = Map<number, { id: number; status: string }>;

export interface Viewer {
  id: number;
  name: string;
  avatar?: { large?: string | null; medium?: string | null } | null;
}

export type DeckId = "popular" | "top" | "season" | "search";

export interface DeckDef {
  id: DeckId;
  label: string;
  hint: string;
  sort: string[];
  status?: string;
}

const ANIME_DECKS: DeckDef[] = [
  { id: "popular", label: "Popular", hint: "The most popular anime of all time", sort: ["POPULARITY_DESC"] },
  { id: "top", label: "Top rated", hint: "Highest scored anime of all time", sort: ["SCORE_DESC"] },
  {
    id: "season",
    label: "This season",
    hint: "Anime airing right now",
    sort: ["TRENDING_DESC"],
    status: "RELEASING",
  },
  { id: "search", label: "Search", hint: "Find a specific anime", sort: ["SEARCH_MATCH"] },
];

const MANGA_DECKS: DeckDef[] = [
  { id: "popular", label: "Popular", hint: "The most popular manga of all time", sort: ["POPULARITY_DESC"] },
  { id: "top", label: "Top rated", hint: "Highest scored manga of all time", sort: ["SCORE_DESC"] },
  {
    id: "season",
    label: "Ongoing",
    hint: "Manga serializing right now",
    sort: ["TRENDING_DESC"],
    status: "RELEASING",
  },
  { id: "search", label: "Search", hint: "Find a specific manga", sort: ["SEARCH_MATCH"] },
];

export function decksFor(mediaType: MediaType): DeckDef[] {
  return mediaType === "MANGA" ? MANGA_DECKS : ANIME_DECKS;
}

/* --------------------------------- Queries -------------------------------- */

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large color }
  episodes
  chapters
  format
  seasonYear
  averageScore
  genres
  description(asHtml: false)
  status
  mediaListEntry { id status }
`;

const VIEWER_QUERY = `
  query {
    Viewer { id name avatar { large } }
  }
`;

const DECK_QUERY = `
  query DeckPage($page: Int!, $perPage: Int!, $type: MediaType!, $sort: [MediaSort], $search: String, $status: MediaStatus) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(type: $type, sort: $sort, search: $search, status: $status, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const LISTED_QUERY = `
  query ListedEntries($userId: Int, $type: MediaType!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      mediaList(userId: $userId, type: $type) { id mediaId status }
    }
  }
`;

const SAVE_MUTATION = `
  mutation ($mediaId: Int, $status: MediaListStatus) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status) { id mediaId status }
  }
`;

const DELETE_MUTATION = `
  mutation ($id: Int) {
    DeleteMediaListEntry(id: $id) { deleted }
  }
`;

/* --------------------------------- Helpers -------------------------------- */

export async function fetchViewer(token: string): Promise<Viewer> {
  const data = await alFetch<{ Viewer: Viewer | null }>(VIEWER_QUERY, undefined, token);
  if (!data.Viewer) throw new AlError("Could not load your AniList profile.", 401);
  return data.Viewer;
}

/**
 * Fetch every list entry the viewer has for a media type in bulk.
 *
 * The deck query's per-card `mediaListEntry` field is the fast path, but this
 * snapshot is the authoritative filter: it is fetched once per session and
 * keeps hiding already-added titles even if `mediaListEntry` comes back null
 * (degraded API windows), and it lets us backfill "On your list" badges the
 * API missed.
 */
export async function fetchListedEntries(
  userId: number,
  mediaType: MediaType,
  token: string,
): Promise<ListedMap> {
  const map: ListedMap = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const data = await alFetch<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        mediaList: { id: number; mediaId: number; status: string }[];
      } | null;
    }>(LISTED_QUERY, { userId, type: mediaType, page, perPage: 500 }, token);

    for (const entry of data.Page?.mediaList ?? []) {
      map.set(entry.mediaId, { id: entry.id, status: entry.status });
    }
    if (!data.Page?.pageInfo?.hasNextPage) break;
  }
  return map;
}

export async function fetchDeckPage(opts: {
  deckId: DeckId;
  search: string;
  page: number;
  showAdded: boolean;
  token: string | null;
  mediaType: MediaType;
  listed?: ListedMap | null;
}): Promise<{ items: Anime[]; hasNextPage: boolean }> {
  const decks = decksFor(opts.mediaType);
  const def = decks.find((d) => d.id === opts.deckId) ?? decks[0];

  const variables: Record<string, unknown> = {
    page: opts.page,
    perPage: 40,
    type: opts.mediaType,
    sort: def.sort,
  };
  if (def.status) variables.status = def.status;
  if (opts.deckId === "search" && opts.search) variables.search = opts.search;

  const data = await alFetch<{
    Page: { pageInfo: { hasNextPage: boolean }; media: Anime[] } | null;
  }>(DECK_QUERY, variables, opts.token);

  const media = data.Page?.media ?? [];
  const items = media
    .map((m) => {
      // Trust the per-card entry first, but fall back to the bulk snapshot so
      // a null from the API can never leak an already-added title through.
      const listedEntry = opts.listed?.get(m.id) ?? null;
      const entry = m.mediaListEntry ?? listedEntry;
      return entry && entry !== m.mediaListEntry ? { ...m, mediaListEntry: entry } : m;
    })
    .filter(
      (m) =>
        m.status !== "NOT_YET_RELEASED" &&
        (opts.showAdded || !m.mediaListEntry),
    );

  return { items, hasNextPage: Boolean(data.Page?.pageInfo?.hasNextPage) && media.length > 0 };
}

export async function saveEntry(
  mediaId: number,
  status: "COMPLETED" | "PLANNING" | "CURRENT" | "PAUSED" | "DROPPED",
  token: string,
): Promise<{ id: number; status: string }> {
  const data = await alFetch<{
    SaveMediaListEntry: { id: number; status: string } | null;
  }>(SAVE_MUTATION, { mediaId, status }, token);
  if (!data.SaveMediaListEntry) throw new AlError("AniList didn't save that entry.");
  return data.SaveMediaListEntry;
}

export async function deleteEntry(entryId: number, token: string): Promise<void> {
  const data = await alFetch<{ DeleteMediaListEntry: { deleted: boolean } | null }>(
    DELETE_MUTATION,
    { id: entryId },
    token,
  );
  if (!data.DeleteMediaListEntry?.deleted) throw new AlError("Couldn't remove that list entry.");
}
