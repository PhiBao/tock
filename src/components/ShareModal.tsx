"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ShareModal({
  open,
  imgSrc,
  onDownload,
  onClose,
}: {
  open: boolean;
  imgSrc: string | null;
  onDownload: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && imgSrc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Share streak preview"
        >
          <button
            aria-label="Close preview"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            tabIndex={-1}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-panel p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Your streak card</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-lg leading-none text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>
            {/* data-URL rendered at runtime — next/image cannot optimize it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt="Tock streak share card preview"
              className="w-full rounded-2xl border border-white/10"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={onDownload}
                className="flex-1 rounded-xl bg-gold py-3 text-sm font-black text-black transition hover:bg-amber-300 active:scale-[0.99]"
              >
                Download
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 active:scale-[0.99]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
