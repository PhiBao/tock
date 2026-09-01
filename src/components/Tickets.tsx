"use client";

import { useCallback, useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { createExchange } from "@/lib/somnia";
import { intervalLabel } from "@/lib/format";
import { useStreak } from "@/hooks/useStreak";

type TicketRow = {
  marketId: string;
  asset: string;
  expiry: number;
  intervalSec: number;
  upSymbol: string;
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
      // Scan finalized for history + live positions via balances
      const settled = await ex.client.listBinaryMarkets({ status: "Finalized", limit: 40 } as never);
      const sorted = [...settled].sort((a: unknown, b: unknown) => Number((b as { expiry?: string }).expiry ?? 0) - Number((a as { expiry?: string }).expiry ?? 0));
      const next: TicketRow[] = [];
      for (const m of sorted.slice(0, 20) as unknown as Array<{
        marketId: string;
        asset: string;
        expiry: string;
        intervalSec: string;
        outcomes?: Array<{ symbol: string }>;
        market?: string;
        outcomeToken?: string;
        yesId?: string;
        noId?: string;
      }>) {
        try {
          const oc = await ex.client.getMarketOnchain(m.marketId as `0x${string}`);
          // get balances to see if we ever held
          // Use any to tolerate ABI drift
          const upBal =
            oc.outcomeToken && oc.yesId
              ? await (ex.client as unknown as { getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint> }).getOutcomeBalance(oc.outcomeToken, address, String(oc.yesId))
              : BigInt(0);
          const downBal =
            oc.outcomeToken && oc.noId
              ? await (ex.client as unknown as { getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint> }).getOutcomeBalance(oc.outcomeToken, address, String(oc.noId))
              : BigInt(0);
          // Also check recent fills to know we participated even if balances now 0 (redeemed)
          // For MVP we show any market where we had a fill; balances alone misses redeemed wins.
          // Fetch user fills scoped to this market's window via getUserFills — but that needs pool. Instead, just show if balances >0 OR we can infer via PnL call.
          let hasPosition = upBal > BigInt(0) || downBal > BigInt(0);
          // Try PnL as participation signal
          try {
            const pnl = await (ex.client as unknown as { getBinaryPositionPnL: (a: string, id: string) => Promise<unknown> }).getBinaryPositionPnL(address, m.marketId as `0x${string}`);
            if (pnl && typeof pnl === "object" && "realizedPnl" in (pnl as Record<string, unknown>)) hasPosition = true;
          } catch {}
          if (!hasPosition) continue;
          next.push({
            marketId: m.marketId,
            asset: m.asset,
            expiry: Number(m.expiry),
            intervalSec: Number(m.intervalSec),
            upSymbol: m.outcomes?.[0]?.symbol ?? "",
            myUp: upBal.toString(),
            myDown: downBal.toString(),
            status: oc.isVoided ? "Voided" : oc.isResolved ? "Resolved" : String(oc.status),
            winning: (oc as unknown as { winningOutcome?: number }).winningOutcome ?? null,
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
      setMsg("Connect wallet to claim — needs signer.");
      return;
    }
    setClaiming(true);
    setMsg(null);
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    let claimed = 0;
    let checked = 0;
    try {
      const settled = await ex.client.listBinaryMarkets({ status: "Finalized", limit: 40 } as never);
      const sorted = [...settled].sort((a: unknown, b: unknown) => Number((b as { expiry?: string }).expiry ?? 0) - Number((a as { expiry?: string }).expiry ?? 0));
      for (const m of sorted.slice(0, 20) as unknown as Array<{ marketId: string }>) {
        checked++;
        try {
          const oc: unknown = await ex.client.getMarketOnchain(m.marketId as `0x${string}`);
          const o = oc as { outcomeToken?: `0x${string}`; yesId?: string; noId?: string; isVoided?: boolean; isResolved?: boolean; winningOutcome?: number; marketAddress?: `0x${string}` };
          if (!o.outcomeToken || (!o.yesId && !o.noId)) continue;
          const getBal = ex.client as unknown as { getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint> };
          const toClaim: Array<{ idx: 0 | 1; amount: bigint }> = [];
          if (o.isVoided) {
            if (o.yesId) {
              const b = await getBal.getOutcomeBalance(o.outcomeToken, address, String(o.yesId));
              if (b > BigInt(0)) toClaim.push({ idx: 0, amount: b });
            }
            if (o.noId) {
              const b = await getBal.getOutcomeBalance(o.outcomeToken, address, String(o.noId));
              if (b > BigInt(0)) toClaim.push({ idx: 1, amount: b });
            }
          } else if (o.isResolved && o.winningOutcome !== undefined && o.winningOutcome !== null) {
            const winId = o.winningOutcome === 0 ? o.yesId : o.noId;
            const winIdx = o.winningOutcome === 0 ? 0 : 1;
            if (winId) {
              const b = await getBal.getOutcomeBalance(o.outcomeToken, address, String(winId));
              if (b > BigInt(0)) toClaim.push({ idx: winIdx as 0 | 1, amount: b });
            }
          } else continue;

          for (const c of toClaim) {
            try {
              const res = await (ex.trader as unknown as { redeem: (p: unknown) => Promise<{ receipt?: { transactionHash?: string; status?: string } }> }).redeem({
                marketId: m.marketId as `0x${string}`,
                market: o.marketAddress,
                outcomeToken: o.outcomeToken,
                outcomeIdx: c.idx,
                amount: c.amount,
              });
              if (res.receipt?.status !== "reverted") {
                claimed++;
                // record streak: void = null, win = true
                const isVoid = !!o.isVoided;
                record(isVoid ? null : true, "claim", "auto", c.idx === 0 ? "UP" : "DOWN");
              }
            } catch {}
          }
        } catch {}
        if (claimed >= 5) break; // cap gas per click
      }
      if (claimed === 0) setMsg(`Checked ${checked} finalized windows — no claimable winnings found. Balances are zero or already redeemed.`);
      else {
        setMsg(`Claimed ${claimed} position(s) — tx sent. Refresh to see updated balances.`);
        // refresh after claim
        setTimeout(() => refresh(), 1200);
      }
    } catch (e) {
      setMsg(`Claim failed: ${(e as Error).message.slice(0, 300)}`);
    } finally {
      setClaiming(false);
      try { ex.close?.(); } catch {}
    }
  }, [address, chainId, walletClient, record, refresh]);

  // Also offer manual streak recording for demo (since on-chain win detection needs fills)
  // This is a demo helper: not auto, but lets user mark result for streak.
  // Real win detection would derive from getMarketResolution open vs close.
  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Tickets & history</h3>
        <button onClick={refresh} disabled={loading} className="text-xs px-3 py-1.5 rounded-full bg-white text-black font-medium disabled:opacity-60">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {!address && <p className="text-sm text-zinc-400">Connect a wallet to see your tickets. On testnet, use Faucet to get tUSDC.</p>}

      {address && rows.length === 0 && !loading && <p className="text-sm text-zinc-400">No tickets found yet. Place a call and check back after settlement — it scans the last 40 finalized windows.</p>}

      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.marketId} className="rounded-2xl bg-zinc-800 border border-zinc-700 p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">
                {r.asset} · {intervalLabel(r.intervalSec)} · {new Date(r.expiry * 1000).toLocaleTimeString()}
              </div>
              <div className="text-xs font-mono text-zinc-400">
                Up {r.myUp} · Down {r.myDown} · {r.status}
                {r.isVoided ? " · void 0.5" : r.winning !== null && r.winning !== undefined ? ` · winner ${r.winning === 0 ? "UP" : "DOWN"}` : ""}
              </div>
              <div className="text-[10px] font-mono text-zinc-500">{r.marketId.slice(0, 18)}…</div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => record(true, r.asset, intervalLabel(r.intervalSec), "UP")}
                className="text-[10px] px-2 py-1 rounded-full bg-emerald-500 text-white"
                title="Demo: mark win for streak"
              >
                Mark W
              </button>
              <button onClick={() => record(false, r.asset, intervalLabel(r.intervalSec), "DOWN")} className="text-[10px] px-2 py-1 rounded-full bg-red-500 text-white">
                Mark L
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={claimAll} disabled={claiming || !address} className="w-full py-3 rounded-2xl bg-amber-400 text-black font-bold disabled:opacity-60">
        {claiming ? "Checking…" : "Claim winnings (auto-scan)"}
      </button>

      {msg && <div className="text-xs font-mono bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl break-words">{msg}</div>}

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Winnings don&apos;t auto-deliver — you must redeem. Tock scans <code>listBinaryMarkets({`{status:"Finalized"}`})</code> (gotcha #10) and redeems the winning side (voided: both at 0.5). Losing redeems pay 0 — we skip them to save gas.
      </p>
    </div>
  );
}
