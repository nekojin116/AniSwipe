import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlError,
  fetchDeckPage,
  type Anime,
  type DeckId,
  type ListedMap,
  type MediaType,
  type Region,
} from "../lib/anilist";

interface Options {
  deckId: DeckId;
  search: string;
  showAdded: boolean;
  token: string | null;
  mediaType: MediaType;
  /** Manga/manhwa/manhua origin filter (ignored for anime). */
  region: Region;
  /** Bulk snapshot of the viewer's list; null while guest/loading. */
  listed: ListedMap | null;
  enabled: boolean;
}

function dedupe(items: Anime[]): Anime[] {
  const seen = new Set<number>();
  const out: Anime[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Manages a paginated, filtered queue of titles for the current deck.
 * New pages are pulled automatically whenever the stack runs low.
 */
export function useDeck({ deckId, search, showAdded, token, mediaType, region, listed, enabled }: Options) {
  const [items, setItems] = useState<Anime[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AlError | null>(null);

  const pageRef = useRef(0);
  const seqRef = useRef(0);
  const loadingRef = useRef(false);

  // The bulk list snapshot must be readable by `load` without being one of its
  // deps — a new Map identity per save would otherwise refetch the deck on
  // every swipe.
  const listedRef = useRef(listed);
  useEffect(() => {
    listedRef.current = listed;
  }, [listed]);

  const load = useCallback(
    async (seq: number, page: number, replace: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      if (page === 1) setError(null);

      try {
        const result = await fetchDeckPage({
          deckId,
          search,
          page,
          showAdded,
          token,
          mediaType,
          region,
          listed: listedRef.current,
        });
        if (seq !== seqRef.current) return;
        pageRef.current = page;
        setHasNextPage(result.hasNextPage);
        setError(null);
        setItems((prev) => dedupe(replace ? result.items : [...prev, ...result.items]));
      } catch (err) {
        const alErr = err instanceof AlError ? err : new AlError(String(err));
        if (seq !== seqRef.current) return;
        setError(alErr);
        if (alErr.status === 429) {
          const delay = (alErr.retryAfter ?? 60) * 1000 + 1500;
          window.setTimeout(() => {
            if (seq === seqRef.current) void load(seq, page, replace);
          }, delay);
        }
      } finally {
        if (seq === seqRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [deckId, search, showAdded, token, mediaType, region],
  );

  // Reset whenever the deck definition changes.
  useEffect(() => {
    seqRef.current += 1;
    const seq = seqRef.current;
    pageRef.current = 0;
    loadingRef.current = false;
    setItems([]);
    setHasNextPage(true);
    setError(null);
    setLoading(false);
    if (enabled) void load(seq, 1, true);
  }, [deckId, search, showAdded, token, mediaType, region, enabled, load]);

  // The bulk list snapshot landed (or showAdded flipped): hide anything on the
  // user's list that slipped into the queue, and backfill "On your list"
  // badges the per-card API field returned as null.
  useEffect(() => {
    if (!listed) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next: Anime[] = [];
      for (const item of prev) {
        const entry = item.mediaListEntry ?? listed.get(item.id) ?? null;
        if (!showAdded && entry) {
          changed = true;
          continue;
        }
        if (entry !== item.mediaListEntry) {
          changed = true;
          next.push({ ...item, mediaListEntry: entry });
        } else {
          next.push(item);
        }
      }
      return changed ? next : prev;
    });
  }, [listed, showAdded]);

  // Keep the stack topped up.
  useEffect(() => {
    if (!enabled || loadingRef.current || error || !hasNextPage) return;
    if (items.length < 6) {
      void load(seqRef.current, pageRef.current + 1, false);
    }
  }, [enabled, items.length, hasNextPage, error, load]);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    void load(seqRef.current, pageRef.current + 1, false);
  }, [load]);

  const retry = useCallback(() => {
    setError(null);
    void load(seqRef.current, Math.max(pageRef.current, 1), pageRef.current === 0);
  }, [load]);

  // Remove by identity: if the bulk filter removed the swiped card first,
  // falling back to "slice the head" would drop an unrelated title.
  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushFront = useCallback((anime: Anime) => {
    setItems((prev) => (prev[0]?.id === anime.id ? prev : [anime, ...prev]));
  }, []);

  return { items, loading, error, hasNextPage, loadMore, retry, removeItem, pushFront };
}
