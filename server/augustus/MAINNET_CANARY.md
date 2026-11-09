# Mainnet canary — disabled first delivery

The dedicated master and agent are imported from the existing wallet constants.
No wallet is regenerated. The existing TESTNET authorization/service path is unchanged.

`mainnetCanary.js` implements the independent control-plane policy and simulated
session lifecycle. It never constructs a mainnet order client. `executionEnabled`
is false regardless of environment variables. Live arming and execution always
reject. Simulation requires an explicitly injected SIMULATION gateway.

User inputs `MAX_NOTIONAL_USD` and `MAX_LOSS_USD` have no defaults. The isolated
review screen at `/augustus92/canary` collects them and shows all proposal fields;
approval is disabled. Live source fields are displayed, with unavailable/stale
context blocking previews. Entering values does not arm an execution service.

## Verification and unsigned authorization

Run `node scripts/prepare-augustus-mainnet-canary.mjs` from the repository.
It posts only allowlisted reads to the mainnet `/info` endpoint, validates the
unsigned approval action with the installed SDK schema, and saves public results
to gitignored `work/mainnet-canary-preflight.local`. It never loads environment
secrets, connects a wallet, signs, or submits an exchange action. Preparation
timestamps must be regenerated immediately before any subsequently approved
authorization flow; the report is not a reusable signature request.

Mainnet agent approval is broad delegation: ETH-only, leverage, notional and
one-entry limits are application restrictions, not restrictions in approveAgent.

## Mainnet adapter and real context — second delivery

`mainnetAdapter.js` now supplies SDK-backed order construction and mainnet reads,
CROSS leverage confirmation, rounded IOC entry, fills/position reconciliation,
partial fill handling, targeted entry cancellation, reduce-only protective stops,
exchange-side stop verification, and reduce-only emergency closing. Real instances
remain read-only: the write gate, signing wallet stub and exchange transport all
reject live writes. Mock SDK clients require explicit sandbox mode. No key is read.

`mainnetContext.js` wraps the actual SAIBOT92 ResearchFeed and existing deterministic
eligibility policy. Entry requires all ten context fields, numeric telemetry,
freshness, genuine What Changed history and active liquidation observation. It
does not fabricate history, taker volume, liquidation events or eligibility.

Run `node scripts/serve-augustus-mainnet-review.mjs` for the loopback read-only
service on port 8791, then `npm run dev -- --host 127.0.0.1 --port 5173` for the
review screen `/augustus92/canary`. Vite proxies only the new canary prefix to this
service. The existing TESTNET service is unchanged. The screen displays live
account/context state and requests a server-validated, rounded unsigned preview.
It does not expose an approval, authorization, signature, transfer or order route.

`mainnetAccountState.js` reconciles `userAbstraction`, spot USDC/holds,
`tokenToAvailableAfterMaintenance`, and both sides of ETH `availableToTrade`.
Unified Account usable collateral is the conservative minimum of these sources;
the raw perpetual ledger's zero balance/withdrawable does not cap unified collateral.
Standard (`disabled`) mode keeps separate perpetual collateral accounting.
Portfolio margin, legacy default and unknown modes fail closed pending their own
explicit accounting support; no mode is silently treated as Standard.

ETH V1 is CROSS only. Current leverage must be known and at most the user's cap,
which cannot exceed 5x. Mode and leverage timestamps are checked on each entry.
Entry submission does not implicitly change leverage. The read-only preflight
prepares an unsigned official `updateLeverage` action with `isCross: true` for
separate review and suppresses agent authorization until readiness is confirmed.

`mainnetCollateral.js` refuses Unified/unknown transfer preparation; it retains
the amount-configurable helper only for explicitly verified Standard mode.
No spot-to-perp transfer is required or prepared for the current Unified account.

## Requirements before enabling any future live integration

The simulated lifecycle tests exercise fresh account/order/market reconciliation,
mandatory protective stops, one-entry reservation, exact proposal digest approval,
audit durability, kill switch, uncertainty and emergency reduce-only closing.
They do not prove live exchange behavior. The real adapter is supplied but all
live mutation methods remain inaccessible in this build.

The adapter resolves ETH metadata dynamically, applies exchange price/size rounding
before approval, sets and verifies leverage, reads actual fills, reconciles CLOIDs,
verifies stop side/size/price/reduce-only against exchange state, preserves protection
on STOP, and checks actual exposure after emergency-close submission. A partial or
uncertain close stops and requires reconciliation; it is never blindly replayed.
It must not treat a transport acknowledgement as a fill or protective-stop proof.
No entry retry may create a second CLOID. Protective retries use the same stop
CLOID after reconciliation; emergency exits use the dedicated exit CLOID.

The current control plane requires a SessionAudit-compatible durable sink and
blocks after an incomplete persisted entry reservation on restart. It must remain
bound to a single process/session owner until an exclusive interprocess lock and
live reconciliation have been reviewed. Do not attach another process to a live
account or reuse the TESTNET auto-entry controller for mainnet.

The loss cap checks estimated stop loss plus explicit cost/slippage reserves and
actual-fill risk. It is not a guarantee against gaps, liquidation or exchange outages.

## Continuous proposal-only engine

`proposalEngine.js` runs read-only evaluations every five seconds in the review
service. `GET /api/augustus-canary/proposal-engine` returns NO TRADE with exact
missing conditions or one unsigned ELIGIBLE PROPOSAL. The existing strategy
thresholds in `decideEligibility` are unchanged. A risk configuration is mandatory;
there are no preset capital, loss, notional or stop values. The configuration form
does not arm the service. Direction comes from the strategy, entry from live ETH
metadata, and rounded proposals still pass the existing risk checks.

Every eligible proposal has a UUID proposalId and a binding hash of its exact
rounded parameters, risk configuration, account availability and source context.
Context/price changes, expiry, missing data or exposure invalidate the previous
ID. Only one current proposal is retained. `validateProposalId` re-evaluates and
rejects superseded IDs; it does not approve, consume or execute a proposal.
The canary diagnostics have no HTTP approval/execution route. The authenticated
product API adds a separately gated execution contract (see PRODUCT.md); live
execution remains build-disabled everywhere.

Before enabling any future live path: configure user caps, verify collateral and
agent approval, wire fresh research context, validate the live adapter, and obtain
explicit approval of the exact rounded proposal. None of those steps authorizes
an automatic trade in this delivery.
