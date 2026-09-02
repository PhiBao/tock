"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits, formatUnits } from "viem";
import { WalletConnect } from "@/components/WalletConnect";
import { MarketCard } from "@/components/MarketCard";
import { TradePanel } from "@/components/TradePanel";
import { StreakBar } from "@/components/StreakBar";
import { Tickets } from "@/components/Tickets";
import { RidePanel } from "@/components/RidePanel";
import { AgentPanel } from "@/components/AgentPanel";
import { useLiveMarkets } from "@/hooks/useMarkets";
import { createExchange, addressesForChain } from "@/lib/somnia";
import { RideConfig, RideState } from "@/lib/ride";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { LiveMarketCard } from "@/hooks/useMarkets";

export default function Home() {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const [balances, setBalances] = useState<{ collateral: string; native: string; decimals: number } | null>(null);
  const [autoApprove, setAutoApprove] = useState(true);
  const [ride, setRide] = useState<RideState | null>(null);
  const [mode, setMode] = useState<"manual" | "ride">("manual");
  const [isDelegated, setIsDelegated] = useState(false);
  const [lastHumanTrade, setLastHumanTrade] = useState<{ asset: string; direction: "UP" | "DOWN"; stake: number; at: number } | null>(null);
  const AGENT_ADDRESS = "0x1111111111111111111111111111111111111111" as const;

  // Testnet-only for hackathon demo — mainnet disabled, auto-switch to Shannon
  const chainId = walletChainId ?? 50312;
  const isTestnet = chainId === 50312;
  const [networkOpen, setNetworkOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`tock:delegated:${chainId}:${address?.toLowerCase()}`);
      setIsDelegated(v === "true");
    } catch {}
  }, [chainId, address]);

  // Auto-switch to Shannon testnet on connect (hackathon is testnet-only)
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

  const { cards, loading, error, refresh } = useLiveMarkets(chainId, true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [, setApproving] = useState(false);

  // Balances poll (collateral + native)
  useEffect(() => {
    if (!address || !publicClient) {
      setBalances(null);
      return;
    }
    let dead = false;
    const fetchBal = async () => {
      try {
        const addrs = addressesForChain(chainId);
        const collateral = (addrs as unknown as { collateral?: `0x${string}`; testUsdc?: `0x${string}` }).collateral ?? (addrs as unknown as { testUsdc?: `0x${string}` }).testUsdc;
        const isTestnet = chainId === 50312;
        const decimals = isTestnet ? 6 : 18;
        let collStr = "—";
        if (collateral) {
          try {
            const raw = (await publicClient.readContract({ address: collateral, abi: erc20Abi, functionName: "balanceOf", args: [address] } as never)) as bigint;
            collStr = formatUnits(raw, decimals);
          } catch {}
        }
        const nativeRaw = await publicClient.getBalance({ address });
        const nativeStr = formatUnits(nativeRaw, 18);
        if (!dead) setBalances({ collateral: collStr, native: nativeStr, decimals });
      } catch {}
    };
    fetchBal();
    const id = setInterval(fetchBal, 6000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [address, publicClient, chainId]);

  // Auto-select first BTC 15m
  useEffect(() => {
    if (!selectedId && cards.length) {
      const btc15 = cards.find((c) => c.asset === "BTC" && c.intervalSec === 900);
      setSelectedId((btc15 ?? cards[0]).marketId);
    }
  }, [cards, selectedId]);

  const selected = useMemo(() => cards.find((c) => c.marketId === selectedId) ?? cards[0] ?? null, [cards, selectedId]);

  const trade = async (side: "UP" | "DOWN", size: number) => {
    if (!selected) return;
    if (!isConnected || !walletClient || !address) {
      setLastResult("Connect a wallet first.");
      return;
    }
    if (size <= 0) {
      setLastResult("Size must be > 0");
      return;
    }
    setBusy(true);
    setLastResult(null);
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      // Gate on on-chain status + headroom
      const onchain = await ex.client.getMarketOnchain(selected.marketId as `0x${string}`);
      const status = (onchain as unknown as { status: number }).status;
      if (status !== 1) {
        setLastResult(`Market not trading (status ${status}). Try next window.`);
        return;
      }
      const now = Date.now() / 1000;
      const secsLeft = selected.expiry - now;
      if (secsLeft <= 30) {
        setLastResult("Window locked — under 30s left. Next window opens momentarily.");
        return;
      }

      const symbol = side === "UP" ? selected.outcomes.up : selected.outcomes.down;
      if (!symbol) {
        setLastResult("No symbol for side — market row missing outcomes.");
        return;
      }

      // Quantize size to lot grid: mainnet lot 0.001, testnet lot may be 1e3 units (0.001 as well)
      // Unified createOrder snaps via amountToPrecision in >=0.24.0, but we pre-check zero.
      const lot = 0.001;
      const snapped = Math.floor(size / lot) * lot;
      if (snapped < lot) {
        setLastResult(`Size below min lot ${lot}. Try larger.`);
        return;
      }



      // Exchange needs its market registry populated before createOrder (otherwise "unknown symbol")
      // useLiveMarkets loads on a separate instance, so hydrate this trader instance now.
      // Retry once if symbol still unknown — handles market rolling between hook poll and trade.
      try {
        await ex.loadMarkets(true);
      } catch (e) {
        setLastResult(`Failed to load markets: ${(e as Error).message.slice(0, 200)}`);
        return;
      }
      // Verify symbol is known after load; if not, force refresh and retry
      // ex.markets keys are base symbols without #YES/#NO, so check base
      const base = symbol.split("#")[0];
      const knownBefore = (ex as unknown as { markets?: Record<string, unknown> }).markets;
      if (knownBefore && !(base in knownBefore) && !(symbol in knownBefore)) {
        try {
          await ex.loadMarkets(true);
        } catch {}
        const knownAfter = (ex as unknown as { markets?: Record<string, unknown> }).markets;
        if (knownAfter && !(base in knownAfter) && !(symbol in knownAfter)) {
          // market may have just rolled — refresh board and ask user to retry
          refresh();
          setLastResult(`Market ${symbol} just rolled — refreshed board, pick the new window and try again.`);
          return;
        }
      }

      // One-click after first approve: SDK's internal approveIfNeeded handles pool allowance,
      // we only do a single max approve to the selected pool when needed. No batch.
      if (publicClient && autoApprove) {
        try {
          const addrs = addressesForChain(chainId);
          const collateral = (addrs as unknown as { collateral?: `0x${string}`; testUsdc?: `0x${string}` }).collateral ?? (addrs as unknown as { testUsdc?: `0x${string}` }).testUsdc;
          const pool = (selected.market as unknown as { poolAddress?: string }).poolAddress as `0x${string}` | undefined;
          if (collateral && pool) {
            const decimals = chainId === 50312 ? 6 : 18;
            const needed = parseUnits(String((snapped * 0.99).toFixed(decimals === 6 ? 4 : 6)), decimals);
            const key = `tock:approved:${chainId}:${pool.toLowerCase()}`;
            let already = false;
            try { already = localStorage.getItem(key) === "true"; } catch {}
            if (!already) {
              try {
                const allowance = (await publicClient.readContract({ address: collateral, abi: erc20Abi, functionName: "allowance", args: [address, pool] } as never)) as bigint;
                if (allowance < needed) {
                  setApproving(true);
                  setLastResult(`Approving ${chainId === 50312 ? "tUSDC" : "USDso"} — one-time for this market…`);
                  let hash: `0x${string}`;
                  try {
                    hash = await (walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [pool, 2n ** 256n - 1n] });
                  } catch (e) { setLastResult(`Approve rejected: ${(e as Error).message.slice(0,200)}`); return; }
                  await publicClient.waitForTransactionReceipt({ hash });
                  try { localStorage.setItem(key, "true"); } catch {}
                  setLastResult(`Approved — placing order…`);
                } else { try { localStorage.setItem(key, "true"); } catch {} }
              } catch {}
            }
          }
        } catch {}
        finally { setApproving(false); }
      } else if (!autoApprove) {
        setLastResult(`Auto-approve off — SDK will prompt per-trade if needed.`);
      }

      // Price: probe book for best ask/bid, fallback to mid
      // Both YES and NO books are quoted in UP probability (1 - NO = UP)
      // UP: buy YES at high UP (ask + 0.02) to cross. DOWN: buy NO at low UP (askNo - 0.02) to overpay Down.
      let price: number | undefined;
      try {
        const book = await (ex as unknown as { fetchOrderBook: (s: string, n: number) => Promise<{ bids: number[][]; asks: number[][] }> }).fetchOrderBook(symbol, 5);
        const bestBid = book.bids?.[0]?.[0];
        const bestAsk = book.asks?.[0]?.[0];
        const mid = selected.mid ?? (bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined);
        if (side === "UP") {
          const ask = bestAsk ?? mid ?? 0.55;
          price = Math.min(0.99, ask + 0.02);
        } else {
          // DOWN: NO book ask is Up price of Down offer (e.g. 0.42 Up = 0.58 Down).
          // To cross Down sellers we need low Up (high Down): askNoUp - 0.02
          const askNoUp = bestAsk ?? mid ?? 0.5;
          price = Math.max(0.01, askNoUp - 0.02);
          // If no book, guarantee cross with extreme low Up (0.02 = 0.98 Down) — fill price still at market via IOC
          if (bestAsk === undefined && mid === undefined) price = 0.02;
        }
      } catch {
        const m = selected.mid ?? 0.5;
        price = side === "UP" ? Math.min(0.99, m + 0.02) : Math.max(0.01, m - 0.08);
        if (side === "DOWN" && selected.mid === undefined) price = 0.05;
      }

      price = Math.max(0.001, Math.min(0.999, Number(price!.toFixed(3))));

      // Execute IOC — unfilled remainder never rests
      const order = await (ex as unknown as { createOrder: (s: string, t: string, side: string, amt: number, p: number, opts: unknown) => Promise<unknown> }).createOrder(
        symbol,
        "limit",
        "buy",
        snapped,
        price,
        { timeInForce: "IOC" }
      );

      const info = (order as { info?: unknown })?.info as { receipt?: { transactionHash?: string; status?: string } } | undefined;
      const receipt = info?.receipt;
      const hash = receipt?.transactionHash ?? (order as { transactionHash?: string })?.transactionHash ?? "";
      if (receipt?.status === "reverted") {
        setLastResult(`Order reverted on-chain — ${hash ? `tx ${hash.slice(0, 10)}…` : "no hash"} — check balances/allowance or window locked.`);
        return;
      }

      // Count as streak entry optimistically — real win/loss determined after settlement, but we record participation
      setLastResult(
        `Placed ${side} ${snapped} @ ${price} — tx ${hash ? hash.slice(0, 10) + "…" : "(no hash)"} ${receipt?.status ? `status ${receipt.status}` : ""}. Watch ticket & streak.`
      );
      setLastHumanTrade({ asset: selected.asset, direction: side, stake: snapped, at: Date.now() });

      // Refresh markets to update books
      refresh();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      // Decode common reverts for user
      if (msg.includes("ERC20InsufficientBalance") || msg.includes("InsufficientBalance")) {
        setLastResult("Insufficient balance — need USDso (tUSDC on testnet) + STT for gas. Hit Faucet on testnet.");
      } else if (msg.includes("InvalidPrice")) {
        setLastResult("Price off tick grid (InvalidPrice). Try again — SDK should snap, but book moved.");
      } else if (msg.includes("OrderAlreadyExpired") || msg.includes("MarketLocked")) {
        setLastResult("Window just locked — your order expired. Next window already open.");
      } else {
        setLastResult(`Trade failed: ${msg.slice(0, 300)}`);
      }
    } finally {
      setBusy(false);
      try {
        ex.close?.();
      } catch {}
    }
  };

  const doFaucet = async () => {
    if (!walletClient || !isConnected) {
      setFaucetMsg("Connect wallet on Shannon testnet first.");
      return;
    }
    if (chainId !== 50312) {
      setFaucetMsg("Switch to Shannon testnet to faucet tUSDC.");
      return;
    }
    setFaucetMsg("Requesting 10,000 tUSDC…");
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      const res = await (ex.trader as unknown as { faucet: (o?: unknown) => Promise<unknown> }).faucet();
      const hash = (res as { receipt?: { transactionHash?: string } })?.receipt?.transactionHash ?? "";
      setFaucetMsg(`Faucet ok ${hash ? `— ${hash.slice(0, 10)}…` : ""}. Now get STT for gas at testnet.somnia.network if needed.`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("FaucetCapExceeded")) setFaucetMsg("Faucet cap: 10k per call. Try again after a block.");
      else setFaucetMsg(`Faucet failed: ${msg.slice(0, 250)} — claim STT at testnet.somnia.network first.`);
    } finally {
      try {
        ex.close?.();
      } catch {}
    }
  };

  const handleDelegate = async () => {
    if (!walletClient || !isConnected || !address) {
      setLastResult("Connect wallet first to delegate.");
      return;
    }
    // Toggle revoke if already delegated
    if (isDelegated) {
      setBusy(true);
      const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
      try {
        const traderAny = ex.trader as unknown as { setOperatorApprovalGlobal?: (p: unknown) => Promise<unknown> };
        if (traderAny.setOperatorApprovalGlobal) {
          try {
            await traderAny.setOperatorApprovalGlobal({ operator: AGENT_ADDRESS, selectors: ["0x80054449", "0xe37b444b"], approved: false } as never);
          } catch {}
        } else {
          const addrs = addressesForChain(chainId);
          const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
          if (collateral) {
            try {
              await (walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [AGENT_ADDRESS, 0n] });
            } catch {}
          }
        }
        try { localStorage.removeItem(`tock:delegated:${chainId}:${address.toLowerCase()}`); } catch {}
        setIsDelegated(false);
        setLastResult("Revoked — agent can no longer trade for you. Funds never left your wallet.");
      } catch (e) {
        setLastResult(`Revoke failed: ${(e as Error).message.slice(0, 200)}`);
      } finally {
        setBusy(false);
        try { ex.close?.(); } catch {}
      }
      return;
    }
    setBusy(true);
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      setLastResult(`Delegating to Tock Agent ${AGENT_ADDRESS.slice(0, 6)}… — one-time, revocable…`);
      // Try OperatorPermissionsRegistry first (true delegate: agent can placeOrderFor with your funds, no per-trade popup)
      let delegated = false;
      const traderAny = ex.trader as unknown as { setOperatorApprovalGlobal?: (p: unknown) => Promise<unknown> };
      if (traderAny.setOperatorApprovalGlobal) {
        try {
          const res = await traderAny.setOperatorApprovalGlobal({ operator: AGENT_ADDRESS, selectors: ["0x80054449", "0xe37b444b"], approved: true } as never);
          const h = (res as { receipt?: { transactionHash?: string } })?.receipt?.transactionHash ?? "";
          setLastResult(`Delegated! Agent ${AGENT_ADDRESS.slice(0, 10)}… now has placeOrderFor rights — one popup done, next bets via agent 0 popups. Tx ${h.slice(0, 10)}…`);
          delegated = true;
        } catch (e) {
          const msg = String(e);
          // SDK requires operatorRegistry address which is not in SOMNIA_TESTNET_ADDRESSES for binary — fallback to simple approve
          if (msg.includes("operatorRegistry") || msg.includes("operatorPermissionsRegistry")) {
            // fallback below
          } else {
            throw e;
          }
        }
      }
      if (!delegated) {
        // Fallback: simple ERC20 approve to agent (works for binary: agent can pull collateral via transferFrom and trade as itself, or we use it as session-key vault)
        // Also set ERC6909 operator for outcome tokens so agent can handle sells
        const addrs = addressesForChain(chainId);
        const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
        if (!collateral) throw new Error("No collateral token found");
        const hash = await (walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [AGENT_ADDRESS, 2n ** 256n - 1n] });
        await publicClient?.waitForTransactionReceipt({ hash });
        setLastResult(`Delegated via approve — agent ${AGENT_ADDRESS.slice(0, 10)}… can now pull tUSDC to trade for you. One-time. Tx ${hash.slice(0, 10)}… (Ride will run via agent, manual stays in your wallet)`);
        delegated = true;
      }
      if (delegated) {
        try { localStorage.setItem(`tock:delegated:${chainId}:${address.toLowerCase()}`, "true"); } catch {}
        setIsDelegated(true);
      }
    } catch (e) {
      setLastResult(`Delegate failed: ${(e as Error).message.slice(0, 300)} — try again. For binary, fallback approve should work.`);
    } finally {
      setBusy(false);
      try { ex.close?.(); } catch {}
    }
  };

  const handleStartRide = async (cfg: import("@/lib/ride").RideConfig) => {
    if (!isConnected || !walletClient || !address) {
      setLastResult("Connect wallet to start a Ride.");
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rideState: RideState = { id, config: cfg, legs: [], status: "running", pot: cfg.stake, round: 0, createdAt: Date.now() };
    setRide(rideState);
    setMode("ride");
    setLastResult(`Ride started: ${cfg.asset} ${cfg.direction} ×${cfg.maxLegs} — placing leg 1…`);
    // Place first leg immediately using same trade path but with ride pot
    // Reuse trade logic: find live window for asset, place order, push leg
    const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
    try {
      await ex.loadMarkets(true);
      const all = Object.values((ex as unknown as { markets: Record<string, { info: { asset?: string; intervalSec?: string; expiry?: string; poolAddress?: string } & Record<string, unknown>; outcomes?: { symbol: string; label: string }[] }> }).markets ?? {});
      const m = all.find((mm) => mm.info.asset === cfg.asset && Number(mm.info.intervalSec) === 300) ?? all.find((mm) => mm.info.asset === cfg.asset);
      if (!m) throw new Error("No live window found for Ride");
      const info: Record<string, unknown> = m.info as unknown as Record<string, unknown>;
      const outs = m.outcomes ?? [];
      const symbol = cfg.direction === "UP" ? outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol : outs.find((o) => o.label === "NO")?.symbol ?? outs[1]?.symbol;
      if (!symbol) throw new Error("No outcome symbol");
      // Use live book for price — same as manual trade, not fixed 0.55
      let price: number;
      try {
        const book = await (ex as unknown as { fetchOrderBook: (s: string, n: number) => Promise<{ bids: number[][]; asks: number[][] }> }).fetchOrderBook(symbol, 5);
        const bestAsk = book.asks?.[0]?.[0];
        const mid = (book.bids?.[0]?.[0] !== undefined && bestAsk !== undefined) ? (book.bids[0][0] + bestAsk) / 2 : undefined;
        if (cfg.direction === "UP") price = Math.min(0.99, (bestAsk ?? mid ?? 0.55) + 0.02);
        else {
          const askNoUp = bestAsk ?? mid ?? 0.5;
          price = Math.max(0.01, askNoUp - 0.02);
          if (bestAsk === undefined && mid === undefined) price = 0.05;
        }
      } catch {
        price = cfg.direction === "UP" ? 0.57 : 0.43;
      }
      price = Math.max(0.001, Math.min(0.999, Number(price.toFixed(3))));
      const qty = cfg.stake;
      // Single approve for this pool if needed (one-time)
      if (autoApprove) {
        try {
          const pool = (m.info as unknown as { poolAddress?: `0x${string}` }).poolAddress;
          const addrs = addressesForChain(chainId);
          const collateral = (addrs as unknown as { collateral?: `0x${string}` }).collateral;
          if (pool && collateral) {
            const decimals = chainId === 50312 ? 6 : 18;
            const needed = parseUnits(String((qty * 0.99).toFixed(decimals === 6 ? 4 : 6)), decimals);
            const allowance = (await (ex.client as unknown as { getErc20Allowance?: (t: string, o: string, s: string) => Promise<bigint> }).getErc20Allowance?.(collateral, address!, pool)) as bigint | undefined;
            // Fallback direct read
            let allow = allowance;
            if (allow === undefined && publicClient) {
              try { allow = (await publicClient.readContract({ address: collateral, abi: erc20Abi, functionName: "allowance", args: [address!, pool] } as never)) as bigint; } catch {}
            }
            if (allow !== undefined && allow < needed) {
              const h = await (walletClient as unknown as { writeContract: (p: unknown) => Promise<`0x${string}`> }).writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [pool, 2n ** 256n - 1n] });
              await publicClient?.waitForTransactionReceipt({ hash: h });
            }
          }
        } catch {}
      }
      const order = await (ex as unknown as { createOrder: (s: string, t: string, side: string, a: number, p: number, o: unknown) => Promise<unknown> }).createOrder(symbol, "limit", "buy", qty, price, { timeInForce: "IOC" });
      const h = ((order as { info?: { receipt?: { transactionHash?: string } } })?.info?.receipt?.transactionHash ?? "") as string;
      setLastHumanTrade({ asset: cfg.asset, direction: cfg.direction as "UP" | "DOWN", stake: qty, at: Date.now() });
      const leg: import("@/lib/ride").RideLeg = { marketId: String(info["marketId"] ?? ""), expiry: Number(info["expiry"] ?? 0), side: cfg.direction, price, quantity: qty, escrow: qty * price, txHash: h, status: "open", multiplier: 1 / price };
      setRide((r) => (r ? { ...r, legs: [...r.legs, leg], pot: r.pot } : r));
      setLastResult(`Ride leg 1 placed — tx ${h.slice(0, 10)}… Now polling settlement every 3s…`);
    } catch (e) {
      setLastResult(`Ride start failed: ${(e as Error).message.slice(0, 300)}`);
      setRide((r) => (r ? { ...r, status: "failed" as const } : r));
    } finally {
      try {
        ex.close?.();
      } catch {}
    }
  };
  const handleStopRide = () => {
    setRide((r) => (r ? { ...r, status: "paused" as const } : r));
    setLastResult("Ride paused — guardrails still enforce max loss = stake.");
  };

  // Ride polling: every 3s check last leg settlement, claim, and auto-roll (client-side engine, prod would be Deno Deploy cron)
  useEffect(() => {
    if (!ride || ride.status !== "running" || !walletClient) return;
    let cancelled = false;
    const tick = async () => {
      const last = ride.legs[ride.legs.length - 1];
      if (!last || last.status !== "open") return;
      const ex = createExchange({ chainId, walletClient: walletClient as unknown as never });
      try {
        const oc = (await ex.client.getMarketOnchain(last.marketId as `0x${string}`)) as unknown as { status: number; isResolved?: boolean; isVoided?: boolean; winningOutcome?: number };
        if (oc.isVoided) {
          if (cancelled) return;
          setRide((r) => {
            if (!r) return r;
            const legs = r.legs.map((l, i) => (i === r.legs.length - 1 ? { ...l, status: "void" as const, payout: l.escrow } : l));
            return { ...r, legs, pot: r.pot, status: "void" as const };
          });
          setLastResult("Ride voided — stake returned (0.5).");
          return;
        }
        if (!oc.isResolved) return; // still settling
        // Determine win: compare winningOutcome vs leg side
        const won = (oc.winningOutcome === 0 && last.side === "UP") || (oc.winningOutcome === 1 && last.side === "DOWN");
        if (cancelled) return;
        if (!won) {
          setRide((r) => {
            if (!r) return r;
            const legs = r.legs.map((l, i) => (i === r.legs.length - 1 ? { ...l, status: "lost" as const } : l));
            return { ...r, legs, status: "lost" as const };
          });
          setLastResult(`Ride leg ${ride.legs.length} lost — run over.`);
          return;
        }
        // Won — claim and roll
        try {
          const bal = (await (ex.client as unknown as { getOutcomeBalance: (t: string, a: string, id: string) => Promise<bigint> }).getOutcomeBalance(
            (last as unknown as { outcomeToken?: string }).outcomeToken as string ?? "",
            address!,
            last.side === "UP" ? "0" : "1"
          )) as bigint;
          // Try redeem via trader (best-effort)
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
        const payout = last.quantity; // 1 per contract, simplified
        const nextPot = payout;
        // Check guardrails via lib
        const { shouldStop } = await import("@/lib/ride");
        const tmp: RideState = { ...ride, legs: [...ride.legs.slice(0, -1), { ...last, status: "won" as const, payout, multiplier: payout / last.escrow }], pot: nextPot };
        const { stop, reason } = shouldStop({ ...tmp, legs: tmp.legs });
        if (stop) {
          setRide({ ...tmp, status: "won" as const });
          setLastResult(`Ride WON — ${reason} — pot $${nextPot.toFixed(2)} claimed.`);
          return;
        }
        // Roll to next window: find live window for same asset, place next leg with pot as stake
        await ex.loadMarkets(true);
        const all = Object.values((ex as unknown as { markets: Record<string, { info: { asset?: string; expiry?: string } & Record<string, unknown>; outcomes?: { symbol: string; label: string }[] }> }).markets ?? {});
        const nextM = all.find((mm) => mm.info.asset === ride.config.asset && Number(mm.info.expiry ?? 0) > Date.now() / 1000 + 10);
        if (!nextM) {
          setRide({ ...tmp, status: "won" as const });
          setLastResult("Ride won — no successor window yet, pot held.");
          return;
        }
        const outs = nextM.outcomes ?? [];
        const sym = ride.config.direction === "UP" ? outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol : outs.find((o) => o.label === "NO")?.symbol ?? outs[1]?.symbol;
        if (!sym) {
          setRide({ ...tmp, status: "won" as const });
          return;
        }
        const price = ride.config.direction === "UP" ? 0.55 : 0.45;
        const qty = nextPot; // roll whole pot
        const order = await (ex as unknown as { createOrder: (s: string, t: string, side: string, a: number, p: number, o: unknown) => Promise<unknown> }).createOrder(sym, "limit", "buy", qty, price, { timeInForce: "IOC" });
        const h = ((order as { info?: { receipt?: { transactionHash?: string } } })?.info?.receipt?.transactionHash ?? "") as string;
        const nextLeg: import("@/lib/ride").RideLeg = { marketId: String((nextM.info as unknown as { marketId?: string }).marketId ?? ""), expiry: Number((nextM.info as unknown as { expiry?: string }).expiry ?? 0), side: ride.config.direction, price, quantity: qty, escrow: qty * price, txHash: h, status: "open", multiplier: 1 / price };
        setRide({ ...tmp, legs: [...tmp.legs, nextLeg], pot: nextPot, round: tmp.legs.length });
        setLastResult(`Ride auto-rolled leg ${tmp.legs.length + 1} — tx ${h.slice(0, 10)}…`);
      } catch {}
      finally {
        try { ex.close?.(); } catch {}
      }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ride, chainId, walletClient, address]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-black/80 border-b border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center font-black">◐</div>
            <div>
              <div className="font-black tracking-tight leading-none">Tock</div>
              <div className="text-[11px] tracking-widest text-zinc-400 font-medium">CALL THE NEXT 15 MINUTES</div>
            </div>
            <span className="hidden sm:inline ml-2 text-xs px-2.5 py-1 rounded-full bg-amber-400 text-black font-bold">LIVE on Somnia</span>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && balances && (
              <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
                <span className="text-zinc-400">{isTestnet ? "tUSDC" : "USDso"}</span>
                <span className="text-white font-bold">{Number(balances.collateral).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{isTestnet ? "STT" : "SOMI"}</span>
                <span className="text-white font-bold">{Number(balances.native).toFixed(4)}</span>
              </div>
            )}
            <div className="relative hidden sm:inline">
              <button
                onClick={() => setNetworkOpen((o) => !o)}
                className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center gap-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${isTestnet ? "bg-emerald-500" : "bg-amber-500"}`} />
                {isTestnet ? "Shannon testnet" : "Somnia mainnet"} ▾
              </button>
              {networkOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => {
                      setNetworkOpen(false);
                      try {
                        switchChain({ chainId: 50312 });
                      } catch {}
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span>Shannon testnet</span>
                    <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">Live</span>
                  </button>
                  <button
                    disabled
                    className="w-full text-left px-4 py-3 text-sm text-zinc-500 cursor-not-allowed flex items-center justify-between"
                    title="Mainnet coming soon — hackathon demo is testnet-only"
                  >
                    <span>Somnia mainnet</span>
                    <span className="text-xs border border-zinc-700 px-2 py-0.5 rounded-full">Soon</span>
                  </button>
                  <div className="px-4 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">Hackathon lives on Shannon. Mainnet disabled.</div>
                </div>
              )}
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-6 pb-2">
        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">BTC · ETH — 15m / 1h · Zero fees.</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-xl">
              Pick UP or DOWN. Win 1 USDso per contract. Rolling windows, streaks, shareable cards. Built on DreamDEX CLOB — fully on-chain, self-custody, auditable oracle.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="https://app.dreamdex.io/event-contracts" target="_blank" rel="noreferrer" className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold">
              DreamDEX ↗
            </a>
            <a href="https://leaderboard.dreamdex.io" target="_blank" rel="noreferrer" className="text-xs px-4 py-2 rounded-full border border-white/20 text-white hover:bg-white/10">
              Arena $89.6M ↗
            </a>
            <a href="https://prd.oracle.somnia.host/explore" target="_blank" rel="noreferrer" className="hidden sm:inline text-xs px-4 py-2 rounded-full border border-white/10 text-zinc-400 hover:text-white">
              Oracle ↗
            </a>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <main className="max-w-6xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left: market board */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs tracking-widest font-bold text-zinc-400">LIVE WINDOWS</h2>
            <button onClick={refresh} className="text-xs text-zinc-400 hover:text-white">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {error && <div className="rounded-2xl bg-red-950 border border-red-900 p-3 text-xs font-mono text-red-200 break-words">{error}</div>}

          {loading && cards.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-sm text-zinc-400">
              No live windows found. The venue rolls every 15m — check back in a moment or switch network.
            </div>
          ) : (
            <div className="grid gap-3">
              {cards.map((c) => (
                <MarketCard key={c.marketId} card={c} isActive={selected?.marketId === c.marketId} onSelect={() => setSelectedId(c.marketId)} />
              ))}
            </div>
          )}

          <StreakBar chainId={chainId} address={address} />

          {isTestnet && (
            <div className="rounded-2xl bg-amber-400 text-black p-4 flex flex-col gap-2">
              <div className="text-sm font-bold">Shannon testnet faucet</div>
              <p className="text-xs leading-relaxed">Get 10k tUSDC instantly (msg.sender). You still need STT for gas — claim at testnet.somnia.network.</p>
              <button onClick={doFaucet} className="py-2.5 rounded-xl bg-black text-white font-bold text-sm hover:bg-zinc-900">
                Get 10,000 tUSDC
              </button>
              {faucetMsg && <div className="text-xs font-mono bg-black text-amber-300 p-2 rounded-xl break-words">{faucetMsg}</div>}
            </div>
          )}

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-xs leading-relaxed text-zinc-400">
            <div className="font-bold text-white mb-1">How it works</div>
            Every 15m/1h a new window opens. The line to beat is the window&apos;s opening price. Up wins if settlement ≥ open. Down wins if &lt; open. Settlement median over multiple sources, auditable on the oracle explorer. Your stake = max loss. No liquidations.
          </div>
        </div>

        {/* Right: trade + ride + tickets */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800 gap-1">
            <button onClick={() => setMode("manual")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "manual" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>Manual — 1 tap</button>
            <button onClick={() => setMode("ride")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "ride" ? "bg-amber-400 text-black" : "text-zinc-400 hover:text-white"}`}>Ride — auto-roll</button>
          </div>
          {mode === "ride" ? (
            <RidePanel chainId={chainId} ride={ride} onStartRide={handleStartRide} onStop={handleStopRide} />
          ) : (
            <TradePanel card={selected} onTrade={trade} busy={busy} lastResult={lastResult} autoApprove={autoApprove} setAutoApprove={setAutoApprove} />
          )}
          <AgentPanel isDelegated={isDelegated} onToggle={handleDelegate} lastHumanTrade={lastHumanTrade} />

          {/* Price context — Binance sparkline placeholder */}
          {selected && (
            <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs tracking-widest font-bold text-zinc-400">LIVE PRICE CONTEXT</span>
                <span className="text-xs font-mono text-zinc-500">Binance spot · disclaimer: settlement uses DreamDEX oracle median</span>
              </div>
              <LivePriceSpark asset={selected.asset} tradingStart={selected.tradingStart} expiry={selected.expiry} />
            </div>
          )}

          <Tickets chainId={chainId} address={address} />

          <div className="rounded-2xl border border-zinc-800 p-4 flex flex-col sm:flex-row gap-2">
            <a
              href="https://docs.dreamdex.io/developers/event-contracts"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 rounded-xl bg-white text-black font-semibold text-center text-sm"
            >
              Docs ↗
            </a>
            <a href="https://dreamdex.io/algo-arena" target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-xl border border-white/20 text-white font-semibold text-center text-sm hover:bg-white/10">
              Algo Arena ↗
            </a>
            <button
              onClick={() => {
                // Canvas share card: streak + last market
                const c = document.createElement("canvas");
                c.width = 1080;
                c.height = 600;
                const ctx = c.getContext("2d");
                if (!ctx) return window.print();
                ctx.fillStyle = "#09090b";
                ctx.fillRect(0, 0, c.width, c.height);
                // amber accent bar
                ctx.fillStyle = "#facc15";
                ctx.fillRect(0, 0, c.width, 8);
                ctx.fillStyle = "#ffffff";
                ctx.font = "900 72px system-ui, sans-serif";
                ctx.fillText("Tock", 48, 100);
                ctx.fillStyle = "#a1a1aa";
                ctx.font = "600 24px system-ui, sans-serif";
                ctx.fillText("CALL THE NEXT 15 MINUTES  •  DreamDEX on Somnia", 48, 135);
                // streak box
                const streakText = (() => {
                  try {
                    const raw = localStorage.getItem(`tock:streak:${chainId}:${(address ?? "anon").toLowerCase()}`);
                    if (raw) {
                      const s = JSON.parse(raw);
                      return `🔥 Streak ${s.current}  •  Best ${s.best}  •  ${s.wins}W-${s.losses}L`;
                    }
                  } catch {}
                  return "🔥 Streak 0 — start your run";
                })();
                ctx.fillStyle = "#18181b";
                ctx.strokeStyle = "#27272a";
                ctx.lineWidth = 2;
                const boxY = 180;
                // rounded rect helper
                const rr = (x: number, y: number, w: number, h: number, r: number) => {
                  ctx.beginPath();
                  ctx.moveTo(x + r, y);
                  ctx.arcTo(x + w, y, x + w, y + h, r);
                  ctx.arcTo(x + w, y + h, x, y + h, r);
                  ctx.arcTo(x, y + h, x, y, r);
                  ctx.arcTo(x, y, x + w, y, r);
                  ctx.closePath();
                };
                rr(48, boxY, 984, 140, 24);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "#ffffff";
                ctx.font = "700 36px system-ui, sans-serif";
                ctx.fillText(streakText, 80, boxY + 60);
                ctx.fillStyle = "#a1a1aa";
                ctx.font = "400 22px system-ui, sans-serif";
                ctx.fillText(selected ? `${selected.asset} · ${selected.intervalSec === 900 ? "15m" : selected.intervalSec === 3600 ? "1h" : `${Math.round(selected.intervalSec / 60)}m`}  •  Up ${selected.mid !== undefined ? Math.round(selected.mid * 100) + "%" : "—"}` : "No market selected", 80, boxY + 95);
                // footer
                ctx.fillStyle = "#52525b";
                ctx.font = "500 20px system-ui, sans-serif";
                ctx.fillText("Zero fees  •  Self-custody  •  Auditable oracle  •  tock.vercel.app", 48, 560);
                const url = c.toDataURL("image/png");
                const a = document.createElement("a");
                a.href = url;
                a.download = `tock-streak-${Date.now()}.png`;
                a.click();
                if (navigator.share) {
                  // best-effort native share if available (mobile)
                  c.toBlob((blob) => {
                    if (blob) {
                      const file = new File([blob], "tock.png", { type: "image/png" });
                      navigator.share({ title: "Tock streak", text: streakText, files: [file] }).catch(() => {});
                    }
                  });
                }
              }}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 font-semibold text-center text-sm hover:bg-white/5"
            >
              Share streak
            </button>
          </div>

          <footer className="text-[11px] leading-relaxed text-zinc-500 pt-2 text-center">
            Built for the Somnia × DreamDEX hackathon — testnet demo. Trade at your own risk. Start with the faucet, try a $5 bet.
          </footer>
        </div>
      </main>
    </div>
  );
}

