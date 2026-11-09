# AUGUSTUS92 ETH execution session MVP (local TESTNET only)

This README describes the new armed-session controller, replacing the prior proposal-per-trade prototype. The old /proposal, /approve and /manage API routes return 410 after authentication. They cannot bypass ETH/session limits. Historical pure modules and their tests remain in the repository but are not the active execution path.

## Run locally

```powershell
npm run augustus:server
# Second terminal (use the configured origin):
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Open http://127.0.0.1:5175/augustus92. Work stays on codex-final-integrations. No production deployment is authorized.

## Account setup required for real execution

The connected wallet must hold at least one whole token at 0x7673a00106c99d1e00b85496f9f495076873b654 on chain 4663. balanceOf and decimals are read on-chain, with an independent server check. Token RPC: https://rpc.mainnet.chain.robinhood.com, replaceable through TOKEN_RPC_URL. The threshold is normalized using live decimals, never treated as one raw unit.

The funded Hyperliquid TESTNET master must be the same public address as the verified holder wallet. Once that address is known:

```powershell
node scripts/setup-augustus-agent.mjs <PUBLIC_FUNDED_TESTNET_MASTER_ADDRESS>
```

The script exclusively creates server/augustus/.env.local (refuses overwrite), generates a delegated-agent key locally, and prints only its public address. Authorize that public address as a named API/agent wallet in the official Hyperliquid TESTNET app. Do not send keys in chat. Never configure the master private key. No key was generated in this build because the public master address has not been supplied.

Keep HYPERLIQUID_NETWORK=testnet. Other values are rejected at service startup. Only after account and agent setup, set AUGUSTUS_ENABLE_TESTNET_EXECUTION=true in the excluded local file and restart. SDK signing transport remains fixed to isTestnet:true. No mainnet switch, withdrawal or transfer API route is exposed.

AUGUSTUS_UI_ORIGIN defaults to http://127.0.0.1:5175; configure it if the UI port changes. The server binds to loopback, validates Host/Origin, and authenticates a single-use wallet signature challenge. Session bearer tokens remain in memory. Holder verification is repeated by authenticated polling and before entries. Browser/network disconnect requests STOP; absence of browser heartbeats for 30 seconds disarms the controller.

## The armed envelope

- ETH-PERP only; one concurrent position and exactly one entry attempt per session.
- Direction LONG ONLY, SHORT ONLY or BOTH; the selected side must also have a valid stop/target relative to the current mark.
- Max position $10–$100; leverage 1–3x.
- User max loss in USD or percent. At ARM the server freezes the lower of that amount, $5 and 0.5% of current equity. It never silently raises the limit.
- Required absolute stop price; optional take-profit price.
- Duration 30m, 1h or 2h. The browser must remain connected and authenticated.
- Configure does not authorize a trade. The explicit ARM checkbox and button authorize at most one ETH entry and protective/emergency actions inside the displayed server envelope.

This controller uses a session loss budget, including equity drawdown since ARM, rather than requiring the old prototype's complete rolling-24h portfolio history. Deposits/withdrawals/ledger changes detected before entry invalidate the equity baseline and stop the session. Stop loss is planned protection, not a guaranteed fill price or loss cap.

## Deterministic eligibility and real context

ResearchFeed imports the existing SAIBOT92 classifier, market-context engine, order-flow analyzer and a separate WhatChangedTracker instance. It reads real ETHUSDT public research telemetry and optional liquidation events; it does not alter existing SAIBOT92 services or UI subscriptions. Research and Hyperliquid are different venues. Hyperliquid TESTNET prices and account state alone determine order sizing and execution.

Context includes symbol, timestamp, Agent State, Market Bias, Context Score, actual What Changed observations, derived order flow, OI, funding, liquidation observation availability, squeeze classification and transition pressure. Derived buy/sell shares remain candle-direction proxies, not actual taker-side measurements. Missing inputs/history return WAIT; no synthetic observations or confidence values are generated.

Explicit eligibility policy:
- LONG: LOCKED IN or SQUEEZE MODE, existing context score >=70 and derived buy share >=58%.
- SHORT: RISK OFF, context score >=70 and derived buy share <=42%.
- The side must match the user direction. The actual available What Changed sample window must exist; no claim of five full minutes is inferred.
- WAIT, ENTRY_ELIGIBLE or NOT_ELIGIBLE always contains a real reason. Eligibility is followed by all exchange, access, session and risk checks.

This is a deterministic V1 policy, not an optimized or proven profitable strategy. No AI inference or predictive accuracy is claimed.

## Execution and protection

SessionController is the only active order coordinator. It uses a single-flight lock, persisted execution ID, unique client order IDs, reserved trade slot before submission, SDK nonce management, and signed request expiry. Before entry it checks ARM, heartbeat/auth, duration, holder access, account/market freshness, WebSocket health, ETH-only scope, no conflicting account position/order, direction, stop/target, size, margin, leverage and remaining loss budget. It refreshes again after leverage update. Sizes are risk-based with a 0.2% cost buffer, rounded down to exchange precision; entry is a 0.1%-capped IOC order.

An ambiguous entry response is reconciled by CLOID and never resubmitted. The slot is consumed even if an IOC has no fill. A partial fill is protected at actual size. After confirmed position fill the controller immediately submits a reduce-only trigger stop, then retries read-only reconciliation up to three times. It does not replay an ambiguous stop write. If stop existence cannot be confirmed, it stops decisions, cancels its own pending entry and requests a reduce-only emergency close. Optional TP is also reduce-only and never substitutes for SL.

An emergency close uses a fresh position and a 0.5% capped reduce-only IOC. If an IOC has a known terminal outcome but leaves a residual position, up to three uniquely identified closes may be attempted, each from fresh actual size. Unknown exit outcomes are reconciled without resubmission. If the venue remains unavailable or residual exposure cannot be confirmed flat, status stays EMERGENCY_STOPPED and requires direct inspection in Hyperliquid TESTNET; the app never claims a close merely from HTTP 200.

STOP sets armed=false synchronously, including during an in-flight request. It cancels session-owned entry orders and preserves verified protection. In-flight fills still receive mandatory protection. CLOSE POSITION NOW requires an explicit confirmation and uses the same reduce-only reconciliation path. Foreign/manual orders are not canceled, and unexpected external positions are not autonomously adopted or closed. They block new entries and require user review. After a position is verified flat, cleanup removes only session-owned SL/TP, leaving unrelated orders untouched.

Restart never re-arms. It reads the last durable checkpoint, reconciles exchange state and cancels its own pending entries. Session-owned positions retain verified SL; missing protection invokes emergency reduction. Corrupt or unavailable audit storage blocks new entries. Audit failure after a fill must not prevent protective/risk-reducing safety actions.

## State and audit

IDLE, CONFIGURED, ARMED, OBSERVING, ENTRY_ELIGIBLE, PLACING_ORDER, ORDER_OPEN, POSITION_OPEN, MANAGING, EXITING, COMPLETED, PAUSED, ERROR, EMERGENCY_STOPPED. Every actual transition is validated against the explicit graph and logged. API failures use the emergency branch conservatively.

The fsynced append-only journal is work/augustus/session-events.local (ignored by Git). Events include timestamp, ETH symbol, execution ID, state, reason, actual research context, exchange order IDs and reconciled position as applicable. The UI shows a compact WHY DID AUGUSTUS TRADE? audit. It is not performance history. Raw keys, signatures and signed payloads are excluded.

## Development-only forced eligibility

AUGUSTUS_ALLOW_DEV_FORCE_ENTRY=true is optional for a supervised test. It is ignored when NODE_ENV=production and off by default. It requires a genuinely authenticated holder, funded/authorized TESTNET account, explicitly armed session, real fresh data, direction, position/risk constraints and a free trade slot. It overrides only strategy eligibility, records DEVELOPMENT_ENTRY_OVERRIDE, and never substitutes fake context. Production has no enabled force control.

## Validation and remaining acceptance

```powershell
npm run test:augustus
npm run check:augustus:testnet
npm run build
npm run lint
```

83 unit tests pass: original foundational checks plus 35 armed-session checks. These include disarmed/ETH/size/leverage/loss limits, single trade, duplicates, stale data, post-fill stop, failed stop emergency close, partial fills/exits, STOP during entry, expiry, actual timer-based WebSocket reconnect, restart, mismatch, audit failure and unrelated-order preservation. Build passes; existing 20 lint warnings remain unchanged.

Real read-only ETH research, Hyperliquid TESTNET REST and WebSocket messages were checked. No real order was submitted. The user reported the funded testnet account is ready but has not yet supplied its public address; local agent configuration is absent. The milestone is NOT complete until the holder connects, the agent is authorized locally and one real ETH testnet entry/fill/SL/close/flat sequence produces exchange IDs and a real audit log.

References: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint and https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions.
