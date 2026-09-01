"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveMarketCard } from "@/hooks/useMarkets";
import { fmtCountdown, fmtProb } from "@/lib/format";

const PRESETS = [5, 25, 100];

export function TradePanel({
  card,
  onTrade,
  busy,
  lastResult,
}: {
  card: LiveMarketCard | null;
  onTrade: (side: "UP" | "DOWN", size: number) => void;
  busy: boolean;
  lastResult: string | null;
}) {
  const [side, setSide] = useState<"UP" | "DOWN">("UP");
  const [size, setSize] = useState<number>(5);
  const [custom, setCustom] = useState<string>("");
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const secsLeft = card ? Math.max(0, Math.floor(card.expiry - now)) : 0;
  const prob = card?.mid;
  // Payout preview: you pay size * price (for UP) or size*(1-price) is collateral? For binary, 1 contract costs probability (e.g. 0.62). If you buy 5 contracts at 0.62 you pay 3.1 USDso and redeem 5 if win. Our size is "contracts" in MVP (user thinks contracts). Show cost & payout.
  const preview = useMemo(() => {
    if (!card || prob === undefined) return null;
    const price = side === "UP" ? prob : 1 - prob;
    const cost = size * price;
    const payout = size * 1;
    const profit = payout - cost;
    return { price, cost, payout, profit };
  }, [card, prob, side, size]);

  if (!card) {
    return (
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-zinc-400 text-sm">Select a window to trade.</div>
    );
  }

  const locked = secsLeft <= 30;

  return (
    <div className="rounded-3xl bg-white text-black p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Call it</h3>
        <span className={`text-xs font-mono px-2.5 py-1 rounded-full ${locked ? "bg-red-500 text-white" : "bg-black text-white"}`}>
          {fmtCountdown(card.expiry, now)} left
        </span>
      </div>

      <p className="text-sm text-zinc-600 leading-relaxed">
        {card.asset} closes <span className="font-semibold text-black">{side === "UP" ? "at or above" : "below"}</span> its opening price. Win = 1 USDso per contract.
      </p>

      {/* side toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-2xl">
        {(["UP", "DOWN"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`py-3 rounded-xl font-bold text-sm transition ${side === s ? (s === "UP" ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "bg-transparent text-zinc-500 hover:text-black"}`}
          >
            {s} {prob !== undefined ? `· ${fmtProb(s === "UP" ? prob : 1 - prob!)}` : ""}
          </button>
        ))}
      </div>

      {/* size presets */}
      <div>
        <div className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">SIZE (CONTRACTS)</div>
        <div className="flex gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setSize(v);
                setCustom("");
              }}
              className={`flex-1 py-3 rounded-xl font-mono font-bold border transition ${size === v && custom === "" ? "bg-black text-white border-black" : "bg-white text-black border-zinc-200 hover:border-zinc-300"}`}
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
            className="flex-1 min-w-0 py-3 px-3 rounded-xl font-mono font-bold border border-zinc-200 bg-white text-center placeholder:text-zinc-400 focus:outline-none focus:border-black"
          />
        </div>
      </div>

      {/* preview */}
      {preview && (
        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] tracking-widest font-semibold text-zinc-500">PRICE</div>
            <div className="font-mono font-bold">{fmtProb(preview.price)}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest font-semibold text-zinc-500">COST</div>
            <div className="font-mono font-bold">${preview.cost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest font-semibold text-emerald-600">TO WIN</div>
            <div className="font-mono font-bold text-emerald-600">+${preview.profit.toFixed(2)}</div>
          </div>
        </div>
      )}

      <button
        disabled={busy || locked || !preview}
        onClick={() => onTrade(side, size)}
        className={`w-full py-4 rounded-2xl font-bold text-base transition flex items-center justify-center gap-2 ${locked ? "bg-zinc-200 text-zinc-400 cursor-not-allowed" : side === "UP" ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-red-500 text-white hover:bg-red-600"} disabled:opacity-60`}
      >
        {busy ? (
          "Signing…"
        ) : locked ? (
          "Locked — next window soon"
        ) : (
          <>
            Place {side} · {size} <span className="opacity-70 font-normal">→ win ${preview ? (size - preview.cost).toFixed(2) : "—"}</span>
          </>
        )}
      </button>

      {lastResult && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-mono text-amber-900 break-words">{lastResult}</div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-500">
        IOC order at market (ask + 2¢). Capped risk: max loss = cost. Zero fees. Settlement via Somnia oracle —{" "}
        {card.oracleQuestionId ? (
          <a href={`https://prd.oracle.somnia.host/questions/${card.oracleQuestionId}?view=graph`} target="_blank" rel="noreferrer" className="underline">
            audit trail
          </a>
        ) : (
          "auditable"
        )}
        .
      </p>
    </div>
  );
}
