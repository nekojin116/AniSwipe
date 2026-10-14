import type { DeckDef, DeckId, MediaType, Region, Viewer } from "../lib/anilist";
import { MANGA_REGIONS, regionDef } from "../lib/anilist";
import { LogoMark, LogoutIcon, SearchIcon } from "./icons";

interface Props {
  viewer: Viewer | null;
  decks: DeckDef[];
  deckId: DeckId;
  mediaType: MediaType;
  region: Region;
  onMediaTypeChange: (type: MediaType) => void;
  onDeckChange: (id: DeckId) => void;
  onRegionChange: (region: Region) => void;
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
  onMediaTypeChange,
  onDeckChange,
  onRegionChange,
  searchInput,
  onSearchChange,
  onLogin,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/5">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display hidden text-lg font-bold tracking-tight text-white sm:block">
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
                  ? "bg-indigo-500/90 text-white shadow-[0_4px_12px_-4px_rgba(99,102,241,0.85)]"
                  : "text-slate-500 hover:text-slate-300"
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
                deckId === deck.id
                  ? "brand-gradient text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.8)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {deck.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {viewer ? (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1">
              <img
                src={viewer.avatar?.large ?? undefined}
                alt=""
                className="h-6 w-6 rounded-full bg-white/10 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="hidden max-w-[90px] truncate text-xs font-medium text-slate-300 sm:block">
                {viewer.name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className="grid h-6 w-6 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="brand-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.8)] transition hover:scale-105"
            >
              Log in
            </button>
          )}
        </div>
      </div>

      {/* Manga/manhwa/manhua origin filter — manga decks only */}
      {mediaType === "MANGA" && (
        <div className="border-t border-white/5">
          <div className="no-scrollbar mx-auto flex w-full max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-1.5">
            <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                    ? "border border-indigo-400/60 bg-indigo-500/20 text-indigo-200"
                    : "border border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {deckId === "search" && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-indigo-400/50">
            <SearchIcon className="h-4 w-4 text-slate-500" />
            <input
              autoFocus
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                mediaType === "MANGA"
                  ? `Search ${regionDef(region).term} titles… (e.g. ${regionDef(region).example})`
                  : "Search anime titles… (e.g. Frieren)"
              }
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
      )}
    </header>
  );
}
