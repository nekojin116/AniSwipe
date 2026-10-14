import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import type { Anime, MediaType } from "../lib/anilist";
import AnimeCard, { type Dir, type PendingSwipe } from "./AnimeCard";

export interface SwipeDeckHandle {
  request: (dir: Dir) => void;
}

interface Props {
  items: Anime[];
  mediaType: MediaType;
  onSwipe: (anime: Anime, dir: Dir) => void;
}

const VISIBLE_CARDS = 4;

const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { items, mediaType, onSwipe },
  ref,
) {
  const [pending, setPending] = useState<PendingSwipe | null>(null);
  const [busy, setBusy] = useState(false);
  const nonceRef = useRef(0);
  const topId = items[0]?.id ?? null;

  const request = useCallback(
    (dir: Dir) => {
      if (busy || items.length === 0) return;
      nonceRef.current += 1;
      setBusy(true);
      setPending({ dir, nonce: nonceRef.current });
    },
    [busy, items.length],
  );

  useImperativeHandle(ref, () => ({ request }), [request]);

  // Clear the pending request the moment the card reports its swipe, so the
  // next card promoted to the top can never inherit it (child effects run
  // before this parent's clearing effect).
  const handleSwipe = useCallback(
    (anime: Anime, dir: Dir) => {
      setPending(null);
      // Also release busy here: if the bulk filter had already removed the
      // swiped card from the queue, topId never changes and the deck would
      // otherwise stay locked.
      setBusy(false);
      onSwipe(anime, dir);
    },
    [onSwipe],
  );

  // The top card animated away and the next one took its place.
  useEffect(() => {
    setBusy(false);
    setPending(null);
  }, [topId]);

  return (
    <div className="relative h-full w-full">
      {items.slice(0, VISIBLE_CARDS).map((anime, index) => (
        <motion.div
          key={anime.id}
          className="absolute inset-0"
          initial={{ scale: 0.93, y: 18, opacity: 0 }}
          animate={{
            scale: 1 - index * 0.04,
            y: index * 14,
            opacity: index === 0 ? 1 : 0.85 - index * 0.12,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          style={{ zIndex: VISIBLE_CARDS - index }}
        >
          <AnimeCard
            anime={anime}
            mediaType={mediaType}
            top={index === 0}
            pending={index === 0 ? pending : null}
            onSwipe={handleSwipe}
          />
        </motion.div>
      ))}
    </div>
  );
});

export default SwipeDeck;
