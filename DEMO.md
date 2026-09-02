# DEMO.md — the 2-minute judging run

Total: ~2 minutes. One take, no cuts if the windows cooperate. Record at 1080p, narrate each step in one sentence.

## 0:00 — Land (10s)

Open the app. Point at the hero: **one live countdown**, UP probability, BBO. Say: *"Tock is the 15-minute arcade for BTC and ETH direction on DreamDEX — one tap, zero fees, self-custody."*

## 0:10 — Fund (20s)

1. **Connect wallet** (top right, injected). App auto-switches to Shannon testnet.
2. **Get 10,000 tUSDC** — one click, on-chain faucet. Balances appear in the header (tUSDC + STT).
3. Say: *"Free play money. STT for gas comes from the Somnia testnet faucet."*

## 0:30 — Call it (30s)

1. Pick the top live window (BTC 15m if present).
2. Tap **UP**, size **5**, show the preview: price / cost / to-win.
3. **Place UP · 5**. Approve pops once (first trade per pool only), then the order fills IOC.
4. Point at the inline receipt: side, size, price, **View tx** → Shannon explorer.
5. Say: *"Two taps. IOC means the unfilled remainder never rests on the book."*

## 1:00 — Ride it (30s)

1. Switch to **Ride · auto-roll**. Stake 5, 4 legs, target shown.
2. **Start Ride** — leg 1 places, pot + run-multiplier track live.
3. Say: *"One stake rolls window to window. Cash-out target and stop-loss end it before tilt."*

## 1:30 — Settle + claim (30s)

1. Open **Tickets & history** → **Refresh** scans the last 40 settled windows.
2. **Claim winnings** — redeems winners, voids pay 0.5 both sides, losers skipped (redeeming them pays 0).
3. Open **Audit settlement** → oracle explorer graph for the window.
4. Say: *"Settlement is a multi-source median. Every result links to its audit."*

## 2:00 — Close (15s)

1. **Share streak** → PNG downloads (streak, best, market). Flash the [/proof](/proof) page.
2. Say: *"Streaks, share cards, and a proof page so you never have to trust the demo."*

## If something goes wrong live

- **Window locked (< 30s):** expected — say so, pick the next window. The lock is the feature.
- **Market just rolled:** the app refreshes the board and says so — narrate it, retry once.
- **No live windows:** venue rolls every 15m — cut to `pnpm demo` terminal output (real indexer data) as B-roll.

## B-roll assets

- `pnpm demo` terminal run (60s, no wallet) — proves the data plane independently of the UI.
- `/proof` page scroll — contracts, policy, reproduce commands.
- `/mcp` page — *"Claude, place a BTC UP bet for $5 on Tock"* for the agent angle.
