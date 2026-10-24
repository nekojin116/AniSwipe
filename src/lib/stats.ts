import type { MediaType, StatsEntry } from "./anilist";
import { formatLabel, formatStatus } from "./format";

export interface Slice {
  key: string;
  label: string;
  value: number;
}

export interface Bucket {
  label: string;
  value: number;
}

export interface YearPoint {
  year: number;
  titles: number;
  /** Hours watched for anime; chapters read for manga. */
  amount: number;
  meanScore: number | null;
}

export interface StatsSummary {
  mediaType: MediaType;
  total: number;
  completed: number;
  meanScore: number | null;
  /** Anime only. */
  episodesWatched: number;
  daysWatched: number;
  daysPlanned: number;
  /** Manga only. */
  chaptersRead: number;
  volumesRead: number;
  formats: Slice[];
  statuses: Slice[];
  countries: Slice[];
  lengthTitle: string;
  lengthBuckets: Bucket[];
  yearPoints: YearPoint[];
}

interface BucketSpec {
  label: string;
  min: number;
  max: number;
}

const EPISODE_BUCKETS: BucketSpec[] = [
  { label: "1", min: 1, max: 1 },
  { label: "2–6", min: 2, max: 6 },
  { label: "7–16", min: 7, max: 16 },
  { label: "17–28", min: 17, max: 28 },
  { label: "29–100", min: 29, max: 100 },
  { label: "101+", min: 101, max: Number.POSITIVE_INFINITY },
];

const CHAPTER_BUCKETS: BucketSpec[] = [
  { label: "1–10", min: 1, max: 10 },
  { label: "11–50", min: 11, max: 50 },
  { label: "51–100", min: 51, max: 100 },
  { label: "101–250", min: 101, max: 250 },
  { label: "251–500", min: 251, max: 500 },
  { label: "501+", min: 501, max: Number.POSITIVE_INFINITY },
];

const STATUS_ORDER = [
  "COMPLETED",
  "CURRENT",
  "REPEATING",
  "PLANNING",
  "PAUSED",
  "DROPPED",
];

const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  TW: "Taiwan",
  HK: "Hong Kong",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  PL: "Poland",
  RU: "Russia",
  SE: "Sweden",
  FI: "Finland",
  TH: "Thailand",
  PH: "Philippines",
  ID: "Indonesia",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
};

const DEFAULT_EPISODE_MINUTES = 24;
const MAX_SLICES = 6;

/** AniList's `duration` is minutes per episode; fall back to a TV episode. */
function minutesPerEpisode(entry: StatsEntry): number {
  const duration = entry.media.duration;
  return duration && duration > 0 ? duration : DEFAULT_EPISODE_MINUTES;
}

