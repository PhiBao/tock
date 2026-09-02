"use client";

import { useCallback, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { createExchange, addressesForChain } from "@/lib/somnia";
import { COLLATERAL_DECIMALS, COLLATERAL_SYMBOL } from "@/config/markets";
import {
  MIN_LOT,
  snapToLot,
  clampPrice,
  upCrossPrice,
  downCrossPrice,
  isLocked,
  decodeTradeError,
  type Side,
} from "@/lib/orderMath";
import type { LiveMarketCard } from "@/hooks/useMarkets";

export type TradeNotice = {
  kind: "ok" | "err" | "info";
  text: string;
  tx?: string;
};

type WalletClientLike = {
  writeContract: (p: unknown) => Promise<`0x${string}`>;
};

type PublicClientLike = {
  readContract: (args: never) => Promise<bigint>;
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<unknown>;
};

type UseTradeOpts = {
  chainId: number;
  address?: `0x${string}`;
  isConnected: boolean;
  walletClient?: unknown;
  /** wagmi public client (cast internally — avoids viem generic friction) */
  publicClient?: unknown;
  selected: LiveMarketCard | null;
  autoApprove: boolean;
  refresh: () => void;
  onPlaced?: (t: { asset: string; direction: Side; stake: number }) => void;
};

/** Manual one-tap trade executor. Gates on on-chain status + lock headroom,
 *  ensures a single one-time pool approval, then places an IOC taker that
 *  crosses the spread. Unfilled remainder never rests. */
export function useTrade(opts: UseTradeOpts) {
  const { chainId, address, isConnected, walletClient, selected, autoApprove, refresh, onPlaced } = opts;
  const publicClient = opts.publicClient as PublicClientLike | undefined | null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<TradeNotice | null>(null);

  const trade = useCallback(
    async (side: Side, size: number) => {
      if (!selected) return;
      if (!isConnected || !walletClient || !address) {
        setNotice({ kind: "err", text: "Connect a wallet first." });
        return;
      }
      if (size <= 0) {
        setNotice({ kind: "err", text: "Size must be > 0." });
        return;
      }
      setBusy(true);
      setNotice(null);
      const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
      try {
        // Gate on on-chain status + headroom
        const onchain = await ex.client.getMarketOnchain(selected.marketId as `0x${string}`);
        const status = (onchain as unknown as { status: number }).status;
        if (status !== 1) {
          setNotice({ kind: "err", text: `Market not trading (status ${status}). Try the next window.` });
          return;
        }
        if (isLocked(selected.expiry, Date.now() / 1000)) {
          setNotice({ kind: "err", text: "Window locked — under 30s left. The next window opens momentarily." });
          return;
        }

        const symbol = side === "UP" ? selected.outcomes.up : selected.outcomes.down;
        if (!symbol) {
          setNotice({ kind: "err", text: "No symbol for side — market row missing outcomes." });
          return;
        }

        // Quantize size to lot grid (SDK also snaps, but we pre-check zero).
        const snapped = snapToLot(size, MIN_LOT);
        if (snapped < MIN_LOT) {
          setNotice({ kind: "err", text: `Size below min lot ${MIN_LOT}. Try larger.` });
          return;
        }

        // Exchange needs its market registry populated before createOrder
        // (otherwise "unknown symbol"). Retry once — handles a market rolling
        // between the board poll and this trade.
        try {
          await ex.loadMarkets(true);
        } catch (e) {
          setNotice({ kind: "err", text: `Failed to load markets: ${(e as Error).message.slice(0, 200)}` });
          return;
        }
        const base = symbol.split("#")[0];
        const known = (ex as unknown as { markets?: Record<string, unknown> }).markets;
        if (known && !(base in known) && !(symbol in known)) {
          try {
            await ex.loadMarkets(true);
          } catch {}
          const knownAfter = (ex as unknown as { markets?: Record<string, unknown> }).markets;
          if (knownAfter && !(base in knownAfter) && !(symbol in knownAfter)) {
            refresh();
            setNotice({ kind: "info", text: `Market ${symbol} just rolled — refreshed the board, pick the new window and try again.` });
            return;
          }
        }

        // One-click after first approve: a single max approve to the pool.
        if (publicClient && autoApprove) {
          try {
            const addrs = addressesForChain(chainId);
            const collateral =
              (addrs as unknown as { collateral?: `0x${string}`; testUsdc?: `0x${string}` }).collateral ??
              (addrs as unknown as { testUsdc?: `0x${string}` }).testUsdc;
            const pool = (selected.market as unknown as { poolAddress?: string }).poolAddress as `0x${string}` | undefined;
            if (collateral && pool) {
              const decimals = COLLATERAL_DECIMALS[chainId] ?? 6;
              const needed = parseUnits(String((snapped * 0.99).toFixed(decimals === 6 ? 4 : 6)), decimals);
              const key = `tock:approved:${chainId}:${pool.toLowerCase()}`;
              let already = false;
              try {
                already = localStorage.getItem(key) === "true";
              } catch {}
              if (!already) {
                try {
                  const allowance = (await publicClient.readContract({
                    address: collateral,
                    abi: erc20Abi,
                    functionName: "allowance",
                    args: [address, pool],
                  } as never)) as bigint;
                  if (allowance < needed) {
                    setNotice({ kind: "info", text: `Approving ${COLLATERAL_SYMBOL[chainId] ?? "collateral"} — one-time for this market…` });
                    let hash: `0x${string}`;
                    try {
                      hash = await (walletClient as unknown as WalletClientLike).writeContract({
                        address: collateral,
                        abi: erc20Abi,
                        functionName: "approve",
                        args: [pool, 2n ** 256n - 1n],
                      });
                    } catch (e) {
                      setNotice({ kind: "err", text: `Approve rejected: ${(e as Error).message.slice(0, 200)}` });
                      return;
                    }
                    await publicClient.waitForTransactionReceipt({ hash });
                    try {
                      localStorage.setItem(key, "true");
                    } catch {}
                    setNotice({ kind: "info", text: "Approved — placing order…" });
                  } else {
                    try {
                      localStorage.setItem(key, "true");
                    } catch {}
                  }
                } catch {}
              }
            }
          } catch {}
        } else if (!autoApprove) {
          setNotice({ kind: "info", text: "Auto-approve off — the SDK will prompt per trade if needed." });
        }

        // Price: cross the spread. Books are quoted in UP probability.
        let price: number;
        try {
          const book = await (
            ex as unknown as { fetchOrderBook: (s: string, n: number) => Promise<{ bids: number[][]; asks: number[][] }> }
          ).fetchOrderBook(symbol, 5);
          const bestBid = book.bids?.[0]?.[0];
          const bestAsk = book.asks?.[0]?.[0];
          const mid = selected.mid ?? (bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined);
          price = side === "UP" ? upCrossPrice(bestAsk, mid) : downCrossPrice(bestAsk, mid);
        } catch {
          const m = selected.mid ?? 0.5;
          price = side === "UP" ? clampPrice(Math.min(0.99, m + 0.02)) : selected.mid === undefined ? 0.05 : clampPrice(Math.max(0.01, m - 0.08));
        }

        const order = await (
          ex as unknown as {
            createOrder: (s: string, t: string, side: string, amt: number, p: number, opts: unknown) => Promise<unknown>;
          }
        ).createOrder(symbol, "limit", "buy", snapped, price, { timeInForce: "IOC" });

        const info = (order as { info?: unknown })?.info as { receipt?: { transactionHash?: string; status?: string } } | undefined;
        const receipt = info?.receipt;
        const hash = receipt?.transactionHash ?? (order as { transactionHash?: string })?.transactionHash ?? "";
        if (receipt?.status === "reverted") {
          setNotice({
            kind: "err",
            text: `Order reverted on-chain${hash ? ` — tx ${hash.slice(0, 10)}…` : ""}. Check balances/allowance or the window locked.`,
            tx: hash || undefined,
          });
          return;
        }

        setNotice({
          kind: "ok",
          text: `Placed ${side} ${snapped} @ ${price}${receipt?.status ? ` — ${receipt.status}` : ""}. Watch your ticket below.`,
          tx: hash || undefined,
        });
        onPlaced?.({ asset: selected.asset, direction: side, stake: snapped });
        refresh();
      } catch (e) {
        setNotice({ kind: "err", text: decodeTradeError((e as Error).message ?? String(e)) });
      } finally {
        setBusy(false);
        try {
          ex.close?.();
        } catch {}
      }
    },
    [chainId, address, isConnected, walletClient, publicClient, selected, autoApprove, refresh, onPlaced]
  );

  return { trade, busy, notice, clearNotice: () => setNotice(null) };
}
