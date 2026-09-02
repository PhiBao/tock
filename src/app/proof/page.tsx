"use client";

import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { SiteHeader } from "@/components/SiteHeader";
import { useBalances } from "@/hooks/useBalances";
import { useLiveMarkets } from "@/hooks/useMarkets";
import { useNow } from "@/hooks/useNow";
import { fmtCountdown, fmtProb, intervalLabel } from "@/lib/format";
import { SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";

const EXPLORER = "https://shannon-explorer.somnia.network";
const A = SOMNIA_TESTNET_ADDRESSES as unknown as Record<string, string>;

const CONTRACTS: Array<{ name: string; addr: string; note: string }> = [
  { name: "BinaryMarketsModule", addr: A["binaryModule"], note: "Event-contract orderbook + settlement" },
  { name: "BinarySettlement", addr: A["binarySettlement"], note: "Redeem / payout leg" },
  { name: "OracleHub", addr: A["oracleHub"], note: "Multi-source median settlement feed" },
  { name: "tUSDC (collateral)", addr: A["testUsdc"], note: "6-decimal test collateral + faucet" },
];

const POLICY: Array<{ claim: string; how: string }> = [
  { claim: "Never trades a dead or locked window", how: "Every order is gated on getMarketOnchain status === 1 plus 30s expiry headroom." },
  { claim: "Never leaves resting orders", how: "IOC only. Unfilled remainder cancels instead of sitting on the book." },
  { claim: "Never pays approval tax per trade", how: "One max approval per pool, cached in localStorage; allowance re-checked on-chain." },
  { claim: "Never reverts on tick/lot grids", how: "Sizes floored to the 0.001 lot; prices clamped to the 0.001 tick (SDK ≥ 0.28 snaps the rest)." },
  { claim: "Never loses to a market roll", how: "Trader instance re-hydrates markets pre-trade; unknown symbols trigger one retry, then a board refresh." },
  { claim: "Never wastes gas on losing redeems", how: "Claim plans from settlement state: voided → both sides at 0.5, resolved → winner only, else nothing." },
  { claim: "Never mixes preview with settlement", how: "Binance spot is labeled orientation everywhere; settlement truth is the oracle median with audit links." },
  { claim: "Never holds user funds", how: "No backend, no keys. Self-custody wallet trades; the agent path is a revocable one-time approval." },
];

export default function ProofPage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const balances = useBalances(chainId ?? 50312, address, publicClient);
  const { cards, loading, error } = useLiveMarkets(50312, true);
  const now = useNow(1000);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <SiteHeader chainId={chainId ?? 50312} balances={balances} isConnected={isConnected} />
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
        <div>
          <p className="text-[11px] font-bold tracking-[0.24em] text-gold">PUBLIC PROOF · SHANNON TESTNET</p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Don&apos;t trust the demo. Verify it.</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-zinc-400">
            Everything below is checkable right now: live windows from the DreamDEX indexer, the exact contracts money
            touches, the execution policy enforced in code, and the commands that reproduce it all locally.
          </p>
        </div>

        <section className="rounded-3xl border border-white/[0.07] bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Live windows, this minute</h2>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {loading ? "Loading…" : `${cards.length} live`}
            </span>
          </div>
          {error ? (
            <p className="mt-3 break-words font-mono text-xs text-red-300">{error}</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {cards.slice(0, 6).map((c) => (
                <div key={c.marketId} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5">
                  <div>
                    <div className="text-sm font-bold">
                      {c.asset} · {intervalLabel(c.intervalSec)}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-zinc-500">#{c.marketId.slice(-6)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold tabular-nums">{fmtProb(c.mid)}</div>
                    <div className="font-mono text-[11px] tabular-nums text-gold">{fmtCountdown(c.expiry, now)}</div>
                  </div>
                </div>
              ))}
              {!loading && cards.length === 0 && (
                <p className="text-sm text-zinc-500">No live windows — the venue rolls every 15 minutes.</p>
              )}
            </div>
          )}
          <p className="mt-3 font-mono text-[11px] text-zinc-600">
            source: loadMarkets → isBinaryMarket → live BTC/ETH filter · refreshes every 4s
          </p>
        </section>

        <section className="rounded-3xl border border-white/[0.07] bg-panel p-5">
          <h2 className="font-display text-base font-bold">Contracts money touches</h2>
          <p className="mt-1 text-xs text-zinc-500">Shannon testnet (50312) · CREATE3 — same addresses on mainnet</p>
          <div className="mt-3 grid gap-2">
            {CONTRACTS.map((c) => (
              <a
                key={c.name}
                href={`${EXPLORER}/address/${c.addr}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5 transition hover:border-gold/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">{c.name}</div>
                  <div className="truncate font-mono text-[11px] text-zinc-500">{c.addr}</div>
                  <div className="text-[11px] text-zinc-600">{c.note}</div>
                </div>
                <span className="shrink-0 text-xs text-zinc-600 transition group-hover:text-gold">Explorer ↗</span>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/[0.07] bg-panel p-5">
          <h2 className="font-display text-base font-bold">Execution policy, enforced in code</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Each rule maps to a unit-tested pure function (<code className="rounded bg-white/10 px-1">src/lib/orderMath.ts</code>) or a
            gated step in <code className="rounded bg-white/10 px-1">useTrade</code>.
          </p>
          <div className="mt-3 grid gap-2">
            {POLICY.map((p) => (
              <div key={p.claim} className="rounded-2xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5">
                <div className="flex items-start gap-2 text-sm font-bold">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  {p.claim}
                </div>
                <div className="mt-1 pl-5 text-xs leading-relaxed text-zinc-500">{p.how}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.07] to-transparent p-5">
          <h2 className="font-display text-base font-bold">Reproduce it in ~60 seconds</h2>
          <pre className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs leading-relaxed text-zinc-200">
{`git clone https://github.com/PhiBao/tock.git && cd tock
pnpm install
pnpm typecheck && pnpm lint && pnpm test   # 25 checks, zero keys
pnpm demo                                   # live markets + books, no wallet`}
          </pre>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/"
              className="flex-1 rounded-xl bg-gold py-2.5 text-center text-sm font-bold text-black transition hover:bg-amber-300"
            >
              Open the app
            </Link>
            <a
              href="https://github.com/PhiBao/tock"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-gold/30 py-2.5 text-center text-sm font-bold text-gold transition hover:bg-gold/10"
            >
              Repo ↗
            </a>
            <a
              href="https://docs.dreamdex.io/developers/event-contracts"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            >
              Docs ↗
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
