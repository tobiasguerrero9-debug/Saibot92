# Augustus user product — local pilot

Route: `/augustus`. Existing `/augustus92` and `/augustus92/canary` are preserved.
Start the read-only review service with `node scripts/serve-augustus-mainnet-review.mjs`
and Vite with `npm run dev -- --host 127.0.0.1 --port 5173`.

## User flow

1. Connect the configured dedicated master. An expiring, single-use wallet sign-in
   message proves identity only; it does not authorize any financial action.
2. Enter position/loss/leverage caps, direction and bounded session duration.
   Financial values have no defaults. Default duration is displayed as 60 minutes.
3. Read-only API verification confirms the existing agent authorization. If absent,
   the user is directed to the official Hyperliquid API-wallet interface and the
   application rechecks the exact address. No private key is requested or shown.
4. ARM starts proposal monitoring only. Thresholds are unchanged. The user-risk
   envelope derives a protective stop after the existing cost/slippage reserves;
   invalid rounding, insufficient collateral or insufficient stop room rejects it.
5. Eligible proposals display actual context, entry, rounded size/notional, margin,
   protection, estimated loss and expiry. IDs/hashes are handled internally.
   Rejection persists the rejected binding; changed/stale proposals expire.

## Execution remains disabled

The authenticated `/api/augustus-product/execute` endpoint validates the exact
proposal ID and explicit approval, but refuses live execution. No signer key is
loaded. MainnetAdapter's live-write gate, MainnetCanary's gate and the product
executor gate all remain closed. APPROVE TRADE and CLOSE POSITION are disabled
in the live UI. This release must not be described as live execution-enabled.

`productExecution.js` bridges the exact proposal to the existing audited canary
lifecycle in simulation only. Tests cover single-entry reservation, SDK-shaped
partial fills, actual-size protection, stop verification and emergency reduce-only
close. Simulations never send exchange requests. Monitoring rechecks protection.

Product sessions persist to gitignored `work/augustus-product-session.local`.
Kill state survives restart; restart never automatically reconnects or rearms.
Wallet disconnect, heartbeat loss, stale context and expiry block new proposals.
The kill endpoint synchronously disarms and persists first. Simulated execution
can cancel only its own entries; emergency closing requires a separate explicit
confirmation unless required by a failed mandatory protection check. No live
cancellation or close is submitted in this build. External positions are displayed
as external; the UI never invents stop protection or ownership.

## Release limits

This is a single dedicated-account pilot, not multi-tenant hosting. Production
release needs per-user agent provisioning and authorization, a hosted secure
backend, authenticated deployment origin/session policy, live signer custody and
explicit release review of all closed write gates. The risk-budget stop policy and
real exchange behavior have not been validated by a live trade in this build.
Production operational recovery needs exclusive process ownership, restart/fill
reconciliation and independently verified protection before enabling live writes.

Wallet-extension sign-in/authorization must be completed manually by the user.
No developer-only nonce, asset-index, agent-list or localhost-port concepts are
required in the normal product flow.
