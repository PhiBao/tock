# Tock — Product Definition

> **One line:** The 15-minute arcade for BTC/ETH direction on DreamDEX. Countdown-driven, one-tap UP/DOWN, streaks, shareable win cards. Zero fees, self-custody, fully on-chain.

## Thesis

Algo Arena proves demand: $89.6M volume on BTC/ETH 15m/1hr UP/DOWN, 8 weeks, zero fees. The official DreamDEX app exposes terminal complexity (symbols like `BTC-0-12AUG26-1600/USDso#YES`, tick 0.001, pool recycling, expiry ns). Casual retail wants a TikTok-simple loop: see countdown → tap side → pick $5/$25/$100 → watch needle → streak. Tock compresses a 7-step order flow into 2 taps, hides `marketId`/`pool`/`tickSize`, and turns settlement into a meme-able share card.

## Target User

* 22–34, Telegram/X native, holds $50–500 stables, has tried Binance Up/Down / Polymarket 15m / perps, churned due to fees or complexity.
* Behavior: checks BTC price 10–40×/day, wants 30-sec dopamine loops on phone.

## Core Problem (frequency × pain)

* Wants a $5 instant-resolution directional bet with no liquidation, no house edge, and a sense of progress. Today: Binance is custodial/opaque; DreamDEX terminal is complex; no streaks/share.
* Occurs every 15m (96/day) — highest frequency touchpoint in crypto prediction.

## Value Proposition

* One-tap `$5` in ~8 sec, watch 15m spot-vs-strike needle, streak animates on settlement, self-custody + oracle audit link (`prd.oracle.somnia.host/questions/{id}?view=graph`). Stake = max loss.

## MVP Scope (narrow but complete)

**In:**
1. Wallet connect (wagmi injected + WalletConnect, Somnia 5031/50312)
2. Network toggle (mainnet vs Shannon testnet) + testnet `faucet()` helper
3. Live board: BTC/ETH × 15m/1h = 4 windows max. Shows: asset, cadence, `closes in mm:ss` (live), Up probability %, spot-vs-strike live delta (Binance public price sparkline, disclaimer), book mid/BBO
4. One-tap trade: UP/DOWN, size presets $5/$25/$100 + custom, shows payout preview, executes IOC `createOrder`, shows fill price & actual `receipt` status, handles `PostOnlyWouldCross` / `InsufficientBalance` / `InvalidPrice`
5. Tickets: active positions (derived from `getOutcomeBalance` + `fetchMyTrades`), settled results via `listBinaryMarkets({status:"Finalized"})` scan, claim/redeem per market (`trader.redeem`)
6. Streaks/stats: localStorage + on-chain truth (`getUserFills`), current streak, best, win rate, history
7. Share card: canvas export `BTC 15m ✓ UP 0.62 → +$8 · Streak 6`

**Out (roadmap):**
* Rooms / private leagues (stub UI only)
* Spot funding swap with builder fees (documented, not in MVP flow — SDK supports but adds scope; show architecture note)
* Push notifications, Telegram Mini App, Farcaster Frame
* Privy embedded wallets (requires operator scope — post-MVP)

**Non-goals:** Dashboard/analytics portal, bot strategies, custom escrow pots.

## Architecture

* **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + pnpm, wagmi v2 + viem v2, `@somnia-chain/markets-sdk@^0.28.0`, no backend, fully client-side. Deployed static to Vercel/Cloudflare Pages.
* **Chains:** `somnia` (5031) `https://api.infra.mainnet.somnia.network`, `somniaShannon` (50312) `https://dream-rpc.somnia.network`. Explorers: `explorer.somnia.network`, `shannon-explorer.somnia.network`. Indexer via SDK `chain` param. Collateral: mainnet USDso `0x000...008A` (18 dec), testnet tUSDC `0x70a8...d8E` (6 dec) — derive scale via `decimals()` never hardcode.
* **SDK construction (frontend):**
  ```ts
  import { SomniaMarkets } from "@somnia-chain/markets-sdk"
  import { somnia, somniaShannon } from "./config/chains"
  // read-only:
  const exchange = new SomniaMarkets({ chain, indexerUrl, wsRpcUrl, addresses })
  // with signer:
  const exchange = new SomniaMarkets({ chain, indexerUrl, wsRpcUrl, addresses, privateKey: walletClient }) // via viem signer
  ```
  Verify exact constructor from package README after install (types autocomplete).
