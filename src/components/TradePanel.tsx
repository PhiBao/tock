"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNow } from "@/hooks/useNow";
import type { LiveMarketCard } from "@/hooks/useMarkets";
import { fmtCountdown, fmtProb } from "@/lib/format";
import { LOCK_HEADROOM_SEC, previewTrade, type Side } from "@/lib/orderMath";
import { oracleExplorerUrl } from "@/config/markets";
import { CHAIN_BY_ID } from "@/config/chains";
import type { TradeNotice } from "@/hooks/useTrade";

const PRESETS = [5, 25, 100];

export function TradePanel({
  card,
  chainId,
  onTrade,
  busy,
  notice,
  autoApprove,
  setAutoApprove,
}: {
  card: LiveMarketCard | null;
  chainId: number;
  onTrade: (side: Side, size: number) => void;
  busy: boolean;
  notice: TradeNotice | null;
  autoApprove?: boolean;
  setAutoApprove?: (v: boolean) => void;
}) {
  const [side, setSide] = useState<Side>("UP");
  const [size, setSize] = useState<number>(5);
  const [custom, setCustom] = useState<string>("");
  const now = useNow(1000);

  const secsLeft = card ? Math.max(0, Math.floor(card.expiry - now)) : 0;
  const prob = card?.mid;
  const preview = useMemo(
    () => (card ? previewTrade(size, prob, side) : null),
    [card, size, prob, side]
  );

  if (!card) {
    return (
      <div className="rounded-3xl border border-white/[0.07] bg-panel p-6 text-sm text-zinc-500">
        Select a window to trade.
      </div>
    );
  }

  const locked = secsLeft <= LOCK_HEADROOM_SEC;
  const explorer = CHAIN_BY_ID[chainId]?.blockExplorers?.default.url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-panel2 p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">Call it</h3>
        <motion.span
          key={Math.floor(secsLeft / 60)}
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
            locked ? "animate-pulse bg-red-500/20 text-red-300" : "bg-white/10 text-white"
          }`}
        >
          {fmtCountdown(card.expiry, now)} left
        </motion.span>
      </div>

      <p className="text-sm leading-relaxed text-zinc-400">
        {card.asset} closes{" "}
        <span className="font-semibold text-white">{side === "UP" ? "at or above" : "below"}</span> its opening
        price. Win = 1 per contract. You can only lose what you put in.
      </p>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-1.5" role="group" aria-label="Direction">
        {(["UP", "DOWN"] as const).map((s) => (
          <motion.button
            key={s}
            onClick={() => setSide(s)}
            whileTap={{ scale: 0.97 }}
            aria-pressed={side === s}
            className={`rounded-xl py-3.5 text-sm font-black transition active:scale-[0.98] ${
              side === s
                ? s === "UP"
                  ? "bg-emerald-500 text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]"
                  : "bg-red-500 text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.7)]"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            {s}{" "}
            <span className="font-mono font-bold tabular-nums opacity-80">
              {prob !== undefined ? fmtProb(s === "UP" ? prob : 1 - prob) : ""}
            </span>
          </motion.button>
        ))}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-zinc-500">SIZE · CONTRACTS</div>
        <div className="flex gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setSize(v);
                setCustom("");
              }}
              aria-pressed={size === v && custom === ""}
              className={`flex-1 rounded-xl border py-3 font-mono text-sm font-bold tabular-nums transition active:scale-[0.98] ${
                size === v && custom === ""
                  ? "border-gold/70 bg-gold/10 text-gold"
                  : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/25"
              }`}
            >
              {v}
            </button>
          ))}
          <input
            value={custom}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              setCustom(val);
              const n = Number(val);
              if (Number.isFinite(n) && n > 0) setSize(n);
            }}
            placeholder="Custom"
            inputMode="decimal"
            aria-label="Custom size in contracts"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center font-mono text-sm font-bold tabular-nums text-white placeholder:text-zinc-600 focus:border-gold/60 focus:outline-none"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {preview && (
          <motion.div
            key={`${preview.price.toFixed(3)}-${preview.cost.toFixed(2)}-${side}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-3 gap-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4 text-center"
          >
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] text-zinc-500">PRICE</div>
              <div className="font-mono font-bold tabular-nums text-white">{fmtProb(preview.price)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] text-zinc-500">COST</div>
              <div className="font-mono font-bold tabular-nums text-white">${preview.cost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">TO WIN</div>
              <div className="font-mono font-bold tabular-nums text-emerald-400">+${preview.profit.toFixed(2)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {setAutoApprove !== undefined && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5 transition hover:border-white/15">
          <input
            type="checkbox"
            checked={autoApprove ?? true}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="h-4 w-4 rounded accent-amber-400"
          />
          <span className="text-sm font-medium text-zinc-200">Approve once, then one tap</span>
          <span className="ml-auto text-xs text-zinc-500">No per-trade popups</span>
        </label>
      )}

      <motion.button
        disabled={busy || locked || !preview}
        onClick={() => onTrade(side, size)}
        whileTap={!busy && !locked ? { scale: 0.985 } : {}}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black transition active:scale-[0.99] disabled:cursor-not-allowed ${
          locked
            ? "bg-white/5 text-zinc-600"
            : side === "UP"
              ? "bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-60"
              : "bg-red-500 text-white hover:bg-red-400 disabled:opacity-60"
        }`}
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing…
          </span>
        ) : locked ? (
          "Locked — next window soon"
        ) : (
          <>
            Place {side} · {size}{" "}
            <span className="font-mono font-bold tabular-nums opacity-80">
              → win ${preview ? (size - preview.cost).toFixed(2) : "—"}
            </span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`break-words rounded-xl border p-3 font-mono text-xs leading-relaxed ${
              notice.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : notice.kind === "info"
                  ? "border-gold/30 bg-gold/[0.07] text-amber-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {notice.text}{" "}
            {notice.tx && explorer && (
              <a
                href={`${explorer}/tx/${notice.tx}`}
                target="_blank"
                rel="noreferrer"
                className="font-sans font-semibold underline underline-offset-2"
              >
                View tx
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[11px] leading-relaxed text-zinc-600">
        IOC execution — unfilled remainder never rests. No fees.
        {card.oracleQuestionId && (
          <>
            {" "}
            <a
              href={oracleExplorerUrl(card.oracleQuestionId)}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 underline underline-offset-2 hover:text-gold"
            >
              Audit settlement
            </a>
          </>
        )}
      </p>
    </motion.div>
  );
}
