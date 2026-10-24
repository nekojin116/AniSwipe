import type { DeckDef, DeckId, MediaType, Region, Viewer } from "../lib/anilist";
import { MANGA_REGIONS, regionDef } from "../lib/anilist";
import { ChartIcon, LogoMark, LogoutIcon, SearchIcon } from "./icons";

interface Props {
  viewer: Viewer | null;
  decks: DeckDef[];
  deckId: DeckId;
  mediaType: MediaType;
  region: Region;
  /** Deck view vs. the stats page. */
  view: "deck" | "stats";
  onMediaTypeChange: (type: MediaType) => void;
  onDeckChange: (id: DeckId) => void;
  onRegionChange: (region: Region) => void;
  onStats: () => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}

const MEDIA_TYPES: MediaType[] = ["ANIME", "MANGA"];

export default function TopBar({
  viewer,
  decks,
  deckId,
  mediaType,
  region,
  view,
  onMediaTypeChange,
  onDeckChange,
  onRegionChange,
  onStats,
  searchInput,
  onSearchChange,
  onLogin,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-stone-900/10">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display hidden text-lg font-bold tracking-tight text-stone-900 sm:block">
            AniSwipe
          </span>
        </div>

        {/* Anime / Manga switcher (manga is experimental) */}
        <div
          className="glass flex shrink-0 items-center rounded-full p-0.5"
          title="Switch between anime and manga decks — manga is experimental"
        >
          {MEDIA_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={mediaType === type}
              onClick={() => onMediaTypeChange(type)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition ${
                mediaType === type
                  ? "bg-rose-600 text-white shadow-[0_4px_12px_-4px_rgba(225,29,72,0.6)]"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {type === "ANIME" ? (
                "Anime"
              ) : (
                <>
                  Manga
                  <sup className="ml-0.5 text-[8px] font-bold opacity-75">β</sup>
                </>
              )}
            </button>
          ))}
        </div>

        <nav className="no-scrollbar flex flex-1 items-center justify-center gap-1 overflow-x-auto">
          {decks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => onDeckChange(deck.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                view === "deck" && deckId === deck.id
                  ? "brand-gradient text-white shadow-[0_6px_18px_-6px_rgba(225,29,72,0.55)]"
                  : "text-stone-500 hover:bg-stone-900/5 hover:text-stone-800"
              }`}
            >
              {deck.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onStats}
            aria-pressed={view === "stats"}
            aria-label="Your stats"
            title="Your live AniList stats"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
              view === "stats"
                ? "brand-gradient text-white shadow-[0_6px_18px_-6px_rgba(225,29,72,0.55)]"
                : "glass text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
            }`}
          >
            <ChartIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          {viewer ? (
            <div className="flex items-center gap-2 rounded-full border border-stone-900/10 bg-stone-900/5 py-1 pl-2.5 pr-1">
              <img
                src={viewer.avatar?.large ?? undefined}
                alt=""
                className="h-6 w-6 rounded-full bg-stone-900/10 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="hidden max-w-[90px] truncate text-xs font-medium text-stone-700 sm:block">
                {viewer.name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className="grid h-6 w-6 place-items-center rounded-full text-stone-500 transition hover:bg-stone-900/10 hover:text-stone-900"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="brand-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_18px_-6px_rgba(225,29,72,0.55)] transition hover:scale-105"
            >
              Log in
            </button>
          )}
        </div>
      </div>

      {/* Manga/manhwa/manhua origin filter — manga decks only */}
      {view === "deck" && mediaType === "MANGA" && (
        <div className="border-t border-stone-900/10">
          <div className="no-scrollbar mx-auto flex w-full max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-1.5">
            <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Origin
            </span>
            {MANGA_REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={region === r.id}
                onClick={() => onRegionChange(r.id)}
                title={`Only ${r.term} from ${
                  r.id === "ALL" ? "any country" : r.id === "JP" ? "Japan" : r.id === "KR" ? "Korea" : "China"
                }`}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  region === r.id
                    ? "border border-rose-500/40 bg-rose-500/10 text-rose-700"
                    : "border border-transparent text-stone-500 hover:bg-stone-900/5 hover:text-stone-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "deck" && deckId === "search" && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-stone-900/10 bg-stone-900/[0.03] px-3 py-2 focus-within:border-rose-500/50">
            <SearchIcon className="h-4 w-4 text-stone-400" />
            <input
              autoFocus
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                mediaType === "MANGA"
                  ? `Search ${regionDef(region).term} titles… (e.g. ${regionDef(region).example})`
                  : "Search anime titles… (e.g. Frieren)"
              }
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>
      )}
    </header>
  );
}
