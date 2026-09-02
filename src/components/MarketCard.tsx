"use client";

import { motion } from "framer-motion";
import { useNow } from "@/hooks/useNow";
import { fmtCountdown, fmtProb, intervalLabel } from "@/lib/format";
import { LOCK_HEADROOM_SEC } from "@/lib/orderMath";
import type { LiveMarketCard } from "@/hooks/useMarkets";

export function MarketCard({
  card,
  isActive,
  onSelect,
}: {
  card: LiveMarketCard;
  isActive: boolean;
  onSelect: () => void;
}) {
  const now = useNow(1000);
  const secsLeft = Math.max(0, Math.floor(card.expiry - now));
  const pct = Math.min(100, Math.max(0, (1 - secsLeft / Math.max(1, card.intervalSec)) * 100));
  const prob = card.mid;
  const isUrgent = secsLeft <= 60;
  const isLocked = secsLeft <= LOCK_HEADROOM_SEC;
  const needle = Math.min(98, Math.max(2, (prob ?? 0.5) * 100));

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      aria-pressed={isActive}
      className={`relative w-full overflow-hidden rounded-3xl border p-4 text-left transition-colors ${
        isActive
          ? "border-gold/60 bg-panel2 shadow-[0_0_32px_-8px_rgba(251,191,36,0.35)]"
          : "border-white/[0.07] bg-panel hover:border-white/20"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-white/5">
        <div
          className={`h-full transition-[width] duration-1000 ${isLocked ? "bg-red-400" : isUrgent ? "bg-gold" : "bg-emerald-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-10 w-10 place-items-center rounded-2xl text-lg font-black ${
              isActive ? "bg-gold text-black" : "bg-white/10 text-white"
            }`}
          >
            {card.asset === "BTC" ? "₿" : "Ξ"}
          </span>
          <div>
            <div className="font-display text-sm font-bold leading-none text-white">
              {card.asset} · {intervalLabel(card.intervalSec)}
            </div>
            <div className={`mt-1 font-mono text-xs tabular-nums ${isLocked ? "text-red-400" : isUrgent ? "text-gold" : "text-zinc-400"}`}>
              {isLocked ? "locked" : `${fmtCountdown(card.expiry, now)} left`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-xl font-bold tabular-nums leading-none ${prob === undefined ? "text-zinc-600" : "text-white"}`}>
            {fmtProb(prob)}
          </div>
          <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-zinc-500">UP PROB</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gradient-to-r from-emerald-500/80 to-emerald-400/80" />
            <div className="flex-1 bg-gradient-to-r from-red-400/80 to-red-500/80" />
          </div>
          <motion.div
            className="absolute bottom-0 top-0 w-[3px] rounded bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            animate={{ left: `calc(${needle}% - 1px)` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-zinc-500">
          {card.bestBid !== undefined && card.bestAsk !== undefined ? `${fmtProb(card.bestBid)}/${fmtProb(card.bestAsk)}` : "—"}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            isLocked ? "bg-red-500/15 text-red-300" : isUrgent ? "bg-gold/15 text-gold" : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          {isLocked ? "Locked" : isUrgent ? "Final seconds" : "Trading"}
        </span>
        <span className="font-mono text-[10px] text-zinc-600">#{card.marketId.slice(-6)}</span>
      </div>
    </motion.button>
  );
}
