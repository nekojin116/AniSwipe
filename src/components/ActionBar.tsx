import type { MediaType } from "../lib/anilist";
import { BookmarkIcon, CheckIcon, UndoIcon, XIcon } from "./icons";

interface Props {
  mediaType: MediaType;
  onUndo: () => void;
  onSkip: () => void;
  onPlan: () => void;
  onWatched: () => void;
  canUndo: boolean;
  disabled: boolean;
}

export default function ActionBar({
  mediaType,
  onUndo,
  onSkip,
  onPlan,
  onWatched,
  canUndo,
  disabled,
}: Props) {
  const isManga = mediaType === "MANGA";
  const noun = isManga ? "manga" : "anime";
  const watchedTitle = isManga ? "Mark as read (→)" : "Mark as watched (→)";
  const planTitle = isManga ? "Plan to read (↑)" : "Plan to watch (↑)";

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo last action (Z)"
        aria-label="Undo last action"
        className="glass grid h-11 w-11 place-items-center rounded-full text-stone-500 transition hover:scale-105 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-30"
      >
        <UndoIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        title="Skip (←)"
        aria-label={`Skip this ${noun}`}
        className="glass grid h-14 w-14 place-items-center rounded-full text-nope transition hover:scale-110 hover:bg-rose-500/10 active:scale-95 disabled:opacity-30"
      >
        <XIcon className="h-6 w-6" />
      </button>

      <button
        type="button"
        onClick={onPlan}
        disabled={disabled}
        title={planTitle}
        aria-label={isManga ? "Add to plan to read" : "Add to plan to watch"}
        className="glass grid h-14 w-14 place-items-center rounded-full text-plan transition hover:scale-110 hover:bg-amber-500/10 active:scale-95 disabled:opacity-30"
      >
        <BookmarkIcon className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onWatched}
        disabled={disabled}
        title={watchedTitle}
        aria-label={isManga ? "Mark as read" : "Mark as watched"}
        className="brand-gradient grid h-16 w-16 place-items-center rounded-full text-white shadow-[0_10px_30px_-8px_rgba(225,29,72,0.55)] transition hover:scale-105 active:scale-95 disabled:opacity-30"
      >
        <CheckIcon className="h-7 w-7" strokeWidth={2.6} />
      </button>

      <span className="ml-1 hidden select-none text-[11px] leading-tight text-stone-500 sm:block">
        ← skip
        <br />→ {isManga ? "read" : "watched"}
        <br />↑ plan
      </span>
    </div>
  );
}
