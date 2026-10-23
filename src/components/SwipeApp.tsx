import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./TopBar";
import SwipeDeck, { type SwipeDeckHandle } from "./SwipeDeck";
import type { Dir } from "./AnimeCard";
import ActionBar from "./ActionBar";
import Toast, { type ToastState } from "./Toast";
import { AlertIcon, Spinner } from "./icons";
import CategoryFilter from "./CategoryFilter";
import { useDeck } from "../hooks/useDeck";
import {
  AlError,
  decksFor,
  deleteEntry,
  fetchListedEntries,
  GENRES,
  regionDef,
  saveEntry,
  type Anime,
  type DeckId,
  type ListedMap,
  type MediaType,
  type Region,
  type Viewer,
} from "../lib/anilist";
import { displayTitle } from "../lib/format";

interface Props {
  token: string | null;
  viewer: Viewer | null;
  onLogin: () => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

interface Action {
  anime: Anime;
  dir: Dir;
  mediaType: MediaType;
  entryId: number | null;
  prevStatus: string | null;
  created: boolean;
}

interface Stats {
  completed: number;
  planning: number;
  skipped: number;
}

const EMPTY_STATS: Stats = { completed: 0, planning: 0, skipped: 0 };

const MEDIA_TYPE_KEY = "aniswipe.mediaType";
const REGION_KEY = "aniswipe.region";
const GENRES_KEY = "aniswipe.genres";

function loadStoredType(): MediaType {
  try {
    return localStorage.getItem(MEDIA_TYPE_KEY) === "MANGA" ? "MANGA" : "ANIME";
  } catch {
    return "ANIME";
  }
}

function loadStoredRegion(): Region {
  try {
    const value = localStorage.getItem(REGION_KEY);
    return value === "JP" || value === "KR" || value === "CN" ? value : "ALL";
  } catch {
    return "ALL";
  }
}

function loadStoredGenres(): string[] {
  try {
    const raw = localStorage.getItem(GENRES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Keep only strings we recognize as genres (guards against stale data).
    const valid = new Set(GENRES);
    return parsed.filter((g): g is string => typeof g === "string" && valid.has(g));
  } catch {
    return [];
  }
}

export default function SwipeApp({
  token,
  viewer,
  onLogin,
  onLogout,
  onSessionExpired,
}: Props) {
  const isGuest = !token;
  const [mediaType, setMediaType] = useState<MediaType>(loadStoredType);
  const [region, setRegion] = useState<Region>(loadStoredRegion);
  const [genres, setGenres] = useState<string[]>(loadStoredGenres);
  const [randomize, setRandomize] = useState(true);
  const [deckId, setDeckId] = useState<DeckId>("popular");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showAdded, setShowAdded] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [listed, setListed] = useState<ListedMap | null>(null);

  const deckRef = useRef<SwipeDeckHandle>(null);
  const typeRef = useRef(mediaType);

  // Latest media type for async callbacks that may resolve after a switch.
  useEffect(() => {
    typeRef.current = mediaType;
  }, [mediaType]);

  useEffect(() => {
    try {
      localStorage.setItem(MEDIA_TYPE_KEY, mediaType);
    } catch {
      // ignore
    }
  }, [mediaType]);

  useEffect(() => {
    try {
      localStorage.setItem(REGION_KEY, region);
    } catch {
      // ignore
    }
  }, [region]);

  useEffect(() => {
    try {
      localStorage.setItem(GENRES_KEY, JSON.stringify(genres));
    } catch {
      // ignore
    }
  }, [genres]);

  const showToast = useCallback((message: string, kind: ToastState["kind"] = "info") => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  // Debounce the search box (saves rate limit).
  useEffect(() => {
    const value = searchInput.trim();
    const timer = window.setTimeout(() => setSearch(value), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Bulk snapshot of the viewer's list — loaded once per login + media type.
  // It is the authoritative "already added" filter: it keeps hiding listed
  // titles even when the API's per-card mediaListEntry returns null, and lets
  // us backfill "On your list" badges the API missed.
  useEffect(() => {
    if (!token || !viewer) {
      setListed(null);
      return;
    }
    let cancelled = false;
    setListed(null);
    fetchListedEntries(viewer.id, mediaType, token)
      .then((map) => {
        if (!cancelled) setListed(map);
      })
      .catch(() => {
        // Non-fatal — the per-card mediaListEntry field still filters.
        if (!cancelled) setListed(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [token, viewer, mediaType]);

  const decks = useMemo(() => decksFor(mediaType, region), [mediaType, region]);
  const mediaNoun = mediaType === "MANGA" ? regionDef(region).term : "anime";

  // The search deck serves two modes: a text query, or a category browse.
  // With categories (and no query) it randomizes so you keep discovering.
  const searchReady =
    deckId !== "search" || search.length >= 2 || genres.length > 0;
  const randomBrowse = deckId === "search" && search.length < 2 && randomize;
  const deck = useDeck({
    deckId,
    search,
    showAdded,
    token,
    mediaType,
    region,
    genres,
    random: randomBrowse,
    listed,
    enabled: searchReady,
  });
  const { removeItem, pushFront } = deck;

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ------------------------------ media type ------------------------------- */

  const switchMediaType = useCallback(
    (next: MediaType) => {
      if (next === mediaType) return;
      setMediaType(next);
      // Undo state and the session tally are media-specific: an undo must
      // never push a card from the other deck back into this one.
      setLastAction(null);
      setStats(EMPTY_STATS);
      setToast(null);
    },
    [mediaType],
  );

  /* ------------------------------- categories ------------------------------ */

  const toggleGenre = useCallback((genre: string) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }, []);

  const clearGenres = useCallback(() => setGenres([]), []);

  /* ------------------------------ swipe actions ---------------------------- */

  const handleSwipe = useCallback(
    (anime: Anime, dir: Dir) => {
      removeItem(anime.id);

      if (dir === "left") {
        setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
        return;
      }

      const status = dir === "right" ? "COMPLETED" : "PLANNING";
      const statKey = dir === "right" ? "completed" : "planning";
      const prevStatus = anime.mediaListEntry?.status ?? null;
      setStats((s) => ({ ...s, [statKey]: s[statKey] + 1 }));

      if (!token) {
        showToast("Guest mode — sign in to save and filter with your list", "info");
        return;
      }

      const typeAtSwipe = mediaType;
      saveEntry(anime.id, status, token)
        .then((entry) => {
          // Mirror the new entry in the bulk snapshot so the filter stays
          // correct for pages fetched after this swipe.
          setListed((prev) => {
            if (!prev) return prev;
            const next = new Map(prev);
            next.set(anime.id, { id: entry.id, status: entry.status });
            return next;
          });
          // The user may have switched media type while this was in flight.
          if (typeRef.current !== typeAtSwipe) return;
          setLastAction({
            anime,
            dir,
            mediaType: typeAtSwipe,
            entryId: entry.id,
            prevStatus,
            created: prevStatus === null,
          });
          const label =
            dir === "right"
              ? typeAtSwipe === "MANGA"
                ? "Read"
                : "Watched"
              : typeAtSwipe === "MANGA"
                ? "Plan to read"
                : "Plan to watch";
          showToast(`${label} — ${displayTitle(anime)}`, "ok");
        })
        .catch((err) => {
          const alErr = err instanceof AlError ? err : new AlError(String(err));
          if (alErr.status === 401) {
            onSessionExpired();
            return;
          }
          if (typeRef.current === typeAtSwipe) {
            // Put the card back so the swipe can be retried.
            pushFront(anime);
            setStats((s) => ({ ...s, [statKey]: Math.max(0, s[statKey] - 1) }));
          }
          showToast(alErr.message, "err");
        });
    },
    [removeItem, pushFront, token, showToast, onSessionExpired, mediaType],
  );

  const handleUndo = useCallback(async () => {
    const action = lastAction;
    if (!action || !token) return;
    setLastAction(null);

    try {
      if (action.created && action.entryId != null) {
        await deleteEntry(action.entryId, token);
      } else if (action.prevStatus) {
        await saveEntry(
          action.anime.id,
          action.prevStatus as "COMPLETED" | "PLANNING" | "CURRENT" | "PAUSED" | "DROPPED",
          token,
        );
      }

      // Mirror the reversal in the bulk snapshot.
      setListed((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        if (action.created) {
          next.delete(action.anime.id);
        } else if (action.entryId != null && action.prevStatus) {
          next.set(action.anime.id, { id: action.entryId, status: action.prevStatus });
        }
        return next;
      });

      // Only reinsert the card (and touch the tally) if we're still on its
      // media type — decks never mix.
      if (typeRef.current === action.mediaType) {
        pushFront(action.anime);
        const statKey = action.dir === "right" ? "completed" : "planning";
        setStats((s) => ({ ...s, [statKey]: Math.max(0, s[statKey] - 1) }));
      }
      showToast(`Undone — ${displayTitle(action.anime)}`, "info");
    } catch (err) {
      const alErr = err instanceof AlError ? err : new AlError(String(err));
      if (alErr.status === 401) {
        onSessionExpired();
        return;
      }
      if (typeRef.current === action.mediaType) setLastAction(action);
      showToast(alErr.message, "err");
    }
  }, [lastAction, token, pushFront, showToast, onSessionExpired]);

  const requestSwipe = useCallback(
    (dir: Dir) => {
      deckRef.current?.request(dir);
    },
    [],
  );

  /* -------------------------------- keyboard -------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      switch (event.key) {
        case "ArrowLeft":
          requestSwipe("left");
          break;
        case "ArrowRight":
          requestSwipe("right");
          break;
        case "ArrowUp":
          event.preventDefault();
          requestSwipe("up");
          break;
        case "z":
        case "Z":
          void handleUndo();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestSwipe, handleUndo]);

  /* --------------------------------- derived -------------------------------- */

  const hint = decks.find((d) => d.id === deckId)?.hint ?? "";
  const totalSwipes = stats.completed + stats.planning + stats.skipped;
  const topAnime = deck.items[0];

  const emptyPanel = useMemo(() => {
    // Only prompt for a query when there's no category to browse either.
    if (deckId === "search" && search.length < 2 && genres.length === 0) {
      return {
        icon: <Spinner className="h-6 w-6 text-rose-500" />,
        title: mediaType === "MANGA" ? `Search for a ${mediaNoun}` : "Search for an anime",
        body: "Type at least 2 characters above, or pick categories on the left.",
      };
    }
    if (deck.loading || (deck.items.length === 0 && deck.hasNextPage && !deck.error)) {
      return {
        icon: <Spinner className="h-7 w-7 text-rose-500" />,
        title: "Loading deck…",
        body: `Fetching ${mediaNoun} from AniList.`,
      };
    }
    if (deck.error && deck.items.length === 0) {
      return {
        icon: <AlertIcon className="h-7 w-7 text-rose-600" />,
        title: "Couldn't load the deck",
        body: deck.error.message,
        retry: true,
      };
    }
    return {
      icon: <span className="text-3xl">🎉</span>,
      title: "You're all caught up!",
      body: "You've swiped through this entire deck. Try another one.",
      switchDeck: true,
    };
  }, [deckId, search, genres.length, mediaType, mediaNoun, deck.loading, deck.items.length, deck.hasNextPage, deck.error]);

  const showEmpty = deck.items.length === 0 && !(deck.error && deck.loading);

  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <TopBar
        viewer={viewer}
        decks={decks}
        deckId={deckId}
        mediaType={mediaType}
        region={region}
        onMediaTypeChange={switchMediaType}
        onDeckChange={setDeckId}
        onRegionChange={setRegion}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onLogin={onLogin}
        onLogout={onLogout}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-8 pt-4">
        <div className="flex w-full flex-1 items-start justify-center gap-6">
          {/* Category rail — only on the search deck. Wide screens: a sticky
              left column. Narrow: stacked above the deck. */}
          {deckId === "search" && (
            <div className="w-full max-w-[400px] lg:sticky lg:top-24 lg:w-64 lg:max-w-none">
              <CategoryFilter
                selected={genres}
                onToggle={toggleGenre}
                onClear={clearGenres}
                randomize={randomize}
                onRandomizeChange={setRandomize}
                mediaTypeLabel={mediaNoun}
              />
            </div>
          )}

          <div className="flex w-full flex-col items-center">
            {/* Deck meta row */}
            <div className="mb-3 flex w-full max-w-[400px] items-center justify-between gap-3">
              <p className="truncate text-xs text-stone-500">{hint}</p>
          {!isGuest ? (
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-stone-500 transition hover:text-stone-700"
              title="Hide titles that are already on your AniList"
            >
              <input
                type="checkbox"
                checked={!showAdded}
                onChange={(e) => setShowAdded(!e.target.checked)}
                className="h-3 w-3 accent-rose-600"
              />
              Hide already-added
            </label>
          ) : (
            <span
              className="shrink-0 rounded-full border border-amber-500/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-800"
              title="Without your AniList login the app can't know what you've watched, so nothing is filtered. Log in to hide titles you've already added."
            >
              Filter off in guest mode
            </span>
          )}
        </div>

        {/* Deck */}
        <div className="relative h-[min(560px,58vh)] w-full max-w-[400px] min-h-[380px]">
          <SwipeDeck ref={deckRef} items={deck.items} mediaType={mediaType} onSwipe={handleSwipe} />

          {showEmpty && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-stone-900/10 bg-stone-900/[0.03] px-8 text-center">
              {emptyPanel.icon}
              <h3 className="font-display text-lg font-semibold text-stone-900">
                {emptyPanel.title}
              </h3>
              <p className="max-w-[260px] text-sm text-stone-500">{emptyPanel.body}</p>
              {emptyPanel.retry && (
                <button
                  type="button"
                  onClick={deck.retry}
                  className="brand-gradient rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:scale-105"
                >
                  Try again
                </button>
              )}
              {emptyPanel.switchDeck && (
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {decks.filter((d) => d.id !== deckId && d.id !== "search").map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeckId(d.id)}
                      className="glass rounded-full px-4 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-900/5"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Non-blocking error banner (deck still has cards) */}
          {deck.error && deck.items.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 rounded-b-[24px] bg-rose-500/10 px-4 py-2 text-xs text-rose-700 backdrop-blur">
              <AlertIcon className="h-3.5 w-3.5" />
              {deck.error.message}
            </div>
          )}
        </div>

        <p className="mt-4 select-none text-center text-[11px] text-stone-500">
          {topAnime
            ? `Drag the card — ${displayTitle(topAnime)}`
            : "Use the buttons or arrow keys to swipe"}
        </p>
          </div>
        </div>

        <div className="mt-3">
          <ActionBar
            mediaType={mediaType}
            onUndo={() => void handleUndo()}
            onSkip={() => requestSwipe("left")}
            onPlan={() => requestSwipe("up")}
            onWatched={() => requestSwipe("right")}
            canUndo={Boolean(lastAction)}
            disabled={!topAnime}
          />
        </div>

        {isGuest && (
          <div className="glass mt-5 flex items-center gap-3 rounded-full px-4 py-2 text-xs text-stone-500">
            <span>
              Browsing as a guest — swipes aren&apos;t saved, and watched titles aren&apos;t
              hidden.
            </span>
            <button
              type="button"
              onClick={onLogin}
              className="brand-gradient rounded-full px-3 py-1 text-[11px] font-semibold text-white transition hover:scale-105"
            >
              Log in to filter
            </button>
          </div>
        )}

        {/* Session stats */}
        <div className="mt-6 flex items-center gap-4 text-xs text-stone-500">
          <span>
            <strong className="font-semibold text-rose-600">{stats.completed}</strong>{" "}
            {mediaType === "MANGA" ? "read" : "watched"}
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <strong className="font-semibold text-amber-600">{stats.planning}</strong> planned
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <strong className="font-semibold text-stone-400">{stats.skipped}</strong> skipped
          </span>
          {totalSwipes > 0 && (
            <>
              <span className="text-stone-300">•</span>
              <button
                type="button"
                onClick={() => setStats(EMPTY_STATS)}
                className="text-stone-500 underline-offset-2 transition hover:text-stone-700 hover:underline"
              >
                reset
              </button>
            </>
          )}
        </div>
      </main>

      <Toast toast={toast} />
    </div>
  );
}
