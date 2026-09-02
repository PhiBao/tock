"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastTone = "ok" | "err" | "info";

export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  desc?: string;
  txUrl?: string;
};

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

const TONE: Record<ToastTone, string> = {
  ok: "border-emerald-500/40",
  err: "border-red-500/40",
  info: "border-amber-400/40",
};

const DOT: Record<ToastTone, string> = {
  ok: "bg-emerald-400",
  err: "bg-red-400",
  info: "bg-amber-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto rounded-2xl border bg-zinc-950/95 p-3 shadow-2xl backdrop-blur ${TONE[t.tone]}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[t.tone]}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{t.title}</div>
                  {t.desc && <div className="mt-0.5 break-words text-xs leading-relaxed text-zinc-400">{t.desc}</div>}
                  {t.txUrl && (
                    <a href={t.txUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-amber-300 underline underline-offset-2">
                      View transaction
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
