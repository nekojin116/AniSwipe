import { motion } from "framer-motion";
import { BoltIcon, CheckIcon, LogoMark, XIcon } from "./icons";

interface Props {
  onLogin: () => void;
  onBrowse: () => void;
  notice?: string | null;
  configMissing: boolean;
}

const FEATURES = [
  { icon: "✓", text: "Right swipe = marked as watched (or read) on AniList, instantly" },
  { icon: "⇅", text: "Anime & manga decks — Popular, Top rated, Season/Ongoing, plus search" },
  { icon: "↩", text: "One-tap undo, keyboard shortcuts, no list clutter" },
];

export default function Landing({ onLogin, onBrowse, notice, configMissing }: Props) {
  return (
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col items-center justify-center gap-14 px-6 py-14 lg:flex-row lg:gap-16">
      {/* Copy */}
      <div className="flex max-w-xl flex-1 flex-col items-center text-center lg:items-start lg:text-left">
        <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300">
          <LogoMark className="h-4 w-4" />
          Powered by the AniList API
        </div>

        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Log your anime
          <br />
          <span className="gradient-text">with a single swipe.</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
          AniSwipe turns backfilling your AniList history into a ten-second game. Swipe right on
          what you&apos;ve watched, left on what you haven&apos;t. That&apos;s it.
        </p>

        <ul className="mt-7 flex flex-col gap-3 text-left">
          {FEATURES.map((feature) => (
            <li key={feature.text} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="brand-gradient grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                {feature.icon}
              </span>
              {feature.text}
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-col items-center gap-3 lg:items-start">
          <button
            type="button"
            onClick={onLogin}
            disabled={configMissing}
            className="brand-gradient group inline-flex items-center gap-3 rounded-2xl px-7 py-4 font-display text-base font-semibold text-white shadow-[0_18px_45px_-15px_rgba(99,102,241,0.9)] transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BoltIcon className="h-5 w-5 transition group-hover:rotate-12" />
            Continue with AniList
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="text-sm font-medium text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
          >
            or just browse the deck first →
          </button>
          <p className="text-xs text-slate-500">
            You&apos;ll approve access on anilist.co — no passwords shared.
          </p>
        </div>

        {notice && (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {notice}
          </div>
        )}

        {configMissing && (
          <div className="mt-4 max-w-md rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-200">
            <strong className="font-semibold">App not configured.</strong> Create an application at{" "}
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-rose-100"
            >
              anilist.co/settings/developer
            </a>{" "}
            and set <code className="rounded bg-black/30 px-1">VITE_ANILIST_CLIENT_ID</code> in your{" "}
            <code className="rounded bg-black/30 px-1">.env</code> file (see README).
          </div>
        )}
      </div>

      {/* Mock card stack */}
      <div className="relative flex flex-1 items-center justify-center">
        <div className="relative h-[420px] w-[300px]">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-6 top-4 h-[380px] w-[272px] -rotate-6 rounded-[26px] border border-white/10 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/30 shadow-2xl"
          />
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className="absolute right-4 top-8 h-[380px] w-[272px] rotate-[7deg] rounded-[26px] border border-white/10 bg-gradient-to-br from-pink-500/25 via-rose-500/15 to-amber-500/20 shadow-2xl"
          />
          <motion.div
            initial={{ y: 26, opacity: 0, rotate: -3 }}
            animate={{ y: 0, opacity: 1, rotate: -1.5 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 160, damping: 20 }}
            className="glass-strong absolute left-1/2 top-1/2 h-[390px] w-[280px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
          >
            <div className="h-[58%] w-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-70" />
            <div className="space-y-2 p-4">
              <div className="h-3.5 w-3/4 rounded-full bg-white/70" />
              <div className="h-2.5 w-1/2 rounded-full bg-white/25" />
              <div className="h-2.5 w-2/3 rounded-full bg-white/20" />
              <div className="flex gap-1.5 pt-1">
                <span className="h-4 w-12 rounded-full bg-white/10" />
                <span className="h-4 w-14 rounded-full bg-white/10" />
                <span className="h-4 w-10 rounded-full bg-white/10" />
              </div>
              <div className="h-2 w-full rounded-full bg-white/10" />
              <div className="h-2 w-5/6 rounded-full bg-white/10" />
            </div>
            <div className="absolute left-4 top-4 -rotate-[14deg] rounded-lg border-[3px] border-emerald-300/90 px-2.5 py-1 font-display text-lg font-bold tracking-widest text-emerald-300">
              <span className="inline-flex items-center gap-1">
                <CheckIcon className="h-4 w-4" /> WATCHED
              </span>
            </div>
            <div className="absolute bottom-4 right-4 rotate-[12deg] rounded-lg border-[3px] border-rose-300/70 px-2.5 py-1 font-display text-base font-bold tracking-widest text-rose-300">
              <span className="inline-flex items-center gap-1">
                <XIcon className="h-4 w-4" /> SKIP
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
