"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { MarketCard } from "@/components/MarketCard";
import { TradePanel } from "@/components/TradePanel";
import { StreakBar } from "@/components/StreakBar";
import { Tickets } from "@/components/Tickets";
import { RidePanel } from "@/components/RidePanel";
import { AgentPanel } from "@/components/AgentPanel";
import { ShareModal } from "@/components/ShareModal";
import { FaucetPanel } from "@/components/FaucetPanel";
import { LivePriceSpark } from "@/components/LivePriceSpark";
import { useToast } from "@/components/Toaster";
import { useLiveMarkets } from "@/hooks/useMarkets";
import { useBalances } from "@/hooks/useBalances";
import { useTrade } from "@/hooks/useTrade";
import { createExchange, addressesForChain } from "@/lib/somnia";
import { CHAIN_BY_ID } from "@/config/chains";
import { COLLATERAL_SYMBOL } from "@/config/markets";
import { renderShareCard } from "@/lib/share";
import { streakKey } from "@/lib/streak";
import { shouldStop, type RideConfig, type RideState } from "@/lib/ride";

const AGENT_ADDRESS = "0x1111111111111111111111111111111111111111" as const;

export default function Home() {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const toast = useToast();

  // Testnet-only for the hackathon demo — auto-switch to Shannon.
  const chainId = walletChainId ?? 50312;
  const isTestnet = chainId === 50312;
  const explorerTx = (tx: string) => `${CHAIN_BY_ID[chainId]?.blockExplorers?.default.url ?? ""}/tx/${tx}`;

  const [autoApprove, setAutoApprove] = useState(true);
  const [ride, setRide] = useState<RideState | null>(null);
  const [rideNotice, setRideNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "ride">("manual");
  const [isDelegated, setIsDelegated] = useState(false);
  const [lastHumanTrade, setLastHumanTrade] = useState<{
    asset: string;
    direction: "UP" | "DOWN";
    stake: number;
    at: number;
  } | null>(null);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [shareImg, setShareImg] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIsDelegated(localStorage.getItem(`tock:delegated:${chainId}:${address?.toLowerCase()}`) === "true");
    } catch {}
  }, [chainId, address]);

  useEffect(() => {
    if (isConnected && walletChainId && walletChainId !== 50312) {
      try {
        switchChain({ chainId: 50312 });
      } catch {}
    }
  }, [isConnected, walletChainId, switchChain]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`tock:autoApprove:${chainId}`);
      if (v !== null) setAutoApprove(v === "true");
    } catch {}
  }, [chainId]);
  useEffect(() => {
    try {
      localStorage.setItem(`tock:autoApprove:${chainId}`, String(autoApprove));
    } catch {}
  }, [autoApprove, chainId]);

  const balances = useBalances(chainId, address, publicClient);
  const { cards, loading, error, refresh } = useLiveMarkets(chainId, true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && cards.length) {
      const btc15 = cards.find((c) => c.asset === "BTC" && c.intervalSec === 900);
      setSelectedId((btc15 ?? cards[0]).marketId);
    }
  }, [cards, selectedId]);

  const selected = useMemo(
    () => cards.find((c) => c.marketId === selectedId) ?? cards[0] ?? null,
    [cards, selectedId]
  );

  const { trade, busy, notice } = useTrade({
    chainId,
    address,
    isConnected,
    walletClient,
    publicClient,
    selected,
    autoApprove,
    refresh,
    onPlaced: (t) => setLastHumanTrade({ ...t, at: Date.now() }),
  });

  const doFaucet = async () => {
    if (!walletClient || !isConnected) {
      const m = "Connect a wallet on Shannon testnet first.";
      setFaucetMsg(m);
      toast({ tone: "err", title: "Wallet not connected", desc: m });
      return;
    }
    if (chainId !== 50312) {
      setFaucetMsg("Switch to Shannon testnet to faucet tUSDC.");
      return;
    }
    setFaucetBusy(true);
    setFaucetMsg("Requesting 10,000 tUSDC…");
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      const res = await (ex.trader as unknown as { faucet: (o?: unknown) => Promise<unknown> }).faucet();
      const hash = (res as { receipt?: { transactionHash?: string } })?.receipt?.transactionHash ?? "";
      const m = `Faucet ok${hash ? ` — ${hash.slice(0, 10)}…` : ""}. Now get STT for gas at testnet.somnia.network if needed.`;
      setFaucetMsg(m);
      toast({ tone: "ok", title: "10,000 tUSDC on the way", desc: m, txUrl: hash ? explorerTx(hash) : undefined });
    } catch (e) {
      const msg = (e as Error).message;
      const m = msg.includes("FaucetCapExceeded")
        ? "Faucet cap: 10k per call. Try again after a block."
        : `Faucet failed: ${msg.slice(0, 250)} — claim STT at testnet.somnia.network first.`;
      setFaucetMsg(m);
      toast({ tone: "err", title: "Faucet failed", desc: m });
    } finally {
      setFaucetBusy(false);
      try {
        ex.close?.();
      } catch {}
    }
  };

  const handleDelegate = async () => {
    if (!walletClient || !isConnected || !address) {
      toast({ tone: "err", title: "Connect a wallet first", desc: "Delegation needs a signer." });
      return;
    }
    if (isDelegated) {
      const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
      try {
        const traderAny = ex.trader as unknown as { setOperatorApprovalGlobal?: (p: unknown) => Promise<unknown> };
        if (traderAny.setOperatorApprovalGlobal) {
          try {
            await traderAny.setOperatorApprovalGlobal({
              operator: AGENT_ADDRESS,
              selectors: ["0x80054449", "0xe37b444b"],
              approved: false,
            } as never);
          } catch {}
        } else {
          const addrs = addressesForChain(chainId);
          const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
          if (collateral) {
            try {
              await (walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }).writeContract({
                address: collateral,
                abi: erc20Abi,
                functionName: "approve",
                args: [AGENT_ADDRESS, 0n],
              });
            } catch {}
          }
        }
        try {
          localStorage.removeItem(`tock:delegated:${chainId}:${address.toLowerCase()}`);
        } catch {}
        setIsDelegated(false);
        toast({ tone: "ok", title: "Permission revoked", desc: "The agent can no longer trade for you. Funds never left your wallet." });
      } catch (e) {
        toast({ tone: "err", title: "Revoke failed", desc: (e as Error).message.slice(0, 200) });
      } finally {
        try {
          ex.close?.();
        } catch {}
      }
      return;
    }
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      toast({ tone: "info", title: "Delegating…", desc: "One-time, revocable. Confirm in your wallet." });
      let delegated = false;
      const traderAny = ex.trader as unknown as { setOperatorApprovalGlobal?: (p: unknown) => Promise<unknown> };
      if (traderAny.setOperatorApprovalGlobal) {
        try {
          const res = await traderAny.setOperatorApprovalGlobal({
            operator: AGENT_ADDRESS,
            selectors: ["0x80054449", "0xe37b444b"],
            approved: true,
          } as never);
          const h = (res as { receipt?: { transactionHash?: string } })?.receipt?.transactionHash ?? "";
          toast({
            tone: "ok",
            title: "Agent delegated",
            desc: "placeOrderFor rights granted — next bets via agent, zero popups.",
            txUrl: h ? explorerTx(h) : undefined,
          });
          delegated = true;
        } catch (e) {
          const msg = String(e);
          if (!msg.includes("operatorRegistry") && !msg.includes("operatorPermissionsRegistry")) throw e;
        }
      }
      if (!delegated) {
        const addrs = addressesForChain(chainId);
        const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
        if (!collateral) throw new Error("No collateral token found");
        const hash = await (
          walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }
        ).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [AGENT_ADDRESS, 2n ** 256n - 1n] });
        await publicClient?.waitForTransactionReceipt({ hash });
        toast({
          tone: "ok",
          title: "Agent delegated",
          desc: "One-time approval done — the agent can now pull tUSDC to trade for you.",
          txUrl: explorerTx(hash),
        });
        delegated = true;
      }
      if (delegated) {
        try {
          localStorage.setItem(`tock:delegated:${chainId}:${address.toLowerCase()}`, "true");
        } catch {}
        setIsDelegated(true);
      }
    } catch (e) {
      toast({ tone: "err", title: "Delegate failed", desc: (e as Error).message.slice(0, 300) });
    } finally {
      try {
        ex.close?.();
      } catch {}
    }
  };

  const handleStartRide = async (cfg: RideConfig) => {
    if (!isConnected || !walletClient || !address) {
      toast({ tone: "err", title: "Connect a wallet to start a Ride." });
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRide({ id, config: cfg, legs: [], status: "running", pot: cfg.stake, round: 0, createdAt: Date.now() });
    setMode("ride");
    setRideNotice(`Ride started: ${cfg.asset} ${cfg.direction} ×${cfg.maxLegs} — placing leg 1…`);
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      await ex.loadMarkets(true);
      const all = Object.values(
        (ex as unknown as { markets: Record<string, { info: Record<string, unknown>; outcomes?: { symbol: string; label: string }[] }> }).markets ?? {}
      );
      const m = all.find((mm) => mm.info.asset === cfg.asset && Number(mm.info.intervalSec) === 300) ?? all.find((mm) => mm.info.asset === cfg.asset);
      if (!m) throw new Error("No live window found for Ride");
      const outs = m.outcomes ?? [];
      const symbol =
        cfg.direction === "UP"
          ? (outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol)
          : (outs.find((o) => o.label === "NO")?.symbol ?? outs[1]?.symbol);
      if (!symbol) throw new Error("No outcome symbol");
      let price: number;
      try {
        const book = await (
          ex as unknown as { fetchOrderBook: (s: string, n: number) => Promise<{ bids: number[][]; asks: number[][] }> }
        ).fetchOrderBook(symbol, 5);
        const bestAsk = book.asks?.[0]?.[0];
        const mid = book.bids?.[0]?.[0] !== undefined && bestAsk !== undefined ? (book.bids[0][0] + bestAsk) / 2 : undefined;
        if (cfg.direction === "UP") price = Math.min(0.99, (bestAsk ?? mid ?? 0.55) + 0.02);
        else {
          price = Math.max(0.01, (bestAsk ?? mid ?? 0.5) - 0.02);
          if (bestAsk === undefined && mid === undefined) price = 0.05;
        }
      } catch {
        price = cfg.direction === "UP" ? 0.57 : 0.43;
      }
      price = Math.max(0.001, Math.min(0.999, Number(price.toFixed(3))));
      const qty = cfg.stake;
      if (autoApprove) {
        try {
          const pool = (m.info as unknown as { poolAddress?: `0x${string}` }).poolAddress;
          const addrs = addressesForChain(chainId);
          const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
          if (pool && collateral) {
            const decimals = chainId === 50312 ? 6 : 18;
            const needed = parseUnits(String((qty * 0.99).toFixed(decimals === 6 ? 4 : 6)), decimals);
            const allowance = (await (ex.client as unknown as { getErc20Allowance?: (t: string, o: string, s: string) => Promise<bigint> }).getErc20Allowance?.(
              collateral,
              address,
              pool
            )) as bigint | undefined;
            let allow = allowance;
            if (allow === undefined && publicClient) {
              try {
                allow = (await publicClient.readContract({ address: collateral, abi: erc20Abi, functionName: "allowance", args: [address, pool] } as never)) as bigint;
              } catch {}
            }
            if (allow !== undefined && allow < needed) {
              const h = await (
                walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }
              ).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [pool, 2n ** 256n - 1n] });
              await publicClient?.waitForTransactionReceipt({ hash: h });
            }
          }
        } catch {}
      }
      const order = await (
        ex as unknown as { createOrder: (s: string, t: string, side: string, a: number, p: number, o: unknown) => Promise<unknown> }
      ).createOrder(symbol, "limit", "buy", qty, price, { timeInForce: "IOC" });
      const h = ((order as { info?: { receipt?: { transactionHash?: string } } })?.info?.receipt?.transactionHash ?? "") as string;
      setLastHumanTrade({ asset: cfg.asset, direction: cfg.direction as "UP" | "DOWN", stake: qty, at: Date.now() });
      const leg = {
        marketId: String(m.info["marketId"] ?? ""),
        expiry: Number(m.info["expiry"] ?? 0),
        side: cfg.direction,
        price,
        quantity: qty,
        escrow: qty * price,
        txHash: h,
        status: "open" as const,
        multiplier: 1 / price,
      };
      setRide((r) => (r ? { ...r, legs: [...r.legs, leg], pot: r.pot } : r));
      setRideNotice(`Ride leg 1 placed — tx ${h.slice(0, 10)}… Polling settlement every 3s…`);
    } catch (e) {
      const m = `Ride start failed: ${(e as Error).message.slice(0, 300)}`;
      setRideNotice(m);
      toast({ tone: "err", title: "Ride failed to start", desc: m });
      setRide((r) => (r ? { ...r, status: "failed" as const } : r));
    } finally {
      try {
        ex.close?.();
      } catch {}
    }
  };

  const handleStopRide = () => {
    setRide((r) => (r ? { ...r, status: "paused" as const } : r));
    setRideNotice("Ride paused — guardrails still enforce max loss = stake.");
  };

  // Ride engine: poll last open leg, claim wins, auto-roll the pot.
  useEffect(() => {
    if (!ride || ride.status !== "running" || !walletClient) return;
    let cancelled = false;
    const tick = async () => {
      const last = ride.legs[ride.legs.length - 1];
      if (!last || last.status !== "open") return;
      const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
      try {
        const oc = (await ex.client.getMarketOnchain(last.marketId as `0x${string}`)) as unknown as {
          status: number;
          isResolved?: boolean;
          isVoided?: boolean;
          winningOutcome?: number;
        };
        if (oc.isVoided) {
          if (cancelled) return;
          setRide((r) => {
            if (!r) return r;
            const legs = r.legs.map((l, i) => (i === r.legs.length - 1 ? { ...l, status: "void" as const, payout: l.escrow } : l));
            return { ...r, legs, pot: r.pot, status: "void" as const };
          });
          setRideNotice("Ride voided — stake returned (0.5).");
          toast({ tone: "info", title: "Ride voided", desc: "Settlement voided — 0.5 returned on both sides." });
          return;
        }
        if (!oc.isResolved) return;
        const won = (oc.winningOutcome === 0 && last.side === "UP") || (oc.winningOutcome === 1 && last.side === "DOWN");
        if (cancelled) return;
        if (!won) {
          setRide((r) => {
            if (!r) return r;
            const legs = r.legs.map((l, i) => (i === r.legs.length - 1 ? { ...l, status: "lost" as const } : l));
            return { ...r, legs, status: "lost" as const };
          });
          setRideNotice(`Ride leg ${ride.legs.length} lost — run over.`);
          toast({ tone: "err", title: "Ride lost", desc: `Stopped at leg ${ride.legs.length}. Max loss was always the stake.` });
          return;
        }
        try {
          const bal = (await (
            ex.client as unknown as { getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint> }
          ).getOutcomeBalance(
            ((last as unknown as { outcomeToken?: string }).outcomeToken as string) ?? "",
            address!,
            last.side === "UP" ? "0" : "1"
          )) as bigint;
          try {
            await (ex.trader as unknown as { redeem: (p: unknown) => Promise<unknown> }).redeem({
              marketId: last.marketId as `0x${string}`,
              market: (last as unknown as { marketAddress?: string }).marketAddress,
              outcomeToken: (last as unknown as { outcomeToken?: string }).outcomeToken,
              outcomeIdx: last.side === "UP" ? 0 : 1,
              amount: bal > BigInt(0) ? bal : undefined,
            });
          } catch {}
        } catch {}
        const payout = last.quantity;
        const tmp: RideState = {
          ...ride,
          legs: [...ride.legs.slice(0, -1), { ...last, status: "won" as const, payout, multiplier: payout / last.escrow }],
          pot: payout,
        };
        const { stop, reason } = shouldStop({ ...tmp, legs: tmp.legs });
        if (stop) {
          setRide({ ...tmp, status: "won" as const });
          setRideNotice(`Ride WON — ${reason} — pot $${payout.toFixed(2)} claimed.`);
          toast({ tone: "ok", title: "Ride won", desc: `${reason} — pot $${payout.toFixed(2)} claimed.` });
          return;
        }
        await ex.loadMarkets(true);
        const all = Object.values(
          (ex as unknown as { markets: Record<string, { info: Record<string, unknown>; outcomes?: { symbol: string; label: string }[] }> }).markets ?? {}
        );
        const nextM = all.find((mm) => mm.info.asset === ride.config.asset && Number(mm.info.expiry ?? 0) > Date.now() / 1000 + 10);
        if (!nextM) {
          setRide({ ...tmp, status: "won" as const });
          setRideNotice("Ride won — no successor window yet, pot held.");
          return;
        }
        const outs = nextM.outcomes ?? [];
        const sym =
          ride.config.direction === "UP"
            ? (outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol)
            : (outs.find((o) => o.label === "NO")?.symbol ?? outs[1]?.symbol);
        if (!sym) {
          setRide({ ...tmp, status: "won" as const });
          return;
        }
        const price = ride.config.direction === "UP" ? 0.55 : 0.45;
        const qty = payout;
        const order = await (
          ex as unknown as { createOrder: (s: string, t: string, side: string, a: number, p: number, o: unknown) => Promise<unknown> }
        ).createOrder(sym, "limit", "buy", qty, price, { timeInForce: "IOC" });
        const h = ((order as { info?: { receipt?: { transactionHash?: string } } })?.info?.receipt?.transactionHash ?? "") as string;
        const nextLeg = {
          marketId: String(nextM.info["marketId"] ?? ""),
          expiry: Number(nextM.info["expiry"] ?? 0),
          side: ride.config.direction,
          price,
          quantity: qty,
          escrow: qty * price,
          txHash: h,
          status: "open" as const,
          multiplier: 1 / price,
        };
        setRide({ ...tmp, legs: [...tmp.legs, nextLeg], pot: payout, round: tmp.legs.length });
        setRideNotice(`Ride auto-rolled leg ${tmp.legs.length + 1} — tx ${h.slice(0, 10)}…`);
      } catch {}
      finally {
        try {
          ex.close?.();
        } catch {}
      }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ride, chainId, walletClient, address, toast]);

  const shareStreak = () => {
    const canvas = renderShareCard({
      streakKey: streakKey(chainId, address),
      asset: selected?.asset,
      intervalSec: selected?.intervalSec,
      mid: selected?.mid,
      siteUrl: typeof window !== "undefined" ? window.location.host : "tock",
    });
    if (!canvas) return;
    setShareImg(canvas.toDataURL("image/png"));
  };

  const downloadShare = () => {
    if (!shareImg) return;
    const a = document.createElement("a");
    a.href = shareImg;
    a.download = `tock-streak-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <SiteHeader chainId={chainId} balances={balances} isConnected={isConnected} />
      <Hero card={selected} />

      <main id="trade" className="mx-auto grid w-full max-w-6xl flex-1 scroll-mt-20 grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-[0.22em] text-zinc-500">LIVE WINDOWS</h2>
            <button onClick={refresh} className="text-xs font-medium text-zinc-500 transition hover:text-gold">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {error && (
            <div className="break-words rounded-2xl border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs text-red-200">
              {error}
            </div>
          )}

          {loading && cards.length === 0 ? (
            <div className="space-y-3" aria-label="Loading markets">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-3xl border border-white/[0.06] bg-panel" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-panel p-6 text-sm leading-relaxed text-zinc-500">
              No live windows right now. The venue rolls every 15 minutes — check back in a moment.
            </div>
          ) : (
            <div className="grid gap-3">
              {cards.map((c) => (
                <MarketCard key={c.marketId} card={c} isActive={selected?.marketId === c.marketId} onSelect={() => setSelectedId(c.marketId)} />
              ))}
            </div>
          )}

          <StreakBar chainId={chainId} address={address} />
          {isTestnet && <FaucetPanel onFaucet={doFaucet} busy={faucetBusy} msg={faucetMsg} />}

          <div id="how" className="scroll-mt-24 rounded-3xl border border-white/[0.07] bg-panel p-5 text-xs leading-relaxed text-zinc-400">
            <div className="mb-1.5 font-display text-sm font-bold text-white">How it works</div>
            Every 15m or 1h a new window opens. The line to beat is the window&apos;s opening price — UP wins if
            settlement lands at or above it, DOWN wins below. Settlement is a multi-source median, auditable on the
            oracle explorer. Your stake is your max loss. No liquidations, no fees.
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-panel p-1" role="tablist" aria-label="Trade mode">
            <button
              onClick={() => setMode("manual")}
              role="tab"
              aria-selected={mode === "manual"}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                mode === "manual" ? "bg-white text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              Manual · 1 tap
            </button>
            <button
              onClick={() => setMode("ride")}
              role="tab"
              aria-selected={mode === "ride"}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                mode === "ride" ? "bg-gold text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              Ride · auto-roll
            </button>
          </div>

          {mode === "ride" ? (
            <>
              {rideNotice && (
                <div className="break-words rounded-2xl border border-gold/25 bg-gold/[0.06] p-3 font-mono text-xs leading-relaxed text-amber-200">
                  {rideNotice}
                </div>
              )}
              <RidePanel chainId={chainId} ride={ride} onStartRide={handleStartRide} onStop={handleStopRide} />
            </>
          ) : (
            <TradePanel
              card={selected}
              chainId={chainId}
              onTrade={trade}
              busy={busy}
              notice={notice}
              autoApprove={autoApprove}
              setAutoApprove={setAutoApprove}
            />
          )}

          <AgentPanel isDelegated={isDelegated} onToggle={handleDelegate} lastHumanTrade={lastHumanTrade} />

          {selected && (
            <div className="rounded-3xl border border-white/[0.07] bg-panel p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-[0.22em] text-zinc-500">SPOT CONTEXT</span>
                <span className="font-mono text-[11px] text-zinc-600">Binance · not settlement</span>
              </div>
              <LivePriceSpark asset={selected.asset} tradingStart={selected.tradingStart} expiry={selected.expiry} />
            </div>
          )}

          <Tickets chainId={chainId} address={address} />

          <div className="flex flex-col gap-2 rounded-3xl border border-white/[0.07] p-4 sm:flex-row">
            <a
              href="https://docs.dreamdex.io/developers/event-contracts"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.99]"
            >
              Docs ↗
            </a>
            <a
              href="https://dreamdex.io/algo-arena"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:bg-white/5 active:scale-[0.99]"
            >
              Algo Arena ↗
            </a>
            <button
              onClick={shareStreak}
              className="flex-1 rounded-xl border border-gold/30 py-2.5 text-center text-sm font-bold text-gold transition hover:bg-gold/10 active:scale-[0.99]"
            >
              Share streak
            </button>
          </div>

          <footer className="pt-1 text-center text-[11px] leading-relaxed text-zinc-600">
            {COLLATERAL_SYMBOL[chainId] ?? "tUSDC"} demo on Shannon testnet · built for the Somnia × DreamDEX
            hackathon. Start with the faucet, try a 5-contract call.
          </footer>
        </div>
      </main>

      <ShareModal
        open={shareImg !== null}
        imgSrc={shareImg}
        onDownload={downloadShare}
        onClose={() => setShareImg(null)}
      />
    </div>
  );
}
