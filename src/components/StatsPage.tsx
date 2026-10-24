import { useState, type ReactNode } from "react";
import type { MediaType, Viewer } from "../lib/anilist";
import { useStats } from "../hooks/useStats";
import { BarChart, DistributionCard, YearChart, type YearMetric } from "./StatsCharts";
import {
  AlertIcon,
  BookIcon,
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  LibraryIcon,
  LockIcon,
  PlayCircleIcon,
  RefreshIcon,
  Spinner,
  StarIcon,
} from "./icons";

interface Props {
  token: string | null;
  viewer: Viewer | null;
  mediaType: MediaType;
  onLogin: () => void;
  onBrowse: () => void;
  onSessionExpired: () => void;
}

const NF = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const TONES = {
  rose: "bg-rose-500/10 text-rose-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
} as const;

type Tone = keyof typeof TONES;

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: Tone;
}) {
  return (
    <div className="glass rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${TONES[tone]}`}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
          {label}
        </span>
      </div>
      <p className="font-display mt-2 text-2xl font-bold tabular-nums tracking-tight text-stone-900">
        {value}
      </p>
    </div>
  );
}

export default function StatsPage({
  token,
  viewer,
  mediaType,
  onLogin,
  onBrowse,
  onSessionExpired,
}: Props) {
  const noun = mediaType === "MANGA" ? "manga" : "anime";
  const amountLabel = mediaType === "MANGA" ? "Chapters" : "Hours";
  const [metric, setMetric] = useState<YearMetric>("titles");

  const { summary, loading, error, updatedAt, refresh } = useStats({
    viewer,
    mediaType,
    token,
    enabled: Boolean(token && viewer),
    onSessionExpired,
  });

  const metrics: { id: YearMetric; label: string }[] = [
    { id: "titles", label: "Titles" },
    { id: "amount", label: amountLabel },
    { id: "score", label: "Mean score" },
  ];

  /* --------------------------------- guest --------------------------------- */

  if (!token || !viewer) {
    return (
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
        <div className="glass w-full max-w-md rounded-3xl px-8 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-600">
            <LockIcon className="h-6 w-6" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-stone-900">
            Your stats, live
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Sign in to chart your AniList history. AniSwipe pulls your list on
            demand — unlike AniList&apos;s stats, there&apos;s no 24-hour cache.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="brand-gradient mt-6 w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(225,29,72,0.6)] transition hover:scale-[1.02]"
          >
            Log in with AniList
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-3 text-xs font-medium text-stone-500 transition hover:text-stone-800"
          >
            Back to the deck
          </button>
        </div>
      </main>
    );
  }

  /* -------------------------------- content -------------------------------- */

  const iconClass = "h-4 w-4";
  const cards: { label: string; value: string; icon: ReactNode; tone: Tone }[] =
    summary && mediaType === "MANGA"
      ? [
          {
            label: "Total manga",
            value: NF.format(summary.total),
            icon: <LibraryIcon className={iconClass} />,
            tone: "rose",
          },
          {
            label: "Chapters read",
            value: NF.format(summary.chaptersRead),
            icon: <BookOpenIcon className={iconClass} />,
            tone: "amber",
          },
          {
            label: "Volumes read",
            value: NF.format(summary.volumesRead),
            icon: <BookIcon className={iconClass} />,
            tone: "sky",
          },
          {
            label: "Mean score",
            value: summary.meanScore == null ? "—" : NF1.format(summary.meanScore),
            icon: <StarIcon className={iconClass} />,
            tone: "violet",
          },
        ]
      : summary
        ? [
            {
              label: "Total anime",
              value: NF.format(summary.total),
              icon: <LibraryIcon className={iconClass} />,
              tone: "rose",
            },
            {
              label: "Episodes watched",
              value: NF.format(summary.episodesWatched),
              icon: <PlayCircleIcon className={iconClass} />,
              tone: "amber",
            },
            {
              label: "Days watched",
              value: NF1.format(summary.daysWatched),
              icon: <ClockIcon className={iconClass} />,
              tone: "sky",
            },
            {
              label: "Days planned",
              value: NF1.format(summary.daysPlanned),
              icon: <CalendarIcon className={iconClass} />,
              tone: "violet",
            },
          ]
        : [];

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-12 pt-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600">
            Live from AniList
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Your {noun} stats
          </h1>
          <p className="mt-1 max-w-lg text-sm text-stone-500">
            Pulled fresh every time — no 24-hour stats cache.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-900/5 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin-slow" : ""}`} />
          {loading ? (summary ? "Refreshing…" : "Loading…") : "Refresh"}
        </button>
      </header>

      {error && summary && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
          <AlertIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error.message}</span>
          <button
            type="button"
            onClick={refresh}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!summary ? (
        loading ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="glass h-[92px] animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="glass mt-4 flex h-56 flex-col items-center justify-center gap-3 rounded-2xl">
              <Spinner className="h-6 w-6 text-rose-500" />
              <p className="text-sm text-stone-500">Reading your {noun} list…</p>
              <p className="text-[11px] text-stone-400">One live request to AniList.</p>
            </div>
          </>
        ) : (
          <div className="glass mt-6 rounded-2xl px-6 py-10 text-center">
            <AlertIcon className="mx-auto h-7 w-7 text-rose-600" />
            <h2 className="font-display mt-3 text-lg font-semibold text-stone-900">
              Couldn&apos;t load your stats
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
              {error?.message ?? "AniList returned an empty response."}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="brand-gradient mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:scale-105"
            >
              Try again
            </button>
          </div>
        )
      ) : summary.total === 0 ? (
        <div className="glass mt-6 rounded-2xl px-6 py-10 text-center">
          <LibraryIcon className="mx-auto h-8 w-8 text-rose-500/70" />
          <h2 className="font-display mt-3 text-lg font-semibold text-stone-900">
            Nothing to chart yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
            Your {noun} list is empty. Swipe a few titles and come back — the
            snapshot is always fresh.
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="brand-gradient mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:scale-105"
          >
            Browse the deck
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <section className="glass mt-4 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold text-stone-900">
                  {summary.lengthTitle}
                </h2>
                <p className="text-[11px] text-stone-500">
                  Completed {noun} grouped by{" "}
                  {mediaType === "MANGA" ? "chapter" : "episode"} count.
                </p>
              </div>
              <span className="rounded-full bg-stone-900/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                {summary.completed} titles
              </span>
            </div>
            <BarChart data={summary.lengthBuckets} label={summary.lengthTitle} />
          </section>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <DistributionCard
              title="Format distribution"
              data={summary.formats}
              emptyLabel="No formats to chart yet."
            />
            <DistributionCard
              title="Status distribution"
              data={summary.statuses}
              emptyLabel="No statuses to chart yet."
            />
            <DistributionCard
              title="Country distribution"
              data={summary.countries}
              emptyLabel="No countries to chart yet."
            />
          </div>

          <section className="glass mt-4 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-stone-900">
                  Release year
                </h2>
                <p className="text-[11px] text-stone-500">
                  Completed {noun} by release year.
                </p>
              </div>
              <div className="glass flex items-center rounded-full p-0.5">
                {metrics.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={metric === item.id}
                    onClick={() => setMetric(item.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      metric === item.id
                        ? "bg-rose-600 text-white shadow-[0_4px_12px_-4px_rgba(225,29,72,0.6)]"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <YearChart
              points={summary.yearPoints}
              metric={metric}
              amountLabel={amountLabel}
            />
          </section>

          <p className="mt-5 text-center text-[11px] text-stone-400">
            {NF.format(summary.total)} {noun} on your list
            {updatedAt
              ? ` · pulled ${new Date(updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        </>
      )}
    </main>
  );
}
