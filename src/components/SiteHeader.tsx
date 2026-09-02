"use client";

import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { COLLATERAL_SYMBOL } from "@/config/markets";
import type { Balances } from "@/hooks/useBalances";

export function SiteHeader({
  chainId,
  balances,
  isConnected,
}: {
  chainId: number;
  balances: Balances | null;
  isConnected: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gold font-black text-black">◐</div>
          <div>
            <div className="font-display text-lg font-black leading-none tracking-tight">Tock</div>
            <div className="text-[10px] font-medium tracking-[0.22em] text-zinc-500">CALL THE NEXT 15 MINUTES</div>
          </div>
          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            LIVE · Shannon testnet
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {isConnected && balances && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs md:flex">
              <span className="text-zinc-500">{COLLATERAL_SYMBOL[chainId] ?? "tUSDC"}</span>
              <span className="font-bold text-white">
                {Number(balances.collateral).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">STT</span>
              <span className="font-bold text-white">{Number(balances.native).toFixed(4)}</span>
            </div>
          )}
          <nav className="hidden items-center gap-1 text-xs font-medium text-zinc-400 sm:flex">
            <Link href="/proof" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">
              Proof
            </Link>
            <Link href="/mcp" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">
              Agents
            </Link>
          </nav>
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
