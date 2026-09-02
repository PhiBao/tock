"use client";

import { motion } from "framer-motion";
import { useNow } from "@/hooks/useNow";
import { fmtCountdown, fmtProb, intervalLabel, secsLeftLabel } from "@/lib/format";
import type { LiveMarketCard } from "@/hooks/useMarkets";

/** Countdown hero. One headline, one live number, one CTA — the window
 *  closing is the product, so it owns the top of the page. */
export function Hero({ card }: { card: LiveMarketCard | null }) {
  const now = useNow(500);
  const secs = card ? Math.max(0, Math.floor(card.expiry - now)) : 0;
  const urgent = card != null && secs <= 60;
  const locked = card != null && secs <= 30;
  const pct = card ? Math.min(100, Math.max(0, (1 - secs / Math.max(1, card.intervalSec)) * 100)) : 0;

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-2 pt-8 sm:pt-12 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="text-[11px] font-bold tracking-[0.24em] text-gold">DREAMDEX EVENT CONTRACTS · SOMNIA</p>
        <h1 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
          Call the next
          <br />
          15 minutes.
        </h1>
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-zinc-400">
          One-tap UP/DOWN on BTC and ETH windows. Zero fees, self-custody, settled on-chain.
        </p>
        <div className="mt-5 flex gap-2">
          <a
            href="#trade"
            className="rounded-full bg-gold px-6 py-3 text-sm font-bold text-black transition hover:bg-amber-300 active:scale-[0.98]"
          >
            Place a call
          </a>
          <a
            href="#how"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white active:scale-[0.98]"
          >
            How it works
          </a>
        </div>
      </div>

      <motion.div
        key={card?.marketId ?? "empty"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-panel p-5 sm:p-6"
        aria-live="off"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-white/5">
          <div
            className={`h-full transition-[width] duration-500 ${locked ? "bg-red-400" : urgent ? "bg-gold" : "bg-emerald-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!card ? (
          <div className="grid h-40 place-items-center text-sm text-zinc-500">Waiting for the next window…</div>
        ) : (
          <>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold text-xl font-black text-black">
                  {card.asset === "BTC" ? "₿" : "Ξ"}
                </span>
                <div>
                  <div className="font-display text-base font-bold leading-none">
                    {card.asset} · {intervalLabel(card.intervalSec)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {locked ? "Locked — next window forming" : urgent ? "Final seconds" : "Trading now"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold tabular-nums text-white">{fmtProb(card.mid)}</div>
                <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500">UP PROB</div>
              </div>
            </div>
            <div
              className={`mt-4 font-mono font-bold tabular-nums leading-none tracking-tight ${
                locked ? "text-red-400" : "text-6xl text-white sm:text-7xl"
              } ${locked ? "text-5xl sm:text-6xl" : ""}`}
            >
              {fmtCountdown(card.expiry, now)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>{secsLeftLabel(secs)} until settlement</span>
              <span className="font-mono">
                {card.bestBid !== undefined && card.bestAsk !== undefined
                  ? `BBO ${fmtProb(card.bestBid)} / ${fmtProb(card.bestAsk)}`
                  : "book forming"}
              </span>
            </div>
          </>
        )}
      </motion.div>
    </section>
  );
}
