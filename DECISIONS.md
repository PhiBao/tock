# DECISIONS.md — architecture decision log

## 1. Fully client-side, no backend

**Context:** Wallets, keys, and funds. Any server immediately becomes a custodian and a judging liability.
**Decision:** Next.js App Router as a static client app. All chain I/O in hooks (`useLiveMarkets`, `useTrade`, `useBalances`); streaks in localStorage.
**Consequence:** Nothing to deploy except the frontend; nothing to audit except the SDK calls. Ride auto-roll polls from the tab (prod would move to a cron + session key).

## 2. IOC takers that cross the spread

**Context:** Casual users must never end up with resting orders they don't understand, and thin testnet books often have no depth at mid.
**Decision:** `createOrder(symbol, "limit", "buy", qty, price, { timeInForce: "IOC" })` with price = best ask ± 0.02 slippage (extreme 0.02/0.98 when bookless). Fill happens at market; remainder cancels.
**Consequence:** Slightly worse nominal price on entry, zero order-management UX, zero stuck positions.

## 3. One approval per pool, cached

**Context:** Early builds prompted (or sent) an approval per trade — an "approval tax" that kills a 2-tap loop.
**Decision:** Single max approval to the pool contract, `tock:approved:{chain}:{pool}` in localStorage, allowance re-read on-chain before trusting the cache.
**Consequence:** First trade per pool = 2 signatures, every later trade = 1.

## 4. Gate writes on on-chain state, not the indexer

**Context:** The indexer lags wall-clock by seconds; windows lock and roll underneath you.
**Decision:** Every trade re-reads `getMarketOnchain`: `status === 1` and `expiry − now > 30s`, or it refuses with a human message. Trader instance re-hydrates `loadMarkets` pre-trade with one retry on unknown symbols.
**Consequence:** Fewer reverts, and failures read as product copy ("Window locked — next window soon") instead of RPC errors.

## 5. Claim planning, not claim spraying

**Context:** Redeeming a losing side pays 0 but still costs gas; naive "claim all" buttons burn money.
**Decision:** `planClaims()` derives redeemable outcomes from settlement state — voided → both sides, resolved → winner only, otherwise nothing. Pure function, unit-tested.
**Consequence:** Claim scans are gas-efficient by construction; the rule is testable without a chain.

## 6. Spot is orientation, oracle is truth

**Context:** Users want to see price move; settlement uses the DreamDEX oracle median, not Binance.
**Decision:** Binance 1m closes render as labeled context ("orientation — settlement uses the oracle median"); every ticket/trade links to the oracle explorer graph for its question.
**Consequence:** No implied promise the chart predicts settlement; auditability is one click away.

## 7. Dark-only, one accent

**Context:** The first UI mixed light panels into a dark app with an inverting active card — it read as three products.
**Decision:** Dark-only system (`ink`/`panel` surfaces), one locked accent (gold/amber-400 for brand + urgency), emerald/red reserved strictly for UP/DOWN data semantics. Geist + tabular numerals for money/time.
**Consequence:** Coherent arcade feel; direction colors never compete with the brand accent.

## 8. Agent surface via delegation + MCP, not custody

**Context:** The hackathon explicitly welcomes AI agents; users won't hand keys to a hackathon app.
**Decision:** Revocable one-time approval (`placeOrderFor` selectors where the registry supports it, ERC20-approve fallback) plus a read/compose MCP endpoint. Funds never leave the wallet.
**Consequence:** Agents can genuinely trade (not just chat), and "revoke" is one click.

## 9. Proof as a feature

**Context:** Judges can't tell a mock from mainnet in a 2-minute video.
**Decision:** `/proof` page (live windows, contract addresses, enforced policy), `pnpm demo` (60s no-wallet read-path proof), CI running typecheck + lint + 25 unit tests on every push.
**Consequence:** Every claim in the pitch is one click from verification.
