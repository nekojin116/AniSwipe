import { alFetch, AlError } from "./anilist-client";

export { AlError };

/* ---------------------------------- Types --------------------------------- */

export type MediaType = "ANIME" | "MANGA";

/** Country-of-origin filter for the manga section (manga / manhwa / manhua). */
export type RegionCode = "JP" | "KR" | "CN";
export type Region = "ALL" | RegionCode;

export interface RegionDef {
  id: Region;
  /** Chip label. */
  label: string;
  /** Lowercase noun used in hints and placeholders: manga / manhwa / manhua. */
  term: string;
  /** Example title for the search placeholder of this origin. */
  example: string;
}

export const MANGA_REGIONS: RegionDef[] = [
  { id: "ALL", label: "All", term: "manga", example: "Berserk" },
  { id: "JP", label: "🇯🇵 Manga", term: "manga", example: "Berserk" },
  { id: "KR", label: "🇰🇷 Manhwa", term: "manhwa", example: "Solo Leveling" },
  { id: "CN", label: "🇨🇳 Manhua", term: "manhua", example: "Tian Guan Ci Fu" },
];

export function regionDef(region: Region): RegionDef {
  return MANGA_REGIONS.find((r) => r.id === region) ?? MANGA_REGIONS[0];
}

/**
 * Browseable categories (AniList's `GenreCollection`, display form). Hentai is
 * intentionally omitted — `isAdult: false` already excludes it from results.
 */
export const GENRES: string[] = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

export interface Anime {
  id: number;
  title: { romaji: string; english?: string | null; native?: string | null };
  coverImage: { extraLarge: string; large: string; color?: string | null };
  episodes?: number | null;
  chapters?: number | null;
  format?: string | null;
  countryOfOrigin?: string | null;
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

/**
 * Ordering for the search deck's category browse. Text queries always stay
 * relevance-sorted; this only applies while browsing by genre with no query.
 */
export type BrowseSort = "popular" | "newest" | "random";

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

/** Region-aware manga decks: hints use the right term (manga/manhwa/manhua). */
export function decksFor(mediaType: MediaType, region: Region = "ALL"): DeckDef[] {
  if (mediaType !== "MANGA") return ANIME_DECKS;
  const { term } = regionDef(region);
  const cap = term[0].toUpperCase() + term.slice(1);
  return [
    { id: "popular", label: "Popular", hint: `The most popular ${term} of all time`, sort: ["POPULARITY_DESC"] },
    { id: "top", label: "Top rated", hint: `Highest scored ${term} of all time`, sort: ["SCORE_DESC"] },
    {
      id: "season",
      label: "Ongoing",
      hint: `${cap} serializing right now`,
      sort: ["TRENDING_DESC"],
      status: "RELEASING",
    },
    { id: "search", label: "Search", hint: `Find a specific ${term}`, sort: ["SEARCH_MATCH"] },
  ];
}

/* --------------------------------- Queries -------------------------------- */

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large color }
  episodes
  chapters
  format
  countryOfOrigin
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
  query DeckPage($page: Int!, $perPage: Int!, $type: MediaType!, $sort: [MediaSort], $search: String, $status: MediaStatus, $statusIn: [MediaStatus], $country: CountryCode, $genre: [String]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage total }
      media(type: $type, countryOfOrigin: $country, genre_in: $genre, sort: $sort, search: $search, status: $status, status_in: $statusIn, isAdult: false) {
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

/** Fisher–Yates shuffle (returns a new array, leaves the input untouched). */
function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function fetchDeckPage(opts: {
  deckId: DeckId;
  search: string;
  page: number;
  showAdded: boolean;
  token: string | null;
  mediaType: MediaType;
  region?: Region;
  /** Search-deck genre filter (AND semantics via genre_in); other decks ignore it. */
  genres?: string[];
  /**
   * Order for a category browse (search deck, no text query). "random" keeps
   * the randomized-page behavior; "popular"/"newest" page through AniList's
   * ordered results from the top so well-known releases come first.
   */
  sortBy?: BrowseSort;
  listed?: ListedMap | null;
}): Promise<{ items: Anime[]; hasNextPage: boolean }> {
  const region = opts.region ?? "ALL";
  const decks = decksFor(opts.mediaType, region);
  const def = decks.find((d) => d.id === opts.deckId) ?? decks[0];
  const genres = opts.genres ?? [];

  // Category browsing (search deck, no text query) can be ordered explicitly.
  // Text queries stay relevance-sorted; other decks keep their own sort.
  const categoryBrowse = opts.deckId === "search" && !opts.search;
  const sortBy = opts.sortBy ?? "random";
  const random = categoryBrowse && sortBy === "random";

  // AniList has no random sort, so for a randomized browse we jump to a
  // genuinely random page (bounded by `total`, which AniList caps at 5000)
  // and shuffle client-side. Page 1 stays ordered so the first load still
  // surfaces recognizable hits.
  const PER_PAGE = 40;
  let requestedPage = opts.page;
  if (random && opts.page > 1) {
    // Over-fetch a little so the shuffle has more than one page's worth to
    // mix; the bound keeps us inside AniList's 5000-result window.
    const maxPage = Math.max(1, Math.min(Math.ceil(5000 / PER_PAGE), 125));
    requestedPage = 1 + Math.floor(Math.random() * maxPage);
  }

  let sort = def.sort;
  if (categoryBrowse && sortBy === "popular") sort = ["POPULARITY_DESC"];
  else if (categoryBrowse && sortBy === "newest") sort = ["START_DATE_DESC"];

  const variables: Record<string, unknown> = {
    page: requestedPage,
    perPage: PER_PAGE,
    type: opts.mediaType,
    sort,
  };
  if (def.status) variables.status = def.status;
  // "Newest" must exclude unreleased and cancelled titles at the API level:
  // START_DATE_DESC orders future announcements first, and page 1 can be 40/40
  // upcoming — the client-side filter would discard them all and the deck would
  // silently page through several empty responses before showing a card.
  // Cancelled entries also sort first because their start date is null.
  if (categoryBrowse && sortBy === "newest") {
    variables.statusIn = ["FINISHED", "RELEASING", "HIATUS"];
  }
  if (opts.deckId === "search" && opts.search) variables.search = opts.search;
  // Manga/manhwa/manhua origin filter. AniList treats an explicit null as
  // "match nothing", so the variable must be omitted entirely for "All".
  if (opts.mediaType === "MANGA" && region !== "ALL") variables.country = region;
  // Genre filter (AND) belongs to the search deck's category browse. The
  // selection persists while the user visits other decks, but must not narrow
  // Popular/Top rated/Ongoing. Only send when non-empty — an empty list would
  // be a no-op but wastes bytes and risks odd API behavior.
  if (opts.deckId === "search" && genres.length > 0) variables.genre = genres;

  const data = await alFetch<{
    Page: {
      pageInfo: { hasNextPage: boolean; total?: number };
      media: Anime[];
    } | null;
  }>(DECK_QUERY, variables, opts.token);

  let media = data.Page?.media ?? [];

  // Shuffle so a random page doesn't just replay AniList's popularity order.
  if (random && opts.page > 1) {
    media = shuffle(media);
  }

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