* **Data plane:**
  * Markets: `listLiveBinaryMarkets({limit:50})` → filter by `asset`/`intervalSec` → `getMarketOnchain(marketId as 0x${string})` gate `status===1` + `secondsLeft>30`
  * Book: `fetchOrderBook(upSymbol,5)` → mid, spread, BBO; Down = `1 - Up`
  * Price sparkline: `getCandles(pool,60,{from:tradingStart,to:expiry})` for on-chain, plus live Binance `api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&startTime=...` as live delta (CORS ok, disclaimer)
  * Positions: `getOutcomeBalance(outcomeToken, address, yesId/noId)` + `fetchMyTrades(symbol, since)`
  * History: `listPastBinaryMarkets({status:"Finalized", asset, limit:50})`, `countBinaryMarkets`, `getMarketResolution(marketId)` (`numericValue` open vs close), `getOpeningPrices([marketId])`, `getBinaryPositionPnL(account, marketId)`
  * Redeem: iterate `listBinaryMarkets({status:"Finalized", venueId})` sorted by `expiry` desc, check `isResolved/isVoided`, redeem `trader.redeem({marketId, market, outcomeToken, outcomeIdx, amount})` (voided: both sides 0.5, resolved: winner only; losing redeem pays 0 — check before gas)
* **State:** React hooks + `useMarket` realtime watches from SDK; localStorage for streak cache (key by chainId+address), on-chain as source of truth, reconcile on load.

## Edge Cases & Gotchas Coverage

| # | Gotcha | Handling |
|---|--------|----------|
| 1 | Indexer lags seconds | Gate every write on `getMarketOnchain` status 1 |
| 2 | Revert reach | SDK ≥0.28.0 throws decoded error; unified `order.info.reciept`, not `order.receipt` — read `(order.info as PlaceOrderResult).receipt` |
| 3 | Float price off tick | SDK ≥0.28.0 snaps; never pass raw float <0.28, use `priceToPrecision`/`trader.placeOrder` ticks |
| 4 | IOC vs resting | Tock uses IOC only for taker; no resting orders in MVP → no cancel management needed |
| 5 | Expiry ns mandatory | `expireTimestampNs = BigInt(Math.floor(Date.now()/1000+30)*1e9)` capped ≤ market.expiry |
| 6 | Lot grid | Check `amountToPrecision` result 0 → skip; quantize via `lotSize`/`minQuantity` |
| 7 | Reconcile wallet | Pre-check `getOutcomeBalance`/ERC20 balance before sign; show actual fill price (ask+2¢ may fill at ask); handle `ERC20InsufficientBalance`/`InsufficientBalance()` bare selector |
| 8 | Scope venue | Filter by `venueId` from live row |
| 9 | Expiry headroom | Skip `secondsLeft<30`, show "Next window in mm:ss" |
| 10 | `loadMarkets()` misses settled | Scan `listBinaryMarkets({status:"Finalized"})` for redeem |
| 11 | Void 0.5 both sides | Redeem both outcomes on `isVoided` |
| 12 | Pool recycled | Key state by `marketId`/symbol |
| 13 | Question text parse | Read `asset`/`intervalSec`, never regex question |

*Also:* wallet not connected → CTA; chain mismatch → switch; insufficient STT → link to faucet; testnet tUSDC faucet via `trader.faucet()`; voided → show refund badge.

## Security Review

* Self-custody only: no backend, no privateKey handling server-side, operator path out of scope for MVP (direct `placeOrder`, funds auto-pull from wallet). ERC20 `approve` per pool, user confirms.
* No secrets in repo; RPC public unthrottled; no rate-limit abuse.
* Input validation: size >0, < balance, snapped to lot, price in (0,1), expiry future ≤ market.expiry.
* No blind `any`; strong typing via SDK types.
* XSS: no `dangerouslySetInnerHTML` on market question.

## Testing Plan

* **Read-path live test:** `pnpm check:live` script lists live markets, books, volumes on Shannon testnet (no key) — proves SDK wiring.
* **Simulate writes:** viem `eth_call` preflight before broadcast, decode `InvalidPrice`/`OrderAlreadyExpired`/`PostOnlyWouldCross`.
* **Manual QA checklist:** connect wallet → see 4 windows live countdown → place $5 UP IOC → see ticket active → wait settlement → see streak +1 → claim → oracle link opens graph tab.
* **Unit:** countdown math, lot/price snapping, void vs resolved redemption branches.
* **Build:** `pnpm typecheck`, `pnpm lint`, `pnpm build` must pass.

## Deployment & Monitoring

* Vercel (Next.js), env `NEXT_PUBLIC_SOMNIA_RPC`, `NEXT_PUBLIC_SHANNON_RPC`.
* On-chain events are the log; no server logs. Client errors to console.
* Docs: `README.md` with `pnpm install && pnpm dev`, testnet faucet steps, how to verify live.

## Remaining Risks

* STT testnet faucet captcha wall → document manual faucet step.
* STT faucet UX may require Google Cloud Web3 faucet login.
* Somnia reactivity/throughput claims may degrade under real load — degrade to polling fallback (SDK watches already handle).
