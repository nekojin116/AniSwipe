import { GENRES } from "../lib/anilist";

interface Props {
  /** Currently selected genre display-form names. */
  selected: string[];
  onToggle: (genre: string) => void;
  onClear: () => void;
  /** Randomize which titles the category browse surfaces. */
  randomize: boolean;
  onRandomizeChange: (value: boolean) => void;
  /** Shown on narrow screens as a collapsible drawer. */
  mediaTypeLabel: string;
}

/**
 * Category filter rail for the search deck. Selecting categories switches the
 * deck into a randomized browse of matching titles (live — no apply button).
 */
export default function CategoryFilter({
  selected,
  onToggle,
  onClear,
  randomize,
  onRandomizeChange,
  mediaTypeLabel,
}: Props) {
  const hasSelection = selected.length > 0;

  return (
    <aside
      className="glass w-full shrink-0 rounded-2xl p-4 lg:w-64"
      aria-label="Category filters"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-slate-200">
          Categories
        </h2>
        {hasSelection && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        {hasSelection
          ? `Browsing random ${mediaTypeLabel} matching your picks.`
          : `Pick one or more to browse random ${mediaTypeLabel} by category.`}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {GENRES.map((genre) => {
          const active = selected.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(genre)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-500 transition hover:text-slate-300">
        <input
          type="checkbox"
          checked={randomize}
          onChange={(e) => onRandomizeChange(e.target.checked)}
          className="h-3 w-3 accent-indigo-500"
        />
        Shuffle results
      </label>
    </aside>
  );
}
