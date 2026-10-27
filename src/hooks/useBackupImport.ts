import { useCallback, useEffect, useRef, useState } from "react";
import { AlError, type ListedMap } from "../lib/anilist";
import { parseBackup, type BackupFormat, type BackupManga } from "../lib/backup";
import {
  clampProgress,
  CONFIDENT_MATCH,
  ImportCancelled,
  matchBackup,
  proposeStatus,
  saveImports,
  type ImportStatus,
  type MatchMedia,
  type RunControl,
  type SaveOutcome,
} from "../lib/importer";

export type ImportPhase = "idle" | "parsing" | "matching" | "review" | "saving" | "done";

export interface ImportRow {
  key: string;
  backup: BackupManga;
  media: MatchMedia | null;
  via: "tracker" | "search" | null;
  confidence: number;
  /** What's already on the viewer's AniList list for this media, if anything. */
  onList: { status: string; progress: number | null } | null;
  /** Another row matched the same AniList media and has more progress. */
  duplicate: boolean;
  include: boolean;
  status: ImportStatus;
  progress: number;
  outcome: "saved" | "failed" | null;
  error: string | null;
}

interface Options {
  token: string | null;
  listed: ListedMap | null;
  onSessionExpired: () => void;
  /** Saved entries, so the deck can hide them right away. */
  onImported: (entries: { mediaId: number; id: number; status: string }[]) => void;
}

function buildRows(
  manga: BackupManga[],
  matches: Map<string, { media: MatchMedia | null; via: ImportRow["via"]; confidence: number }>,
  listed: ListedMap | null,
): ImportRow[] {
  const rows: ImportRow[] = manga.map((backup) => {
    const match = matches.get(backup.key) ?? { media: null, via: null, confidence: 0 };
    const media = match.media;
    const listEntry = media?.mediaListEntry ?? (media ? listed?.get(media.id) : null) ?? null;
    // The bulk snapshot has no progress; the per-media field normally does.
    const onList = listEntry
      ? { status: listEntry.status, progress: (listEntry as { progress?: number | null }).progress ?? null }
      : null;
    const status = proposeStatus(backup, media);
    const progress = media ? clampProgress(backup.progress, status, media) : backup.progress;
    // Already listed: only touch it when the backup is further along and the
    // entry isn't finished — never downgrade someone's AniList.
    const worthUpdating =
      !onList ||
      (onList.status !== "COMPLETED" && onList.progress !== null && progress > onList.progress);
    return {
      key: backup.key,
      backup,
      media,
      via: match.via,
      confidence: match.confidence,
      onList,
      duplicate: false,
      include: Boolean(media) && match.confidence >= CONFIDENT_MATCH && worthUpdating,
      status,
      progress,
      outcome: null,
      error: null,
    };
  });

  // The same series from two sources: keep the copy with the most progress.
  const best = new Map<number, ImportRow>();
  for (const row of rows) {
    if (!row.media) continue;
    const current = best.get(row.media.id);
    if (
      !current ||
      row.progress > current.progress ||
      (row.progress === current.progress && row.confidence > current.confidence)
    ) {
      best.set(row.media.id, row);
    }
  }
  for (const row of rows) {
    if (row.media && best.get(row.media.id) !== row) {
      row.duplicate = true;
      row.include = false;
    }
  }
  return rows;
}

