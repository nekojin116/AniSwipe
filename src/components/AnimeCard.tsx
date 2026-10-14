import { useCallback, useEffect, useRef, useState } from "react";
import { motion, animate, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { Anime, MediaType } from "../lib/anilist";
import { cleanDescription, displayTitle, formatStatus, metaLine, secondaryTitle } from "../lib/format";

export type Dir = "left" | "right" | "up";

export interface PendingSwipe {
  dir: Dir;
  nonce: number;
}

const THRESHOLD = 110;
const VELOCITY = 700;

interface Props {
  anime: Anime;
  mediaType: MediaType;
  top: boolean;
  pending: PendingSwipe | null;
  onSwipe: (anime: Anime, dir: Dir) => void;
}

function decideDir(info: PanInfo): Dir | null {
  const { offset, velocity } = info;
  const absX = Math.abs(offset.x);
  const absY = Math.abs(offset.y);

  if (absY > absX && (offset.y < -THRESHOLD || velocity.y < -VELOCITY)) return "up";
  if (offset.x > THRESHOLD || velocity.x > VELOCITY) return "right";
  if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) return "left";
  return null;
}

export default function AnimeCard({ anime, mediaType, top, pending, onSwipe }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-340, 0, 340], [-17, 0, 17]);

  const likeOpacity = useTransform(x, [30, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -30], [1, 0]);
  const planOpacity = useTransform(y, [-150, -30], [1, 0]);

  const [decided, setDecided] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const decidedRef = useRef(false);
  const notifiedRef = useRef(false);

  const notify = useCallback(
    (dir: Dir) => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      onSwipe(anime, dir);
    },
    [anime, onSwipe],
  );

  const flyOut = useCallback(
    async (dir: Dir) => {
      if (decidedRef.current) return;
      decidedRef.current = true;
      setDecided(true);

      const options = { duration: 0.3, ease: "easeIn" as const };
      const moves =
        dir === "up"
          ? [animate(y, -780, options), animate(opacity, 0, { duration: 0.35 })]
          : [
              animate(x, dir === "right" ? 780 : -780, options),
              animate(y, 70, options),
              animate(opacity, 0, { duration: 0.35 }),
            ];

      await Promise.all(moves.map((m) => m.finished));
      notify(dir);
    },
    [x, y, opacity, notify],
  );

  const snapBack = useCallback(() => {
    const spring = { type: "spring" as const, stiffness: 420, damping: 34 };
    animate(x, 0, spring);
    animate(y, 0, spring);
  }, [x, y]);

  // Buttons / keyboard presses land here.
  useEffect(() => {
    if (!top || !pending) return;
    void flyOut(pending.dir);
  }, [top, pending, flyOut]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const dir = decideDir(info);
    if (dir) void flyOut(dir);
    else snapBack();
  };

  const title = displayTitle(anime);
  const altTitle = secondaryTitle(anime);
  const color = anime.coverImage.color ?? "#6366f1";
  const score = anime.averageScore ? Math.round(anime.averageScore) : null;

  return (
    <motion.div
      className="h-full w-full select-none overflow-hidden rounded-[28px] bg-panel ring-1 ring-white/10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]"
      style={{ opacity }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ x, y, rotate }}
        drag={top && !decided}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        initial={false}
      >
        <div className="flex h-full w-full flex-col">
          {/* Cover art */}
          <div className="relative h-[54%] w-full shrink-0 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(155deg, ${color}55, transparent 65%)` }}
            />
            {imgOk ? (
              <img
                src={anime.coverImage.extraLarge || anime.coverImage.large}
                alt=""
                draggable={false}
                onError={() => setImgOk(false)}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: `linear-gradient(140deg, ${color}, #14141f)` }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#12121c] to-transparent" />

            {score !== null && (
              <div className="glass absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-amber-300">
                ★ {score}%
              </div>
            )}

            {anime.mediaListEntry && (
              <div className="glass absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-200">
                On your list: {formatStatus(anime.mediaListEntry.status, mediaType)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 px-5 pb-5 pt-3">
            <h2 className="font-display line-clamp-2 text-lg font-bold leading-tight text-slate-50">
              {title}
            </h2>
            {altTitle && (
              <p className="line-clamp-1 text-xs text-slate-500" title={altTitle}>
                {altTitle}
              </p>
            )}
            {metaLine(anime) && (
              <p className="text-xs font-medium tracking-wide text-slate-400">{metaLine(anime)}</p>
            )}

            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {anime.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300"
                >
                  {genre}
                </span>
              ))}
            </div>

            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-400">
              {cleanDescription(anime) || "No description available."}
            </p>
          </div>
        </div>

        {/* Swipe stamps */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute left-5 top-5 -rotate-[14deg] rounded-lg border-[3px] border-like px-3 py-1 font-display text-xl font-bold tracking-widest text-like"
        >
          {mediaType === "MANGA" ? "READ" : "WATCHED"}
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="pointer-events-none absolute right-5 top-5 rotate-[14deg] rounded-lg border-[3px] border-nope px-3 py-1 font-display text-xl font-bold tracking-widest text-nope"
        >
          SKIP
        </motion.div>
        <motion.div
          style={{ opacity: planOpacity }}
          className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 -rotate-3 rounded-lg border-[3px] border-plan px-3 py-1 font-display text-xl font-bold tracking-widest text-plan"
        >
          PLAN
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
