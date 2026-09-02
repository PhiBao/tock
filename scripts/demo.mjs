#!/usr/bin/env node
/* Tock demo — the full read path in ~60s, no wallet, no keys.
 * Proves SDK wiring end to end: indexer → live BTC/ETH windows →
 * on-chain status gate → order-book mids. This is the same data plane
 * the UI trades on (writes additionally need a wallet + faucet).
 *
 *   pnpm demo
 */
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, isBinaryMarket } from "@somnia-chain/markets-sdk";
import { defineChain } from "viem";

const shannon = defineChain({
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.infra.testnet.somnia.network"] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" } },
  testnet: true,
});

const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms: ${label}`)), ms))]);

const cadence = (s) => (s === 900 ? "15m" : s === 3600 ? "1h" : s === 300 ? "5m" : `${Math.round(s / 60)}m`);
const mmss = (expiry) => {
  const s = Math.max(0, Math.floor(expiry - Date.now() / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

console.log("Tock demo — DreamDEX Event Contracts on Somnia Shannon (50312)\n");

const ex = new SomniaMarkets({
  chain: shannon,
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
});

try {
  console.log("1/3  Loading markets from indexer…");
  const all = await withTimeout(ex.loadMarkets(true), 30000, "loadMarkets");
  const live = Object.values(all)
    .filter((m) => m.type === "binary" && isBinaryMarket(m.info))
    .filter((m) => (m.info.asset === "BTC" || m.info.asset === "ETH") && m.active)
    .sort((a, b) => Number(a.info.expiry ?? 0) - Number(b.info.expiry ?? 0));
  console.log(`     → ${Object.keys(all).length} markets indexed, ${live.length} live BTC/ETH windows\n`);

  if (!live.length) {
    console.log("No live windows right now — the venue rolls every 15 minutes. Try again shortly.");
    process.exit(0);
  }

  console.log("2/3  Gating on on-chain status + reading books…");
  console.log("     ASSET  CADENCE  UP%    BBO          CLOSES IN  STATUS  ID");
  for (const u of live.slice(0, 8)) {
    const r = u.info;
    const outs = u.outcomes ?? [];
    const up = outs.find((o) => o.label === "YES")?.symbol ?? outs[0]?.symbol ?? "";
    let bid = "—";
    let ask = "—";
    let mid = "—";
    if (up && typeof ex.fetchOrderBook === "function") {
      try {
        const book = await withTimeout(ex.fetchOrderBook(up, 5), 20000, `book ${up}`);
        const b = book.bids?.[0]?.[0];
        const a = book.asks?.[0]?.[0];
        if (b !== undefined && a !== undefined) {
          bid = `${Math.round(b * 100)}`;
          ask = `${Math.round(a * 100)}`;
          mid = `${Math.round(((b + a) / 2) * 100)}%`;
        } else if (b !== undefined || a !== undefined) {
          mid = `${Math.round(((b ?? a) ?? 0) * 100)}%*`;
        }
      } catch {
        mid = "book err";
      }
    }
    let status = "?";
    try {
      const oc = await withTimeout(ex.client.getMarketOnchain(String(r.marketId)), 20000, "getMarketOnchain");
      status = String(oc.status);
    } catch {
      status = "rpc err";
    }
    const expiry = Number(r.expiry ?? 0);
    console.log(
      `     ${(r.asset ?? "?").padEnd(6)} ${cadence(Number(r.intervalSec ?? 0)).padEnd(8)} ${mid.padEnd(6)} ${`${bid}/${ask}`.padEnd(12)} ${mmss(expiry).padEnd(9)} ${String(status).padEnd(7)} #${String(r.marketId).slice(-6)}`
    );
  }

  console.log("\n3/3  Contracts (Shannon, CREATE3):");
  for (const [k, v] of Object.entries({ binaryModule: SOMNIA_TESTNET_ADDRESSES.binaryModule, binarySettlement: SOMNIA_TESTNET_ADDRESSES.binarySettlement, oracleHub: SOMNIA_TESTNET_ADDRESSES.oracleHub, testUsdc: SOMNIA_TESTNET_ADDRESSES.testUsdc })) {
    console.log(`     ${k.padEnd(17)} ${v}`);
  }

  console.log("\nDone. Read path verified — open the UI, faucet 10k tUSDC, place a call.");
} catch (e) {
  console.error(`\nDemo failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  try {
    await ex.close?.();
  } catch {}
  // The SDK keeps a WS handle open; force exit so `pnpm demo` returns.
  setTimeout(() => process.exit(process.exitCode ?? 0), 250).unref?.();
  process.exit(process.exitCode ?? 0);
}
