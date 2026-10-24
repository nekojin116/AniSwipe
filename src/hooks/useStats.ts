import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlError,
  fetchStatsEntries,
  type MediaType,
  type StatsEntry,
  type Viewer,
} from "../lib/anilist";
import { computeStats, type StatsSummary } from "../lib/stats";

interface Options {
  viewer: Viewer | null;
  mediaType: MediaType;
  token: string | null;
  /** False for guests / while the stats view is hidden. */
  enabled: boolean;
  onSessionExpired: () => void;
}

/**
 * Loads a fresh snapshot of the viewer's list and aggregates it for the stats
 * page. The fetch is deliberately uncached: AniList's own stats only refresh
 * once a day, which is the whole reason this page exists.
 */
export function useStats({
  viewer,
  mediaType,
  token,
  enabled,
  onSessionExpired,
}: Options) {
  const [entries, setEntries] = useState<StatsEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AlError | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const lastKeyRef = useRef<string>("");
  const viewerId = viewer?.id ?? null;

  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  useEffect(() => {
    if (!enabled || !viewerId || !token) {
      setEntries(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const key = `${viewerId}:${mediaType}`;

    // Keep the previous snapshot visible while a manual refresh runs; only
    // clear it when switching media type or account.
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      setEntries(null);
      setUpdatedAt(null);
    }

    setLoading(true);
    setError(null);

    fetchStatsEntries(viewerId, mediaType, token)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setUpdatedAt(Date.now());
      })
      .catch((err) => {
        if (cancelled) return;
        const alErr = err instanceof AlError ? err : new AlError(String(err));
        if (alErr.status === 401) {
          onSessionExpiredRef.current();
          return;
        }
        setError(alErr);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, viewerId, mediaType, token, nonce]);

  const summary: StatsSummary | null = useMemo(
    () => (entries ? computeStats(entries, mediaType) : null),
    [entries, mediaType],
  );

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { summary, loading, error, updatedAt, refresh };
}
