"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createExchange } from "@/lib/somnia";
import { isBinaryMarket } from "@somnia-chain/markets-sdk";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";

export type LiveMarketCard = {
  market: BinaryMarket;
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number; // sec
  tradingStart: number; // sec
  outcomes: { up: string; down: string };
  bestBid?: number;
  bestAsk?: number;
  mid?: number;
  oracleQuestionId?: string;
};

export function useLiveMarkets(chainId: number, enabled = true) {
  const [cards, setCards] = useState<LiveMarketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const ex = createExchange({ chainId });
    try {
      // Use unified layer — gives us symbols via `outcomes` (BinaryMarket raw has no outcomes)
      const all = await ex.loadMarkets(true);
      const unified = Object.values(all).filter((m) => m.type === "binary" && isBinaryMarket(m.info));
      // Filter to BTC/ETH, active only, sort closingSoon
      const filtered = unified
        .filter((m) => {
          const info = m.info as BinaryMarket;
          return (info.asset === "BTC" || info.asset === "ETH") && m.active;
        })
        .sort((a, b) => Number((a.info as BinaryMarket).expiry ?? 0) - Number((b.info as BinaryMarket).expiry ?? 0));

      const next: LiveMarketCard[] = [];
      for (const u of filtered.slice(0, 8)) {
        const r = u.info as BinaryMarket;
        const expiry = Number(r.expiry ?? 0);
        const tradingStart = Number((r as unknown as { tradingStart?: string | number }).tradingStart ?? 0);
        const outs = u.outcomes ?? [];
        const up = outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol ?? "";
        const down = outs.find((o) => o.label === "NO")?.symbol ?? outs[1]?.symbol ?? "";
        let bestBid: number | undefined;
        let bestAsk: number | undefined;
        let mid: number | undefined;
        if (up) {
          try {
            const exAny = ex as unknown as { fetchOrderBook?: (s: string, n: number) => Promise<{ bids: number[][]; asks: number[][] }> };
            if (exAny.fetchOrderBook) {
              const book = await exAny.fetchOrderBook(up, 5);
              bestBid = book.bids?.[0]?.[0];
              bestAsk = book.asks?.[0]?.[0];
              if (bestBid !== undefined && bestAsk !== undefined) mid = (bestBid + bestAsk) / 2;
              else mid = bestBid ?? bestAsk;
            }
          } catch {
            // ignore book errors (no liquidity yet)
          }
        }
        next.push({
          market: r,
          marketId: String(r.marketId),
          asset: String(r.asset),
          intervalSec: Number(r.intervalSec ?? 0),
          expiry,
          tradingStart,
          outcomes: { up, down },
          bestBid,
          bestAsk,
          mid,
          oracleQuestionId: (r as unknown as { oracleQuestionId?: string }).oracleQuestionId ?? undefined,
        });
      }
      if (!abortRef.current) {
        setCards(next);
        setError(null);
      }
    } catch (e) {
      if (!abortRef.current) setError((e as Error).message ?? String(e));
    } finally {
      if (!abortRef.current) setLoading(false);
      try {
        ex.close?.();
      } catch {}
    }
  }, [chainId, enabled]);

  useEffect(() => {
    abortRef.current = false;
    setLoading(true);
    refresh();
    const id = setInterval(refresh, 4000);
    return () => {
      abortRef.current = true;
      clearInterval(id);
    };
  }, [refresh]);

  return { cards, loading, error, refresh };
}
