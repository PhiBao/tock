"use client";

import { useEffect, useState } from "react";

export type BinancePoint = { t: number; close: number };

async function fetchWindowCloses(asset: string, tradingStart: number, expiry: number): Promise<BinancePoint[] | null> {
  try {
    const symbol = asset === "BTC" ? "BTCUSDT" : "ETHUSDT";
    const url =
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m` +
      `&startTime=${tradingStart * 1000}&endTime=${expiry * 1000}&limit=60`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const klines: Array<Array<string | number>> = await res.json();
    return klines.map((k) => ({ t: Number(k[0]), close: Number(k[4]) })).filter((p) => Number.isFinite(p.close));
  } catch {
    return null;
  }
}

export function useBinanceWindow(asset: string, tradingStart: number, expiry: number, pollMs = 15000) {
  const [points, setPoints] = useState<BinancePoint[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const p = await fetchWindowCloses(asset, tradingStart, expiry);
      if (alive && p && p.length) setPoints(p);
    };
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [asset, tradingStart, expiry, pollMs]);
  return points;
}

function pathFor(points: BinancePoint[], w: number, h: number): { line: string; area: string; min: number; max: number } {
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const xy = closes.map((p, i) => {
    const x = (i / (closes.length - 1)) * w;
    const y = h - 4 - ((p - min) / range) * (h - 8);
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L ${w} ${h} L 0 ${h} Z`, min, max };
}

/** Spot-price context for the selected window. Settlement always uses the
 *  DreamDEX oracle median — this chart is orientation, not truth. */
export function LivePriceSpark({
  asset,
  tradingStart,
  expiry,
}: {
  asset: string;
  tradingStart: number;
  expiry: number;
}) {
  const points = useBinanceWindow(asset, tradingStart, expiry);

  if (!points || points.length < 2) {
    return <div className="grid h-20 place-items-center text-xs text-zinc-600">Loading spot context…</div>;
  }
  const w = 600;
  const h = 84;
  const { line, area, max } = pathFor(points, w, h);
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const up = last >= first;
  const stroke = up ? "#34d399" : "#f87171";
  const gid = `spark-${asset}`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label={`${asset} spot price trend`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-zinc-500">
        <span className="tabular-nums">{first.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span className={`font-bold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
          {last.toLocaleString(undefined, { maximumFractionDigits: 2 })} {up ? "▲" : "▼"}{" "}
          {(((last - first) / first) * 100).toFixed(2)}%
        </span>
        <span className="tabular-nums">{max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
        Binance spot for orientation — settlement uses the DreamDEX oracle median.
      </p>
    </div>
  );
}
