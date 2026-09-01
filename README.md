# Tock — Call the next 15 minutes

> The 15-minute arcade for BTC/ETH direction on DreamDEX. Zero fees, self-custody, streaks, shareable win cards. Built on Somnia.

Live windows, countdown-driven, one-tap **UP/DOWN** on the next 15m / 1h / 5m BTC/ETH event contracts. Fully on-chain CLOB, fully client-side, no backend.

**Stack:** Next.js 15 + TypeScript + Tailwind v4 + wagmi v2 + viem v2 + `@somnia-chain/markets-sdk@^0.28.1` · pnpm · Somnia 5031 (mainnet) / 50312 (Shannon testnet)

---

## Demo (2 min)

1. **Connect wallet** (top right) — injected (MetaMask/Rabby). Default chain is **Shannon testnet (50312)** for safe demo; switch to **Somnia mainnet (5031)** via the header toggle or your wallet.
2. **See LIVE WINDOWS** — BTC/ETH 5m/15m/1h cards with countdown, Up probability %, BBO, progress bar, and oracle audit link. Auto-refresh every 4 s.
3. **Call it** — pick **UP** (at or above open) or **DOWN** (below open), size **5 / 25 / 100** contracts (or custom), see cost vs. to-win preview, **Place UP/DOWN** (IOC, SDK snaps to 0.001 tick/lot). Tx hash + status shown.
4. **Watch streak** — 🔥 current/best, win rate, last 16 calls. Persists per chain+address in localStorage.
5. **Tickets & history** — `Refresh` scans last 40 `Finalized` markets for your balances; shows Up/Down held, status, winner. `Mark W/L` for demo streak, `Claim winnings` explains redeem scan (gotcha #10).
6. **Live price context** — 1m Binance closes for the window (disclaimer: settlement is DreamDEX oracle median).

**Faucet (Shannon):** On testnet, **Get 10,000 tUSDC** calls `trader.faucet()` to `msg.sender` (10k cap). You still need **STT for gas** — claim at [testnet.somnia.network](https://testnet.somnia.network) (or Google Cloud Web3 faucet).

---

## Run locally

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build && pnpm start
```

No env vars required. RPC/indexer are public: `api.infra.mainnet/testnet.somnia.network`, `prd/dev.smk.somnia.host/v1/graphql`.

### Verify the data plane (no wallet needed)

```bash
# Live markets + books on testnet
NODE_PATH=./node_modules npx tsx /tmp/check-live2.ts
# Mainnet
NODE_PATH=./node_modules npx tsx /tmp/check-main.ts
```

---

## How it maps to the DreamDEX docs

* **SDK entry:** `new SomniaMarkets({ chain, indexerUrl, wsRpcUrl, addresses, walletClient })` — unified `loadMarkets` → `isBinaryMarket` filter → `fetchOrderBook(symbol,5)` → `createOrder(symbol,limit,buy,qty,price,{timeInForce:"IOC"})` → `receipt` on `order.info`.
* **Gotchas handled:** Gate on `getMarketOnchain(marketId).status===1` + `secondsLeft>30`; SDK ≥0.28 snaps tick/lot (0.001); IOC only (no resting); expiry ns = `Date.now()/1000+30`; check `amountToPrecision` zero skip; reconcile wallet; key by `marketId`; scan `listBinaryMarkets({status:"Finalized"})` for redeem (voided → both sides 0.5, resolved → winner only, losing pays 0); read `asset`/`intervalSec` never parse question.
* **Prices:** `Binance api.binance.com/api/v3/klines` for intra-window spark (15 s poll), plus `getCandles(pool,60,{from:tradingStart,to:expiry})` available for on-chain candles.
* **Claim:** `getMarketOnchain` + `getOutcomeBalance(outcomeToken, address, yesId/noId)` + `trader.redeem({marketId, market, outcomeToken, outcomeIdx, amount})`.
* **Faucet:** `trader.faucet()` (6 dec tUSDC), cap 10k per call.

**Addresses (CREATE3, same on both chains):** BinaryMarketsModule `0x3ecC…e388`, indexer `prd/dev.smk.somnia.host`, chain 5031/50312.

---

## Judging criteria mapping

* **Innovation & Originality (20%)** — countdown/needle hero, not order book; mint-a-pair as social matching primitive; streak/history data loop no CEX exposes.
* **Technical (25%)** — SDK-native, version-floor correct, zero backend, viem signer, handles all 13 gotchas, client-side reactivity.
* **UX & Design (20%)** — mobile-first, 2-tap flow, intelligent defaults, one hero countdown, forgiving (IOC never rests, preview cost/payout).
* **Business & Ecosystem (20%)** — rides Algo Arena $89.6M volume, spot builder-fee rail ready (1% cap) for funding swaps, share cards for organic distribution, oralce explorer audit links build trust.
* **Presentation (15%)** — this README + 2–3 min demo (live windows, trade, streak, claim).

---

## Submission

* **Network:** Shannon testnet (50312) primary demo via `tUSDC` faucet; mainnet (5031) also live (BTC/ETH 5m/15m/1h at :45/:00).
* **Tracks:** Event Contracts Consumer Experience — arcade game, not bot/dashboard.
* **Repo:** this repo. **Demo video:** record the 2-min flow above (connect → call → streak → tickets refresh → faucet).

---

## Roadmap (post-hackathon)

* Rooms — invite-link private leagues (coordination layer over same book, mint-a-pair needs no counterparty).
* Edge coach drawer — "Why 0.62? BTC needs +0.38% in 8 min; vol model says 48% vs crowd 62%" from `getCandles`/`getFills` history.
* Spot funding swap with builder fees (`builderFeeBpsTimes1k`) embedded.
* Telegram Mini App + Farcaster Frame + Privy embedded wallets + push for next-window alerts.

---

## License

MIT — see `LICENSE`. This is a hackathon prototype, not audited, trade at your own risk. Start on testnet.
