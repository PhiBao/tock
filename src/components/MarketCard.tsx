"use client";

import { useEffect, useState } from "react";
import { fmtCountdown, fmtProb, intervalLabel } from "@/lib/format";
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
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const secsLeft = Math.max(0, Math.floor(card.expiry - now));
  const pct = 1 - secsLeft / Math.max(1, card.intervalSec);
  const prob = card.mid;
  const probLabel = fmtProb(prob);
  const closing = fmtCountdown(card.expiry, now);
  const isUrgent = secsLeft <= 60;
  const isLocked = secsLeft <= 30;

  return (
    <button
      onClick={onSelect}
      className={`relative text-left w-full rounded-2xl border p-4 flex flex-col gap-3 transition overflow-hidden ${
        isActive ? "bg-white text-black border-white" : "bg-zinc-900 text-white border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-black/10">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
      </div>

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className={`w-9 h-9 rounded-xl grid place-items-center text-sm font-bold ${isActive ? "bg-black text-white" : "bg-white text-black"}`}>
            {card.asset === "BTC" ? "₿" : "Ξ"}
          </span>
          <div>
            <div className={`text-sm font-semibold leading-none ${isActive ? "text-black" : "text-white"}`}>
              {card.asset} · {intervalLabel(card.intervalSec)}
            </div>
            <div className={`text-xs ${isActive ? "text-zinc-600" : "text-zinc-400"}`}>closes in {closing}</div>
          </div>
        </div>
        <div className={`text-right ${isActive ? "text-black" : "text-white"}`}>
          <div className={`text-lg font-mono font-bold leading-none ${prob === undefined ? "opacity-40" : ""}`}>{probLabel}</div>
          <div className={`text-[10px] tracking-widest font-semibold ${isActive ? "text-zinc-500" : "text-zinc-400"}`}>UP PROB</div>
        </div>
      </div>

      {/* needle */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full ${isActive ? "bg-black/10" : "bg-white/10"} relative overflow-hidden`}>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
            style={{ left: `calc(${Math.min(98, Math.max(2, (prob ?? 0.5) * 100))}% - 1px)`, background: isActive ? "#000" : "#fff" }}
          />
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-emerald-500/70" />
            <div className="flex-1 bg-red-500/70" />
          </div>
        </div>
        <span className={`text-xs font-mono ${isActive ? "text-zinc-600" : "text-zinc-400"}`}>
          {card.bestBid !== undefined && card.bestAsk !== undefined ? `${fmtProb(card.bestBid)} / ${fmtProb(card.bestAsk)}` : "no book yet"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isLocked ? "bg-red-500 text-white" : isUrgent ? "bg-amber-400 text-black" : isActive ? "bg-black text-white" : "bg-white/10 text-white/80"}`}>
          {isLocked ? "Locked" : isUrgent ? "Final seconds" : "Trading"}
        </span>
        <span className={`text-[10px] font-mono ${isActive ? "text-zinc-500" : "text-zinc-500"}`}>{card.marketId.slice(0, 10)}…</span>
      </div>
    </button>
  );
}
