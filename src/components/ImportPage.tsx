import { useMemo, useState, type DragEvent } from "react";
import type { ListedMap, Viewer } from "../lib/anilist";
import { CONFIDENT_MATCH, type ImportStatus } from "../lib/importer";
import { formatStatus } from "../lib/format";
import { useBackupImport, type ImportRow } from "../hooks/useBackupImport";
import { AlertIcon, CheckIcon, LockIcon, Spinner, UploadIcon } from "./icons";

interface Props {
  token: string | null;
  viewer: Viewer | null;
  listed: ListedMap | null;
  onLogin: () => void;
  onBrowse: () => void;
  onSessionExpired: () => void;
  onImported: (entries: { mediaId: number; id: number; status: string }[]) => void;
}

type Filter = "selected" | "review" | "listed" | "missing" | "failed" | "all";

const STATUSES: ImportStatus[] = ["CURRENT", "COMPLETED", "PLANNING", "PAUSED", "DROPPED"];

const NF = new Intl.NumberFormat();

function needsReview(row: ImportRow): boolean {
  return Boolean(row.media) && !row.duplicate && row.confidence < CONFIDENT_MATCH && row.outcome !== "saved";
}

const FILTERS: { id: Filter; label: string; test: (row: ImportRow) => boolean }[] = [
  { id: "selected", label: "To import", test: (row) => row.include },
  { id: "review", label: "Check match", test: needsReview },
  { id: "listed", label: "On your list", test: (row) => Boolean(row.onList) },
  { id: "missing", label: "Not found", test: (row) => !row.media },
  { id: "failed", label: "Failed", test: (row) => row.outcome === "failed" },
  { id: "all", label: "All", test: () => true },
];

function matchBadge(row: ImportRow) {
  if (row.via === "tracker") {
    return { label: "Linked", title: "Matched through the backup's tracker link", tone: "text-emerald-700 bg-emerald-500/10" };
  }
  if (row.confidence >= 0.999) {
    return { label: "Exact", title: "Title matches exactly", tone: "text-emerald-700 bg-emerald-500/10" };
  }
  const pct = `${Math.round(row.confidence * 100)}%`;
  return row.confidence >= CONFIDENT_MATCH
    ? { label: pct, title: "Close title match", tone: "text-sky-700 bg-sky-500/10" }
    : { label: `${pct} — check`, title: "Weak title match — make sure it's the right series", tone: "text-amber-800 bg-amber-400/20" };
}

