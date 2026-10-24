import type { Anime, MediaType } from "./anilist";

export function displayTitle(anime: Anime): string {
  return anime.title.english || anime.title.romaji || anime.title.native || "Untitled";
}

export function secondaryTitle(anime: Anime): string | null {
  const primary = displayTitle(anime);
  const alt = anime.title.romaji && anime.title.romaji !== primary ? anime.title.romaji : null;
  return alt;
}

/** Print-origin terms: a KR "MANGA" is a manhwa, a CN one is a manhua. */
const MANGA_TERM: Record<string, string> = { JP: "Manga", KR: "Manhwa", CN: "Manhua" };
const REGION_FLAG: Record<string, string> = { JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳" };

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Novel",
  ONE_SHOT: "One-shot",
};

const PRINT_FORMATS = new Set(["MANGA", "NOVEL", "ONE_SHOT"]);

/** Human label for an AniList `MediaFormat` (falls back to the raw enum). */
export function formatLabel(format: string | null | undefined): string {
  if (!format) return "Unknown";
  return FORMAT_LABELS[format] ?? format;
}

export function metaLine(anime: Anime): string {
  const parts: string[] = [];
  if (anime.seasonYear) parts.push(String(anime.seasonYear));
  if (anime.format) {
    const country = anime.countryOfOrigin ?? "";
    let label = FORMAT_LABELS[anime.format] ?? anime.format;
    if (anime.format === "MANGA" && MANGA_TERM[country]) label = MANGA_TERM[country];
    // Flag the origin on print media (manga/manhwa/manhua); anime stays clean.
    parts.push(PRINT_FORMATS.has(anime.format) && REGION_FLAG[country] ? `${REGION_FLAG[country]} ${label}` : label);
  }
  if (anime.episodes) parts.push(`${anime.episodes} ep${anime.episodes > 1 ? "s" : ""}`);
  else if (anime.chapters) parts.push(`${anime.chapters} ch`);
  return parts.join("  •  ");
}

export function cleanDescription(anime: Anime): string {
  const raw = (anime.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return raw;
}

export function formatStatus(status: string, mediaType: MediaType = "ANIME"): string {
  const reading = mediaType === "MANGA";
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "CURRENT":
      return reading ? "Reading" : "Watching";
    case "PLANNING":
      return "Planned";
    case "PAUSED":
      return "Paused";
    case "DROPPED":
      return "Dropped";
    case "REPEATING":
      return reading ? "Rereading" : "Rewatching";
    default:
      return status;
  }
}