/** Group the largest `max` keys and fold the rest into "Other". */
function toSlices(
  counts: Map<string, number>,
  label: (key: string) => string,
  max = MAX_SLICES,
): Slice[] {
  const sorted = [...counts.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const slices = sorted.slice(0, max).map(([key, value]) => ({
    key,
    label: label(key),
    value,
  }));
  const rest = sorted.slice(max).reduce((sum, [, value]) => sum + value, 0);
  if (rest > 0) slices.push({ key: "__other", label: "Other", value: rest });
  return slices;
}

/**
 * Aggregate a raw AniList list into the shape the stats page renders.
 *
 * Definitions follow AniList's own stats page where possible:
 * - total / format / country / status include every entry on the list;
 * - episode count and release year only consider completed titles;
 * - days planned covers the full runtime of planning entries;
 * - anime runtime uses `duration` (24 min fallback) per watched episode.
 */
export function computeStats(entries: StatsEntry[], mediaType: MediaType): StatsSummary {
  const isAnime = mediaType === "ANIME";
  const completed = entries.filter((entry) => entry.status === "COMPLETED");
  const scores = entries.map((entry) => entry.score).filter((score) => score > 0);

  let episodesWatched = 0;
  let minutesWatched = 0;
  let daysPlanned = 0;
  let chaptersRead = 0;
  let volumesRead = 0;

  const formatCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();

  for (const entry of entries) {
    const progress = Math.max(0, entry.progress ?? 0);
    const volumes = Math.max(0, entry.progressVolumes ?? 0);

    statusCounts.set(entry.status, (statusCounts.get(entry.status) ?? 0) + 1);
    const format = entry.media.format ?? "UNKNOWN";
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);
    const country = entry.media.countryOfOrigin ?? "UNKNOWN";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);

    if (isAnime) {
      episodesWatched += progress;
      minutesWatched += progress * minutesPerEpisode(entry);
      if (entry.status === "PLANNING") {
        daysPlanned +=
          ((entry.media.episodes ?? 0) * minutesPerEpisode(entry)) / (60 * 24);
      }
    } else {
      chaptersRead += progress;
      volumesRead += volumes;
    }
  }

  // Episode / chapter counts for completed titles (AniList's "Titles watched").
  const specs = isAnime ? EPISODE_BUCKETS : CHAPTER_BUCKETS;
  const lengthBuckets = specs.map((spec) => ({ label: spec.label, value: 0 }));
  for (const entry of completed) {
    const length =
      (isAnime ? entry.media.episodes : entry.media.chapters) ?? entry.progress ?? 0;
    const index = specs.findIndex((spec) => length >= spec.min && length <= spec.max);
    if (index >= 0) lengthBuckets[index].value += 1;
  }

  // Release-year series, grouped from completed titles. Empty years inside the
  // range are kept as zeroes so the line reads like a timeline.
  interface YearAcc {
    titles: number;
    minutes: number;
    chapters: number;
    scoreSum: number;
    scoreCount: number;
  }
  const byYear = new Map<number, YearAcc>();
  for (const entry of completed) {
    const year = entry.media.startDate?.year ?? entry.media.seasonYear ?? null;
    if (!year || year < 1900 || year > 2100) continue;
    let acc = byYear.get(year);
    if (!acc) {
      acc = { titles: 0, minutes: 0, chapters: 0, scoreSum: 0, scoreCount: 0 };
      byYear.set(year, acc);
    }
    acc.titles += 1;
    if (isAnime) {
      acc.minutes += Math.max(0, entry.progress ?? 0) * minutesPerEpisode(entry);
    } else {
      acc.chapters += Math.max(0, entry.progress ?? 0);
    }
    if (entry.score > 0) {
      acc.scoreSum += entry.score;
      acc.scoreCount += 1;
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const yearPoints: YearPoint[] = [];
  if (years.length > 0) {
    for (let year = years[0]; year <= years[years.length - 1]; year += 1) {
      const acc = byYear.get(year);
      yearPoints.push({
        year,
        titles: acc?.titles ?? 0,
        amount: isAnime ? (acc?.minutes ?? 0) / 60 : (acc?.chapters ?? 0),
        meanScore:
          acc && acc.scoreCount > 0 ? acc.scoreSum / acc.scoreCount : null,
      });
    }
  }

  return {
    mediaType,
    total: entries.length,
    completed: completed.length,
    meanScore:
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    episodesWatched,
    daysWatched: minutesWatched / (60 * 24),
    daysPlanned,
    chaptersRead,
    volumesRead,
    formats: toSlices(formatCounts, (key) =>
      key === "UNKNOWN" ? "Unknown" : formatLabel(key),
    ),
    statuses: STATUS_ORDER.map((status) => ({
      key: status,
      label: formatStatus(status, mediaType),
      value: statusCounts.get(status) ?? 0,
    })).filter((slice) => slice.value > 0),
    countries: toSlices(countryCounts, (key) =>
      key === "UNKNOWN" ? "Unknown" : (COUNTRY_NAMES[key] ?? key),
    ),
    lengthTitle: isAnime ? "Episode count" : "Chapter count",
    lengthBuckets,
    yearPoints,
  };
}