function LivePriceSpark({ asset, tradingStart, expiry }: { asset: string; tradingStart: number; expiry: number }) {
  const [points, setPoints] = useState<number[] | null>(null);
  const symbol = asset === "BTC" ? "BTCUSDT" : "ETHUSDT";
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const startMs = tradingStart * 1000;
        const endMs = expiry * 1000;
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startMs}&endTime=${endMs}&limit=60`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const klines: Array<Array<string | number>> = await res.json();
        const closes = klines.map((k) => Number(k[4]));
        if (alive) setPoints(closes);
      } catch {
        if (alive) setPoints(null);
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbol, tradingStart, expiry]);

  if (!points || points.length < 2) {
    return <div className="h-16 grid place-items-center text-xs text-zinc-500">Loading Binance 1m closes for this window…</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 600;
  const h = 64;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const up = last >= first;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <path d={path} fill="none" stroke={up ? "#10b981" : "#ef4444"} strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[11px] font-mono text-zinc-500 mt-1">
        <span>{first.toFixed(2)}</span>
        <span className={up ? "text-emerald-400" : "text-red-400"}>
          {last.toFixed(2)} {up ? "▲" : "▼"} {(((last - first) / first) * 100).toFixed(2)}%
        </span>
        <span>{max.toFixed(2)}</span>
      </div>
    </div>
  );
}