export function useBackupImport({ token, listed, onSessionExpired, onImported }: Options) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [format, setFormat] = useState<BackupFormat | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runRef = useRef(0);
  // Latest values for async runs and click handlers, without re-creating them.
  const rowsRef = useRef(rows);
  const listedRef = useRef(listed);
  const callbacksRef = useRef({ onSessionExpired, onImported });
  useEffect(() => {
    rowsRef.current = rows;
    listedRef.current = listed;
    callbacksRef.current = { onSessionExpired, onImported };
  }, [rows, listed, onSessionExpired, onImported]);

  // Leaving the page stops any in-flight run after its current request.
  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  const control = useCallback((run: number): RunControl => ({
    cancelled: () => runRef.current !== run,
    onProgress: (done, total) => {
      if (runRef.current === run) setProgress({ done, total });
    },
    onWait: (seconds) => {
      if (runRef.current === run) setWaitSeconds(seconds);
    },
  }), []);

  const fail = useCallback((err: unknown, fallback: ImportPhase) => {
    if (err instanceof ImportCancelled) return;
    if (err instanceof AlError && err.status === 401) {
      callbacksRef.current.onSessionExpired();
      return;
    }
    setError(err instanceof Error ? err.message : String(err));
    setPhase(fallback);
  }, []);

  const start = useCallback(
    async (file: File) => {
      if (!token) return;
      const run = ++runRef.current;
      setError(null);
      setRows([]);
      setPhase("parsing");
      setProgress({ done: 0, total: 0 });

      let manga: BackupManga[];
      try {
        const parsed = await parseBackup(file);
        if (runRef.current !== run) return;
        setFormat(parsed.format);
        manga = parsed.manga;
      } catch (err) {
        if (runRef.current === run) fail(err, "idle");
        return;
      }

      setPhase("matching");
      setProgress({ done: 0, total: manga.length });
      try {
        const matches = await matchBackup(manga, token, control(run));
        if (runRef.current !== run) return;
        setRows(buildRows(manga, matches, listedRef.current));
        setPhase("review");
      } catch (err) {
        if (runRef.current === run) fail(err, "idle");
      } finally {
        if (runRef.current === run) setWaitSeconds(0);
      }
    },
    [token, control, fail],
  );

  const updateRow = useCallback((key: string, patch: Partial<Pick<ImportRow, "include" | "status">>) => {
    setRows((prev) => {
      const target = prev.find((row) => row.key === key);
      if (!target?.media) return prev;
      const mediaId = target.media.id;
      return prev.map((row) => {
        if (row.key === key) {
          const next = { ...row, ...patch };
          if (patch.status) next.progress = clampProgress(row.backup.progress, patch.status, row.media!);
          return next;
        }
        // Only one row per AniList title can be imported.
        if (patch.include && row.media?.id === mediaId && row.include) {
          return { ...row, include: false };
        }
        return row;
      });
    });
  }, []);

  const setIncluded = useCallback((keys: Set<string>, include: boolean) => {
    setRows((prev) => {
      const claimed = new Set(prev.filter((r) => r.include && !keys.has(r.key)).map((r) => r.media?.id));
      return prev.map((row) => {
        if (!keys.has(row.key) || !row.media || row.outcome === "saved") return row;
        if (include) {
          if (claimed.has(row.media.id)) return row.include ? { ...row, include: false } : row;
          claimed.add(row.media.id);
        }
        return row.include === include ? row : { ...row, include };
      });
    });
  }, []);

  const save = useCallback(async () => {
    if (!token) return;
    const requests = rowsRef.current
      .filter((row) => row.include && row.media && row.outcome !== "saved")
      .map((row) => ({
        key: row.key,
        mediaId: row.media!.id,
        status: row.status,
        progress: row.progress,
      }));
    if (requests.length === 0) return;

    const run = ++runRef.current;
    setError(null);
    setPhase("saving");
    setProgress({ done: 0, total: requests.length });

    const apply = (outcomes: SaveOutcome[]) => {
      const byKey = new Map(outcomes.map((o) => [o.key, o]));
      setRows((prev) =>
        prev.map((row) => {
          const outcome = byKey.get(row.key);
          if (!outcome) return row;
          return {
            ...row,
            outcome: outcome.entry ? "saved" : "failed",
            error: outcome.error,
            include: !outcome.entry,
            onList: outcome.entry ? { status: outcome.entry.status, progress: row.progress } : row.onList,
          };
        }),
      );
      const saved = outcomes
        .filter((o) => o.entry)
        .map((o) => ({ mediaId: o.mediaId, id: o.entry!.id, status: o.entry!.status }));
      if (saved.length) callbacksRef.current.onImported(saved);
    };

    try {
      await saveImports(requests, token, control(run), apply);
      if (runRef.current === run) setPhase("done");
    } catch (err) {
      if (runRef.current === run) fail(err, "review");
    } finally {
      if (runRef.current === run) setWaitSeconds(0);
    }
  }, [token, control, fail]);

  /** Stop the current run; matching goes back to the picker, saving to review. */
  const cancel = useCallback(() => {
    runRef.current += 1;
    setWaitSeconds(0);
    setPhase((current) => (current === "saving" ? "review" : current === "review" ? current : "idle"));
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    setPhase("idle");
    setRows([]);
    setFormat(null);
    setError(null);
    setWaitSeconds(0);
  }, []);

  return {
    phase,
    format,
    rows,
    progress,
    waitSeconds,
    error,
    start,
    updateRow,
    setIncluded,
    save,
    cancel,
    reset,
    /** Back to review after a finished save, e.g. to retry failures. */
    review: useCallback(() => setPhase("review"), []),
  };
}
