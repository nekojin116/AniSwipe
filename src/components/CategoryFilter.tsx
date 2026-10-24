import { GENRES, type BrowseSort } from "../lib/anilist";

interface Props {
  /** Currently selected genre display-form names. */
  selected: string[];
  onToggle: (genre: string) => void;
  onClear: () => void;
  /** How to order the category browse. */
  sortBy: BrowseSort;
  onSortChange: (value: BrowseSort) => void;
  /** Shown on narrow screens as a collapsible drawer. */
  mediaTypeLabel: string;
}

const SORTS: { id: BrowseSort; label: string; hint: string; title: string }[] = [
  {
    id: "popular",
    label: "Popular",
    hint: "The most popular matches come first.",
    title: "Most popular matches first",
  },
  {
    id: "newest",
    label: "Newest",
    hint: "Newest releases come first.",
    title: "Newest releases first",
  },
  {
    id: "random",
    label: "Random",
    hint: "Surfaces deeper, less-known titles.",
    title: "Shuffle the whole result set",
  },
];

/**
 * Category filter rail for the search deck. Selecting categories switches the
 * deck into a live browse of matching titles (no apply button), ordered by the
 * chosen sort.
 */
export default function CategoryFilter({
  selected,
  onToggle,
  onClear,
  sortBy,
  onSortChange,
  mediaTypeLabel,
}: Props) {
  const hasSelection = selected.length > 0;
  const activeSort = SORTS.find((sort) => sort.id === sortBy) ?? SORTS[0];

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
          ? `Browsing ${
              sortBy === "random"
                ? "a random mix of"
                : sortBy === "newest"
                  ? "the newest"
                  : "the most popular"
            } ${mediaTypeLabel} matching your picks.`
          : `Pick one or more to browse ${mediaTypeLabel} by category.`}
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

      <div className="mt-4 border-t border-stone-900/10 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          Sort by
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((sort) => {
            const active = sort.id === sortBy;
            return (
              <button
                key={sort.id}
                type="button"
                aria-pressed={active}
                title={sort.title}
                onClick={() => onSortChange(sort.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                    : "border-stone-900/10 bg-stone-900/5 text-stone-500 hover:bg-stone-900/10 hover:text-stone-700"
                }`}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-stone-500">{activeSort.hint}</p>
      </div>
    </aside>
  );
}
