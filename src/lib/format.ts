import type { Anime, MediaType } from "./anilist";

export function displayTitle(anime: Anime): string {
  return anime.title.english || anime.title.romaji || anime.title.native || "Untitled";
}

export function secondaryTitle(anime: Anime): string | null {
  const primary = displayTitle(anime);
  const alt = anime.title.romaji && anime.title.romaji !== primary ? anime.title.romaji : null;
  return alt;
}

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

export function metaLine(anime: Anime): string {
  const parts: string[] = [];
  if (anime.seasonYear) parts.push(String(anime.seasonYear));
  if (anime.format) parts.push(FORMAT_LABELS[anime.format] ?? anime.format);
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
