import { AnimatePresence, motion } from "framer-motion";
import { AlertIcon, CheckIcon } from "./icons";

export interface ToastState {
  id: number;
  message: string;
  kind: "ok" | "err" | "info";
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: 24, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`glass-strong flex max-w-[92vw] items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-2xl ${
              toast.kind === "err"
                ? "text-rose-300"
                : toast.kind === "ok"
                  ? "text-emerald-300"
                  : "text-slate-200"
            }`}
          >
            {toast.kind === "err" ? (
              <AlertIcon className="h-4 w-4 shrink-0" />
            ) : (
              <CheckIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="line-clamp-2">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
