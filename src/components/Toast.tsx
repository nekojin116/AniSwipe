import { AnimatePresence, motion } from "framer-motion";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export interface ToastState {
  id: number;
  message: string;
  kind: "ok" | "err" | "info";
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`glass-strong flex max-w-[92vw] items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-2xl ${
              toast.kind === "err"
                ? "text-rose-600"
                : toast.kind === "ok"
                  ? "text-emerald-600"
                  : "text-stone-700"
            }`}
          >
            {toast.kind === "err" ? (
              <AlertIcon className="h-4 w-4 shrink-0" />
            ) : toast.kind === "ok" ? (
              <CheckIcon className="h-4 w-4 shrink-0" />
            ) : (
              <InfoIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="line-clamp-2">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
