# FEEDBACK.md — DreamDEX SDK & docs feedback

Filed from building Tock (`@somnia-chain/markets-sdk@^0.28.1`) against Shannon testnet. Offered as the optional feedback report in the hackathon submission.

## What worked well

1. **Unified `SomniaMarkets` entry** (`loadMarkets` → typed `info` + `outcomes`) got us from zero to a live board in an afternoon. The `isBinaryMarket` guard + `BinaryMarket` type combo is exactly the right seam.
2. **Tick/lot snapping inside the SDK (≥ 0.28)** removed a whole class of `InvalidPrice` reverts we fought on earlier versions.
3. **`order.info.receipt`** (note the `i`: `info`, not `order.receipt`) reliably carries `transactionHash` + `status` — once found, receipt handling was one code path.
4. **Faucet via `trader.faucet()`** makes testnet demos self-serve. Huge for judging flows.
5. **Finalized-market scans** (`listBinaryMarkets({ status: "Finalized" })`) compose cleanly into redeem-all UX.

## Friction points (ordered by pain)

1. **`receipt` vs `reciept` naming** — the codebase/docs disagree on the spelling in places (`order.info.receipt` is correct at 0.28). A single canonical name in the README's order example would save every integrator 30 minutes.
2. **Two market registries**: the read instance (`loadMarkets` in a poll hook) and the write instance (per-trade) don't share symbol tables, so `createOrder` throws "unknown symbol" unless you `loadMarkets` on the writer too. Document the hydrate-before-write pattern, or share a registry.
3. **Outcome balance IDs are `bigint` on-chain but strings elsewhere** (`yesId`/`noId` typing vs `getOutcomeBalance(token, account, id)`). Normalizing to one representation (or accepting both) would remove a `String()` sprinkle across every integration.
4. **No canonical "is this market tradable now" helper.** Everyone re-derives `status === 1 && secondsLeft > N`. A `canTrade(marketId)` (or exporting the status enum with names, not numbers) belongs in the SDK.
5. **Void vs resolved settlement branches** (`isVoided` → 0.5 both sides; `winningOutcome` → winner only; losing redeem pays 0) are tribal knowledge. A `planRedemptions(marketId, account)` helper returning `[{ outcomeIdx, amount }]` would prevent real gas waste across the ecosystem.
6. **Operator/delegate path is under-documented for binary.** `setOperatorApprovalGlobal` requires a registry address absent from `SOMNIA_TESTNET_ADDRESSES` for binary flows, forcing an ERC20-approve fallback. Either ship the address or document the fallback as the blessed path.
7. **Indexer lag vs wall-clock** is the #1 source of "works then reverts" confusion. A docs note — *"gate writes on `getMarketOnchain`, never on indexed rows"* — plus the 30s-headroom rule of thumb would help every team.

## Small docs nits

- The starter template pins an older SDK; the tick-snapping behavior change in 0.28 deserves a CHANGELOG entry with a migration line.
- `expiry` units (seconds, vs nanoseconds for order expiry) are easy to mix — a units table in the order-placement section would help.
- An official "testnet demo checklist" (faucet tUSDC → STT for gas → live venue cadences) would compress every team's first day.

## Bottom line

The SDK is genuinely shippable — Tock's entire execution policy (IOC crossing, one-approval-per-pool, claim planning) is ~200 lines over it, all client-side. The gaps above are documentation and two or three small helpers, not architecture.
