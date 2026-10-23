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
        <h2 className="font-display text-sm font-semibold text-stone-800">
          Categories
        </h2>
        {hasSelection && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-stone-500 transition hover:text-stone-700"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-stone-500">
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
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                  : "border-stone-900/10 bg-stone-900/5 text-stone-500 hover:bg-stone-900/10 hover:text-stone-700"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-stone-900/10 pt-3 text-[11px] text-stone-500 transition hover:text-stone-700">
        <input
          type="checkbox"
          checked={randomize}
          onChange={(e) => onRandomizeChange(e.target.checked)}
          className="h-3 w-3 accent-rose-600"
        />
        Shuffle results
      </label>
    </aside>
  );
}
