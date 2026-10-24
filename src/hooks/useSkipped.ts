import { useCallback, useEffect, useState } from "react";
import type { MediaType } from "../lib/anilist";

const STORAGE_KEY = "aniswipe.skipped.v1";

/**
 * Keep the skip list bounded. The cap is high enough for even very large
 * backfills while still keeping localStorage comfortably small.
 */
const MAX_PER_TYPE = 5000;

type SkipStore = Record<MediaType, Set<number>>;

function emptyStore(): SkipStore {
  return { ANIME: new Set(), MANGA: new Set() };
}

function parseIds(value: unknown): Set<number> {
  if (!Array.isArray(value)) return new Set();
  const ids = new Set<number>();
  for (const item of value) {
    if (typeof item === "number" && Number.isSafeInteger(item) && item > 0) {
      ids.add(item);
      if (ids.size >= MAX_PER_TYPE) break;
    }
  }
  return ids;
}

function loadStore(): SkipStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return {
      ANIME: parseIds(parsed?.ANIME),
      MANGA: parseIds(parsed?.MANGA),
    };
  } catch {
    // Corrupt/unavailable storage — start fresh rather than break the deck.
    return emptyStore();
  }
}

function persist(store: SkipStore): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ANIME: [...store.ANIME], MANGA: [...store.MANGA] }),
    );
  } catch {
    // Private mode / quota — skips still work for this session.
  }
}

/**
 * Locally remembers left-swiped titles per media type so a refresh doesn't
 * resurrect them. `reset` clears the current media type's list and bumps
 * `resetToken`, which the deck uses to refetch from page 1.
 */
export function useSkipped(mediaType: MediaType) {
  const [store, setStore] = useState<SkipStore>(loadStore);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    persist(store);
  }, [store]);

  const skipped = store[mediaType];

  const skip = useCallback(
    (id: number) => {
      setStore((prev) => {
        if (prev[mediaType].has(id)) return prev;
        const next = new Set(prev[mediaType]);
        next.add(id);
        // Sets preserve insertion order, so this drops the oldest skip first.
        if (next.size > MAX_PER_TYPE) {
          const oldest = next.values().next().value;
          if (oldest !== undefined) next.delete(oldest);
        }
        return { ...prev, [mediaType]: next };
      });
    },
    [mediaType],
  );

  const reset = useCallback(() => {
    setStore((prev) => {
      if (prev[mediaType].size === 0) return prev;
      return { ...prev, [mediaType]: new Set() };
    });
    setResetToken((token) => token + 1);
  }, [mediaType]);

  return {
    /** IDs hidden for the current media type. */
    skipped,
    count: skipped.size,
    skip,
    reset,
    /** Changes only on reset, so the deck can refetch without resetting on every skip. */
    resetToken,
  };
}
