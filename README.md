# Tock — Call the next 15 minutes

> The 15-minute arcade for BTC/ETH direction on DreamDEX. Zero fees, self-custody, streaks, shareable win cards. Built on Somnia for the **Somnia × DreamDEX Event Contracts Hackathon**.

[![CI](https://github.com/PhiBao/tock/actions/workflows/ci.yml/badge.svg)](https://github.com/PhiBao/tock/actions/workflows/ci.yml)
![Shannon testnet](https://img.shields.io/badge/network-Shannon%20testnet%2050312-amber)
![SDK](https://img.shields.io/badge/sdk-%40somnia--chain%2Fmarkets--sdk-0.28-blue)

**Live:** production URL goes here post-deploy · **Proof:** [/proof](/proof) in-app · **Agents:** [/mcp](/mcp) in-app

---

## The problem

Algo Arena proved demand: **$89.6M volume** on BTC/ETH 15m/1h UP/DOWN in 8 weeks, zero fees. But the official DreamDEX surface exposes terminal complexity — symbols like `BTC-0-12AUG26-1600/USDso#YES`, 0.001 tick grids, pool recycling, expiry in nanoseconds. Casual retail wants a 30-second dopamine loop: see countdown → tap a side → watch the needle → streak. Tock compresses a 7-step order flow into **2 taps**, hides `marketId`/`pool`/`tickSize`, and turns settlement into a shareable card.

## What Tock is

- **Manual mode** — one-tap UP/DOWN, size presets (5/25/100 contracts) + custom, live cost vs. to-win preview, IOC execution that crosses the spread.
- **Ride mode** — parlay auto-roll: one stake rolls window-to-window with cash-out target, stop-loss, and max-leg guardrails.
- **Agent surface** — one-time revocable delegation plus a live MCP endpoint (`/api/mcp`, see [/mcp](/mcp)): Claude/Cursor can read windows and place calls.
- **Tickets & claim** — auto-scans the last 40 settled windows, redeems winners (voids pay 0.5 both sides), never wastes gas on losing sides.
- **Streaks & share cards** — local streak ledger with win-rate, one-click 1080×600 PNG export + native share sheet.
- **Proof page** (`/proof`) — live windows, contract addresses, execution policy, and reproduce commands. Don't trust the demo; verify it.

## Demo (60 seconds, no wallet)

```bash
pnpm install
pnpm demo   # live indexer → windows → on-chain gates → books. Real testnet data.
```

Expected: ~500+ markets indexed, live BTC/ETH windows with BBO, `status 1` gates, contract table.

## Demo (2 minutes, wallet)

See [DEMO.md](./DEMO.md) for the exact script: connect → faucet 10k tUSDC → call UP → countdown → settle → claim → audit on the oracle explorer → share the streak card.

## Integration with DreamDEX Event Contracts

Tock is not a dashboard *about* Event Contracts — every interaction *is* an Event Contract interaction:

- **Live venue, not fixtures.** The board streams real binary markets (BTC/ETH across 1m/5m/15m/1h cadences) from the DreamDEX indexer, filtered to active rows and sorted by time-to-close. When the venue rolls, the UI rolls with it — including mid-trade recovery ("market just rolled, board refreshed, retry").
- **On-chain orderbook execution.** Taps become real CLOB limit orders (YES for UP, NO for DOWN) against the market's pool, filled IOC at crossed prices. No paper trading, no simulated fills — the receipt hash on every ticket is a Shannon explorer link.
- **Native settlement semantics.** UP wins if settlement lands at or above the window's opening price, DOWN below; voided windows refund 0.5 on both sides. Claim, streaks, and ride auto-roll all key off `isResolved` / `isVoided` / `winningOutcome` read straight from `getMarketOnchain`.
- **Oracle-audited trust.** Every trade and ticket links to the question's oracle-explorer graph, because settlement is a multi-source median — the app never asks to be trusted, only verified (`/proof` collects all of this in one place).
- **Testnet-native onboarding.** The tUSDC faucet (`trader.faucet()`) is built into the flow, so a judge goes from landing to filled order in under a minute with zero external setup.

## Meaningful use of DreamDEX APIs and SDKs

Built on `@somnia-chain/markets-sdk@^0.28.1`, used in depth rather than as a price ticker:

| Surface | How Tock uses it |
|---|---|
| Indexer GraphQL (`loadMarkets`) | live board hydration, 4s poll; unified `info` + `outcomes` rows |
| `isBinaryMarket` / `BinaryMarket` types | strict filtering to BTC/ETH binary windows; question text never regex-parsed (`asset`/`intervalSec` only) |
| `getMarketOnchain` | pre-trade gate (`status === 1` + 30s headroom) and ride settlement polling every 3s |
| `fetchOrderBook` | live BBO + mid for UP probability, needle, and cross-price computation |
| `createOrder` (IOC) | taker execution with SDK tick/lot snapping; receipt read from `order.info.receipt` |
| ERC20 allowance flow | single max-approve per pool, cached and re-verified on-chain — no per-trade approval tax |
| `getOutcomeBalance` | ticket discovery + claim sizing per outcome token |
| `getBinaryPositionPnL` | participation signal for already-redeemed positions |
| `listBinaryMarkets({ status: "Finalized" })` | 40-window settlement scan behind Tickets and Claim |
| `trader.redeem` | winner-only / void-both-sides redemption via `planClaims()` (losing sides skipped — redeeming them pays 0) |
| `trader.faucet` | one-click 10k tUSDC onboarding |
| MCP (`/api/mcp`) | the same execution policy exposed to AI agents: live windows, placed bets, rides, streaks |

Thirteen SDK gotchas are handled and logged in [PRODUCT.md](./PRODUCT.md); residuals and suggestions are filed as [FEEDBACK.md](./FEEDBACK.md).

## Potential for adoption, activity, and ecosystem impact

- **Rides proven demand.** Algo Arena did $89.6M on exactly this mechanic (short-window BTC/ETH UP/DOWN, zero fees). Tock is the consumer arcade layer that venue was missing — 2 taps instead of a 7-step terminal flow.
- **Volume per user, not just users.** Ride mode turns one decision into N sequential fills (stake rolls window-to-window), and streaks + share cards turn each settlement into a retention event and a distribution event. The PNG share card is purpose-built for X/Telegram virality.
- **New order flow for the CLOB.** Every tap is a real IOC taker crossing the spread — retail flow that tightens books and pays makers, directly growing DreamDEX trading activity rather than farming it.
- **Agent-originated flow.** The delegation + MCP surface lets AI assistants (Claude, Cursor, trading bots via the Bot Kit pattern) place real orders against user wallets — a flow category no terminal captures, aligned with the hackathon's AI-agent track.
- **Trust compounds adoption.** `/proof`, oracle audit links, and `pnpm demo` remove the "is this a mock?" objection that kills hackathon-to-mainnet conversion. Testnet-first with mainnet paths already in config (`5031` alongside `50312`) keeps the migration a config flip, not a rewrite.
- **Measurable from day one.** Live windows, fills, claims, and streaks are all on-chain or locally counted — retention (returning streaks), activity (fills per user via rides), and distribution (share-card exports) are instrumentable without new infra.

Execution policy (each rule is unit-tested in `src/lib/orderMath.ts` or gated in `useTrade`):

| Rule | Enforcement |
|---|---|
| Only trade live windows | `getMarketOnchain.status === 1` + 30s expiry headroom |
| Never leave resting orders | IOC only |
| No per-trade approval tax | one max approval per pool, cached + re-checked on-chain |
| No tick/lot reverts | size floored to 0.001 lot, price clamped to 0.001 tick |
| Survive market rolls | pre-trade registry re-hydrate, one retry, then board refresh |
| No wasted claim gas | voided → both sides, resolved → winner only, else skip |
| No preview/settlement confusion | spot labeled orientation; oracle median + audit links as truth |
| Self-custody always | no backend, no keys; agent path is a revocable approval |

Full gotcha log (13 handled): [PRODUCT.md](./PRODUCT.md). Architecture decisions: [DECISIONS.md](./DECISIONS.md). SDK feedback we filed while building: [FEEDBACK.md](./FEEDBACK.md).

## Verify

```bash
pnpm typecheck && pnpm lint && pnpm test   # 25 checks, zero keys required
pnpm build && pnpm start
```

No env vars required. RPC/indexer are public (`api.infra.*.somnia.network`, `dev.smk.somnia.host/v1/graphql`).

**Faucets (Shannon):** in-app **Get 10,000 tUSDC** calls `trader.faucet()`. STT for gas at [testnet.somnia.network](https://testnet.somnia.network).

## Submission

- **Network:** Shannon testnet (50312), tUSDC. Mainnet paths exist in config but the demo is testnet-only.
- **Track:** Event Contracts Consumer Experience — arcade game, not bot/dashboard.
- **Repo:** this repo. **Demo video:** record [DEMO.md](./DEMO.md).

## Roadmap (post-hackathon)

Rooms (private leagues over the same book) · edge-coach drawer (fair-price vs crowd) · spot funding swap with builder fees · Telegram Mini App + Farcaster Frame · Privy embedded wallets + next-window push.

## License

MIT — see `LICENSE`. Hackathon prototype, not audited. Trade at your own risk; start on testnet.
