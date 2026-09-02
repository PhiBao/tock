"use client";

import { useCallback, useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { motion } from "framer-motion";
import { createExchange } from "@/lib/somnia";
import { intervalLabel } from "@/lib/format";
import { planClaims } from "@/lib/orderMath";
import { useStreak } from "@/hooks/useStreak";

type TicketRow = {
  marketId: string;
  asset: string;
  expiry: number;
  intervalSec: number;
  myUp: string;
  myDown: string;
  status: string;
  winning?: number | null;
  isVoided?: boolean;
};

export function Tickets({ chainId, address }: { chainId: number; address?: string }) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const { record } = useStreak(chainId, address);
  const { data: walletClient } = useWalletClient();

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    const ex = createExchange({ chainId });
    try {
      const settled = await ex.client.listBinaryMarkets({ status: "Finalized", limit: 40 } as never);
      const sorted = [...settled].sort(
        (a: unknown, b: unknown) => Number((b as { expiry?: string }).expiry ?? 0) - Number((a as { expiry?: string }).expiry ?? 0)
      );
      const next: TicketRow[] = [];
      for (const m of sorted.slice(0, 20) as unknown as Array<{
        marketId: string;
        asset: string;
        expiry: string;
        intervalSec: string;
      }>) {
        try {
          const oc = (await ex.client.getMarketOnchain(m.marketId as `0x${string}`)) as unknown as {
            outcomeToken?: string;
            yesId?: string | bigint;
            noId?: string | bigint;
            isVoided?: boolean;
            isResolved?: boolean;
            winningOutcome?: number;
            status?: number | string;
          };
          const getBal = ex.client as unknown as {
            getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint>;
          };
          const upBal = oc.outcomeToken && oc.yesId != null ? await getBal.getOutcomeBalance(oc.outcomeToken, address, String(oc.yesId)) : BigInt(0);
          const downBal = oc.outcomeToken && oc.noId != null ? await getBal.getOutcomeBalance(oc.outcomeToken, address, String(oc.noId)) : BigInt(0);
          let hasPosition = upBal > BigInt(0) || downBal > BigInt(0);
          try {
            const pnl = await (
              ex.client as unknown as { getBinaryPositionPnL: (a: string, id: string) => Promise<unknown> }
            ).getBinaryPositionPnL(address, m.marketId as `0x${string}`);
            if (pnl && typeof pnl === "object" && "realizedPnl" in (pnl as Record<string, unknown>)) hasPosition = true;
          } catch {}
          if (!hasPosition) continue;
          next.push({
            marketId: m.marketId,
            asset: m.asset,
            expiry: Number(m.expiry),
            intervalSec: Number(m.intervalSec),
            myUp: upBal.toString(),
            myDown: downBal.toString(),
            status: oc.isVoided ? "Voided" : oc.isResolved ? "Resolved" : String(oc.status),
            winning: oc.winningOutcome ?? null,
            isVoided: !!oc.isVoided,
          });
        } catch {
          // ignore per-market errors
        }
      }
      setRows(next);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
      try {
        ex.close?.();
      } catch {}
    }
  }, [chainId, address]);

  useEffect(() => {
    if (address) refresh();
  }, [address, refresh]);

  const claimAll = useCallback(async () => {
    if (!address) return;
    if (!walletClient) {
      setMsg("Connect a wallet to claim — needs a signer.");
      return;
    }
    setClaiming(true);
    setMsg(null);
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    let claimed = 0;
    let checked = 0;
    try {
      const settled = await ex.client.listBinaryMarkets({ status: "Finalized", limit: 40 } as never);
      const sorted = [...settled].sort(
        (a: unknown, b: unknown) => Number((b as { expiry?: string }).expiry ?? 0) - Number((a as { expiry?: string }).expiry ?? 0)
      );
      for (const m of sorted.slice(0, 20) as unknown as Array<{ marketId: string }>) {
        checked++;
        try {
          const oc: unknown = await ex.client.getMarketOnchain(m.marketId as `0x${string}`);
          const o = oc as {
            outcomeToken?: `0x${string}`;
            yesId?: string;
            noId?: string;
            isVoided?: boolean;
            isResolved?: boolean;
            winningOutcome?: number;
            marketAddress?: `0x${string}`;
          };
          if (!o.outcomeToken || (!o.yesId && !o.noId)) continue;
          const getBal = ex.client as unknown as {
            getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint>;
          };
          const yesBal = o.yesId ? await getBal.getOutcomeBalance(o.outcomeToken, address, String(o.yesId)) : BigInt(0);
          const noBal = o.noId ? await getBal.getOutcomeBalance(o.outcomeToken, address, String(o.noId)) : BigInt(0);
          const toClaim = planClaims({
            isVoided: o.isVoided,
            isResolved: o.isResolved,
            winningOutcome: o.winningOutcome,
            yesBal,
            noBal,
          });
          for (const c of toClaim) {
            try {
              const res = await (
                ex.trader as unknown as {
                  redeem: (p: unknown) => Promise<{ receipt?: { transactionHash?: string; status?: string } }>;
                }
              ).redeem({
                marketId: m.marketId as `0x${string}`,
                market: o.marketAddress,
                outcomeToken: o.outcomeToken,
                outcomeIdx: c.idx,
                amount: c.amount,
              });
              if (res.receipt?.status !== "reverted") {
                claimed++;
                const isVoid = !!o.isVoided;
                record(isVoid ? null : true, "claim", "auto", c.idx === 0 ? "UP" : "DOWN");
              }
            } catch {}
          }
        } catch {}
        if (claimed >= 5) break; // cap gas per click
      }
      if (claimed === 0) setMsg(`Checked ${checked} finalized windows — nothing claimable. Balances are zero or already redeemed.`);
      else {
        setMsg(`Claimed ${claimed} position${claimed > 1 ? "s" : ""} — sent to your wallet.`);
        setTimeout(() => refresh(), 1200);
      }
    } catch (e) {
      setMsg(`Claim failed: ${(e as Error).message.slice(0, 300)}`);
    } finally {
      setClaiming(false);
      try {
        ex.close?.();
      } catch {}
    }
  }, [address, chainId, walletClient, record, refresh]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.07] bg-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">Tickets & history</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {!address && (
        <p className="text-sm leading-relaxed text-zinc-500">
          Connect a wallet to see your tickets. On testnet, grab tUSDC from the faucet first.
        </p>
      )}

      {address && rows.length === 0 && !loading && (
        <p className="text-sm leading-relaxed text-zinc-500">
          No tickets yet. Place a call — after settlement it lands here with its result.
        </p>
      )}

      <div className="grid gap-2">
        {rows.map((r) => {
          const iWon = !r.isVoided && r.winning !== null && r.winning !== undefined;
          return (
            <motion.div
              key={r.marketId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/30 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      r.isVoided ? "bg-zinc-500" : iWon ? (r.winning === 0 ? "bg-emerald-400" : "bg-red-400") : "bg-gold"
                    }`}
                  />
                  {r.asset} · {intervalLabel(r.intervalSec)} ·{" "}
                  {new Date(r.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="mt-1 font-mono text-[11px] tabular-nums text-zinc-500">
                  Up {r.myUp} · Down {r.myDown} · {r.status}
                  {r.isVoided
                    ? " · void, 0.5 back"
                    : r.winning !== null && r.winning !== undefined
                      ? ` · won ${r.winning === 0 ? "UP" : "DOWN"}`
                      : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => record(true, r.asset, intervalLabel(r.intervalSec), "UP")}
                  title="Demo helper: mark a win for your streak"
                  className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                >
                  W
                </button>
                <button
                  onClick={() => record(false, r.asset, intervalLabel(r.intervalSec), "DOWN")}
                  title="Demo helper: mark a loss for your streak"
                  className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-300 transition hover:bg-red-500/25"
                >
                  L
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={claimAll}
        disabled={claiming || !address}
        className="w-full rounded-2xl bg-gold py-3.5 text-sm font-black text-black transition hover:bg-amber-300 active:scale-[0.99] disabled:opacity-60"
      >
        {claiming ? "Scanning settled windows…" : "Claim winnings"}
      </button>

      {msg && (
        <div className="break-words rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
          {msg}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Claim scans your last 40 settled windows and redeems winners (voids pay 0.5 on both sides). Losing sides are
        skipped — redeeming them pays 0 and still costs gas.
      </p>
    </div>
  );
}
