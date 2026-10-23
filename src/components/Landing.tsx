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
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-14">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-14 lg:flex-row lg:gap-16">
        {/* Copy */}
        <div className="flex max-w-xl flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600">
            <LogoMark className="h-4 w-4" />
            Powered by the AniList API
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            Log your anime
            <br />
            <span className="gradient-text">with a single swipe.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-stone-500">
            AniSwipe turns backfilling your AniList history into a ten-second game. Swipe right on
            what you&apos;ve watched, left on what you haven&apos;t. That&apos;s it.
          </p>

          <ul className="mt-7 flex flex-col gap-3 text-left">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-3 text-sm text-stone-600">
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
              className="brand-gradient group inline-flex items-center gap-3 rounded-2xl px-7 py-4 font-display text-base font-semibold text-white shadow-[0_18px_45px_-15px_rgba(225,29,72,0.6)] transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BoltIcon className="h-5 w-5 transition group-hover:rotate-12" />
              Continue with AniList
            </button>
            <button
              type="button"
              onClick={onBrowse}
              className="text-sm font-medium text-stone-500 underline-offset-4 transition hover:text-stone-900 hover:underline"
            >
              or just browse the deck first →
            </button>
            <p className="text-xs text-stone-500">
              You&apos;ll approve access on anilist.co — no passwords shared.
            </p>
          </div>

          {notice && (
            <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-400/15 px-4 py-3 text-sm text-amber-800">
              {notice}
            </div>
          )}

          {configMissing && (
            <div className="mt-4 max-w-md rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-700">
              <strong className="font-semibold">App not configured.</strong> Create an application at{" "}
              <a
                href="https://anilist.co/settings/developer"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-rose-800"
              >
                anilist.co/settings/developer
              </a>{" "}
              and set <code className="rounded bg-stone-900/10 px-1">VITE_ANILIST_CLIENT_ID</code> in your{" "}
              <code className="rounded bg-stone-900/10 px-1">.env</code> file (see README).
            </div>
          )}
        </div>

        {/* Mock card stack */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative h-[420px] w-[300px]">
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-6 top-4 h-[380px] w-[272px] -rotate-6 rounded-[26px] border border-stone-900/10 bg-gradient-to-br from-rose-400/30 via-rose-500/20 to-pink-400/30 shadow-2xl"
            />
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="absolute right-4 top-8 h-[380px] w-[272px] rotate-[7deg] rounded-[26px] border border-stone-900/10 bg-gradient-to-br from-pink-400/25 via-rose-500/15 to-amber-400/20 shadow-2xl"
            />
            <motion.div
              initial={{ y: 26, opacity: 0, rotate: -3 }}
              animate={{ y: 0, opacity: 1, rotate: -1.5 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 160, damping: 20 }}
              className="glass-strong absolute left-1/2 top-1/2 h-[390px] w-[280px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] shadow-[0_40px_80px_-30px_rgba(28,25,23,0.4)]"
            >
              <div className="h-[58%] w-full bg-gradient-to-br from-rose-500 via-rose-600 to-pink-500 opacity-70" />
              <div className="space-y-2 p-4">
                <div className="h-3.5 w-3/4 rounded-full bg-stone-900/60" />
                <div className="h-2.5 w-1/2 rounded-full bg-stone-900/25" />
                <div className="h-2.5 w-2/3 rounded-full bg-stone-900/20" />
                <div className="flex gap-1.5 pt-1">
                  <span className="h-4 w-12 rounded-full bg-stone-900/10" />
                  <span className="h-4 w-14 rounded-full bg-stone-900/10" />
                  <span className="h-4 w-10 rounded-full bg-stone-900/10" />
                </div>
                <div className="h-2 w-full rounded-full bg-stone-900/10" />
                <div className="h-2 w-5/6 rounded-full bg-stone-900/10" />
              </div>
              <div className="absolute left-4 top-4 -rotate-[14deg] rounded-lg border-[3px] border-rose-500/90 px-2.5 py-1 font-display text-lg font-bold tracking-widest text-rose-600">
                <span className="inline-flex items-center gap-1">
                  <CheckIcon className="h-4 w-4" /> WATCHED
                </span>
              </div>
              <div className="absolute bottom-4 right-4 rotate-[12deg] rounded-lg border-[3px] border-stone-400/80 px-2.5 py-1 font-display text-base font-bold tracking-widest text-stone-500">
                <span className="inline-flex items-center gap-1">
                  <XIcon className="h-4 w-4" /> SKIP
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer — privacy + run locally */}
      <div className="mt-14 flex w-full flex-col items-center gap-6 border-t border-stone-900/10 pt-5 text-center sm:flex-row sm:justify-between sm:gap-10 sm:text-left">
        <div className="flex max-w-sm flex-col items-center gap-1.5 sm:items-start">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Privacy
          </p>
          <p className="text-xs leading-relaxed text-stone-500">
            Open source, no trackers, no analytics — your AniList token never leaves your browser.{" "}
            <a
              href="https://github.com/nekojin116/AniSwipe"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rose-600 underline-offset-2 hover:underline"
            >
              Read the code on GitHub ↗
            </a>
          </p>
        </div>

        <div className="flex max-w-sm flex-col items-center gap-1.5 sm:items-end sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Run it locally
          </p>
          <ol className="flex flex-col gap-1 text-xs leading-relaxed text-stone-500">
            <li>
              1. Create an app at{" "}
              <a
                href="https://anilist.co/settings/developer"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-rose-600 underline-offset-2 hover:underline"
              >
                anilist.co/settings/developer
              </a>{" "}
              (redirect URL <code className="rounded bg-stone-900/10 px-1">http://localhost:5173/</code>)
            </li>
            <li>
              2. <code className="rounded bg-stone-900/10 px-1">cp .env.example .env</code> and fill in
              your credentials
            </li>
            <li>
              3. <code className="rounded bg-stone-900/10 px-1">npm install &amp;&amp; npm run dev</code>{" "}
              → open <code className="rounded bg-stone-900/10 px-1">localhost:5173</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