function Row({
  row,
  disabled,
  onToggle,
  onStatus,
}: {
  row: ImportRow;
  disabled: boolean;
  onToggle: (include: boolean) => void;
  onStatus: (status: ImportStatus) => void;
}) {
  const media = row.media;
  const aniTitle = media ? media.title.english || media.title.romaji : null;
  const badge = media ? matchBadge(row) : null;
  const saved = row.outcome === "saved";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <input
        type="checkbox"
        aria-label={`Import ${row.backup.title}`}
        checked={row.include}
        disabled={disabled || !media || saved}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-rose-600 disabled:opacity-40"
      />
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-stone-900/5">
        {media?.coverImage.medium && (
          <img src={media.coverImage.medium} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-900" title={row.backup.title}>
          {row.backup.title}
        </p>
        {media ? (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
            <span className="shrink-0">→</span>
            <a
              href={`https://anilist.co/manga/${media.id}`}
              target="_blank"
              rel="noreferrer"
              className="truncate underline-offset-2 hover:text-stone-800 hover:underline"
              title={aniTitle ?? undefined}
            >
              {aniTitle}
            </a>
            {badge && (
              <span title={badge.title} className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${badge.tone}`}>
                {badge.label}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-stone-500">
            No AniList match —{" "}
            <a
              href={`https://anilist.co/search/manga?search=${encodeURIComponent(row.backup.title)}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rose-600 underline-offset-2 hover:underline"
            >
              search AniList
            </a>
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500">
          <span>
            {row.backup.readCount > 0 ? `Read to ch. ${row.backup.progress}` : "Nothing read yet"}
            {media?.chapters ? ` of ${media.chapters}` : ""}
          </span>
          {row.backup.source && <span className="text-stone-400">· {row.backup.source}</span>}
          {row.onList && !saved && (
            <span className="rounded-full bg-stone-900/5 px-1.5 py-px font-medium text-stone-600">
              On your list: {formatStatus(row.onList.status, "MANGA")}
              {row.onList.progress ? ` · ch. ${row.onList.progress}` : ""}
            </span>
          )}
          {row.duplicate && (
            <span className="rounded-full bg-stone-900/5 px-1.5 py-px font-medium text-stone-600" title="Another copy of this series in your backup has more progress">
              Duplicate
            </span>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-px font-semibold text-emerald-700">
              <CheckIcon className="h-3 w-3" /> Saved
            </span>
          )}
          {row.outcome === "failed" && (
            <span className="rounded-full bg-rose-500/10 px-1.5 py-px font-semibold text-rose-700" title={row.error ?? undefined}>
              Failed{row.error ? `: ${row.error}` : ""}
            </span>
          )}
        </p>
      </div>

      {media && (
        <select
          aria-label={`List status for ${row.backup.title}`}
          value={row.status}
          disabled={disabled || saved}
          onChange={(e) => onStatus(e.target.value as ImportStatus)}
          className="shrink-0 rounded-lg border border-stone-900/10 bg-white/70 px-2 py-1 text-xs font-medium text-stone-700 disabled:opacity-50"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status === "PLANNING" ? "Plan to read" : formatStatus(status, "MANGA")}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}

export default function ImportPage({
  token,
  viewer,
  listed,
  onLogin,
  onBrowse,
  onSessionExpired,
  onImported,
}: Props) {
  const importer = useBackupImport({ token, listed, onSessionExpired, onImported });
  const { phase, rows, progress } = importer;
  const [filter, setFilter] = useState<Filter>("selected");
  const [dragging, setDragging] = useState(false);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = rows.filter(f.test).length;
    return out;
  }, [rows]);
  const savedCount = useMemo(() => rows.filter((row) => row.outcome === "saved").length, [rows]);
  const shown = useMemo(
    () => rows.filter(FILTERS.find((f) => f.id === filter)!.test),
    [rows, filter],
  );

  /* --------------------------------- guest --------------------------------- */

  if (!token || !viewer) {
    return (
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
        <div className="glass w-full max-w-md rounded-3xl px-8 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-600">
            <LockIcon className="h-6 w-6" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-stone-900">
            Bring your library over
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Sign in to import a Tachiyomi, Mihon or Tachimanga backup into your AniList manga list.
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

  /* -------------------------------- picker --------------------------------- */

  const pick = (file: File | undefined) => {
    if (!file) return;
    setFilter("selected");
    void importer.start(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  const busy = phase === "parsing" || phase === "matching" || phase === "saving";
  const selected = counts.selected ?? 0;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600">
          Tachiyomi · Mihon · Tachimanga
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Import your manga library
        </h1>
        <p className="mt-1 max-w-lg text-sm text-stone-500">
          Your backup is read on this device. Only titles go to AniList to find matches, and nothing
          is saved until you review it.
        </p>
      </header>

      {importer.error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{importer.error}</span>
        </div>
      )}

      {phase === "idle" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-rose-500/60 bg-rose-500/5" : "border-stone-900/15 bg-white/40 hover:bg-white/60"
          }`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-600">
            <UploadIcon className="h-6 w-6" />
          </span>
          <span className="font-display text-lg font-semibold text-stone-900">Drop a backup file here</span>
          <span className="max-w-sm text-sm text-stone-500">
            Tachimanga <code className="text-xs">.tmb</code>, or Tachiyomi / Mihon{" "}
            <code className="text-xs">.tachibk</code> and <code className="text-xs">.proto.gz</code>.
            Create one from the app&apos;s backup settings.
          </span>
          <span className="brand-gradient mt-1 rounded-full px-5 py-2 text-sm font-semibold text-white">
            Choose file
          </span>
          <input
            type="file"
            accept=".tmb,.tachibk,.gz,.proto"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {busy && (
        <div className="glass mt-5 rounded-3xl px-6 py-6">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-rose-500" />
            <p className="text-sm font-semibold text-stone-800">
              {phase === "parsing"
                ? "Reading your backup…"
                : phase === "matching"
                  ? `Matching titles with AniList… ${NF.format(progress.done)} / ${NF.format(progress.total)}`
                  : `Saving to your AniList… ${NF.format(progress.done)} / ${NF.format(progress.total)}`}
            </p>
            <button
              type="button"
              onClick={importer.cancel}
              className="ml-auto rounded-full px-3 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-900/5 hover:text-stone-800"
            >
              Cancel
            </button>
          </div>
          {phase !== "parsing" && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-900/10">
              <div
                className="brand-gradient h-full rounded-full transition-[width] duration-500"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-stone-500">
            {importer.waitSeconds > 0
              ? `AniList asked us to slow down — resuming in ${importer.waitSeconds}s.`
              : phase === "parsing"
                ? "Unpacking the library database."
                : "Requests are paced to respect AniList's rate limit, so big libraries take a minute or two. Keep this page open."}
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl bg-emerald-500/10 px-5 py-4">
          <CheckIcon className="h-5 w-5 text-emerald-700" />
          <p className="flex-1 text-sm font-medium text-emerald-800">
            Saved {NF.format(savedCount)} {savedCount === 1 ? "title" : "titles"} to your AniList.
            {counts.failed > 0 && ` ${counts.failed} failed — they're still selected if you want to retry.`}
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="brand-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white"
          >
            Back to the deck
          </button>
        </div>
      )}

      {(phase === "review" || phase === "done" || phase === "saving") && rows.length > 0 && (
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-600">
              <strong className="font-semibold text-stone-900">{NF.format(rows.length)}</strong> manga
              in your {importer.format} library ·{" "}
              <strong className="font-semibold text-stone-900">{NF.format(rows.length - counts.missing)}</strong>{" "}
              found on AniList
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={importer.reset}
              className="text-xs font-medium text-stone-500 transition hover:text-stone-800 disabled:opacity-40"
            >
              Use another file
            </button>
          </div>

          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {FILTERS.filter((f) => f.id !== "failed" || counts.failed > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f.id
                    ? "border border-rose-500/40 bg-rose-500/10 text-rose-700"
                    : "border border-transparent text-stone-500 hover:bg-stone-900/5 hover:text-stone-700"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {filter === "review" && counts.review > 0 && (
            <p className="mt-2 text-xs text-stone-500">
              These titles only loosely match what AniList found. Tick the ones that are right.
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => importer.setIncluded(new Set(shown.map((r) => r.key)), true)}
              className="font-medium text-rose-600 hover:underline disabled:opacity-40"
            >
              Select all shown
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => importer.setIncluded(new Set(shown.map((r) => r.key)), false)}
              className="font-medium text-stone-500 hover:underline disabled:opacity-40"
            >
              Clear shown
            </button>
          </div>

          {shown.length > 0 ? (
            <ul className="glass mt-3 divide-y divide-stone-900/5 overflow-hidden rounded-2xl">
              {shown.map((row) => (
                <Row
                  key={row.key}
                  row={row}
                  disabled={busy}
                  onToggle={(include) => importer.updateRow(row.key, { include })}
                  onStatus={(status) => importer.updateRow(row.key, { status })}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-sm text-stone-500">Nothing here.</p>
          )}
        </section>
      )}

      {(phase === "review" || phase === "done") && selected > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-900/10 glass-strong">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <p className="text-xs text-stone-500">
              Adds or updates {NF.format(selected)} {selected === 1 ? "entry" : "entries"} with the
              status and chapter progress shown.
            </p>
            <button
              type="button"
              onClick={() => void importer.save()}
              className="brand-gradient shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(225,29,72,0.6)] transition hover:scale-[1.02]"
            >
              Import {NF.format(selected)}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
