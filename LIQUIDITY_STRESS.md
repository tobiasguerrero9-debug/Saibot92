# Liquidity Stress Monitor 1.0

## Route and operation
`/app?view=liquidity-stress&stressSymbol=ETHUSDT&stressWindow=15m`.
Scanner rows provide STRESS navigation; the existing symbol search selects other USDT perpetuals.
`GET /api/liquidity-stress?symbol=ETHUSDT` is read-only, on demand, Frankfurt-only. No database, new daemon, new permanent WebSocket or trading integration.
Local: `npm run stress:api:local`, then `npm run dev`.

## Model LSM-1.0.0
Fixed OI 25%, observed liquidations 25%, volatility 20%, order book 30%. All four must be VALID; missing/stale sources yield INSUFFICIENT DATA, never reweighted zeros. Bands LOW <30, MODERATE <55, ELEVATED <75, HIGH otherwise are provisional descriptive conventions.
OI: absolute log change in open-interest quantity. Volatility: root sum squared closed 5m log returns, unannualized. 15m uses three returns; 1h uses twelve. 499 historical observations supply each market's own prior non-overlapping windows, minimum 20.
Normalization: upper-tail empirical rank (median maps to zero), bounded 0–100, reference winsorized at median ±6 MAD. Flat reference with equal observations maps to zero. No raw cross-market notional comparison.
Book: 500 levels, ±5 bps of mid, requires full band coverage; spread, bid/ask USDT notional and imbalance reported. Rolling window average; score 40% spread stress plus 60% relative depth loss, using prior own-market observations. Standard depth excludes RPI orders. A single snapshot never produces a valid book factor.
Liquidation: existing forceOrder stream, observed last fill quantity × average price; deduplicated. Binance samples at most one event per symbol per 1000ms, so this is not an exhaustive liquidation total. Stream continuity is checked; disconnects and suspended tabs invalidate windows. Reference uses preceding same-duration rolling windows; these overlap and are correlated, not independent samples.

## History and limitations
Depth and sampled liquidation history are browser-retained public observations (maximum 24 symbols ×400 half-minute bars), not a durable global archive. No history is fabricated or imported from Alerts. Complete composite needs approximately 40 uninterrupted minutes for 15m or 130 for 1h. Local storage failure makes history session-only. Refresh retains history but gaps remain invalid. New markets warm up separately.
Historical full-composite stress-episode validation cannot be performed without a reliable depth/liquidation archive. OI/volatility can be checked against supplied public history; that does not validate predictive performance. This model is descriptive and experimental, not a volatility forecast, probability or directional signal.

## Freshness and traffic
Exchange `/time` midpoint/RTT alignment handles host clock skew; RTT >3s fails closed. Depth/API snapshot freshness 65s; historical closed 5m observations 7min. Client polls every30s while the view is mounted and reuses the existing app WebSocket.
Warm-instance source caches: universe/OI/klines60s, depth25s. Maximum3 concurrent REST calls; queue deadline25s, per-request timeout8s. Additional requests conservatively budgeted at600 weight/min per warm instance, upstream weight >=1200 blocks for60s;429/418 honor bounded Retry-After. Shared caches coalesce concurrent calls. Universe uses the existing batch service. Cold instances have separate budgets; this is not a global per-IP limiter. Upstream limits fail closed rather than creating retries or synthetic data.

## Isolation and validation
Scanner acquisition/classifier is unchanged; optional stream observers isolate exceptions. Alerts retains its existing API and persistence contract, including truthful unavailability while Neon quota blocks it. No Neon migration or production records touched.
Tests: `npm run test:stress`. UI test builds its SSR artifact first (`npm run test:stress:ui`); ordinary tests exclude this artifact-dependent test. Production: `npm run build`.

Transport verification: the legacy `/stream` WebSocket connected without delivering frames in a simultaneous 20-second probe; the official `/market/stream` path delivered nine messages. The shared manager now uses the current documented route with unchanged subscriptions and classifier callbacks. No additional permanent socket was introduced.

## P0 functional recovery — LSM-1.0.1
The composite formula, weights, normalization and baseline count are unchanged. The original ~40-minute (15m) /130-minute (1h) minimum was a conservative implementation choice, not an exchange requirement or statistically calibrated confidence threshold. It follows from a full current window, a preceding same-duration reference window and 20 rolling reference windows, advanced in 30-second increments (79/259 complete intervals). These references overlap and are correlated. Book calibration requires the current window plus20 distinct prior snapshots (~25/70min).

Verified code defects: HTTP response completion time controlled the old sampler; flooring jittered completion timestamps could drop or skip intervals, and clearing the accumulated liquidation sum on a duplicate slot could lose observed events. Sampling and collection also stopped on Stress view unmount. A historical record count alone did not establish continuous coverage. First-time insufficient history is legitimate; a quiet liquidation stream by itself is not an outage.

The repaired collector finalizes exchange-aligned 30-second intervals independently of HTTP completion. Events are assigned by their exchange event timestamp, deduplicated, and never retroactively inserted into a finalized bucket. Quiet intervals carry a measured zero only when the liquidation subscription exists, the shared socket is connected, transport heartbeats are fresh throughout, and the event loop has not suspended. Late events are not silently reassigned to another interval. The factor remains explicitly **observed sampled liquidation pressure**, not the exchange's exhaustive liquidations.

Depth bars reference the latest actual source snapshot at or before the interval boundary, within the unchanged65-second source-age limit. Source timestamps are retained; repeated cached snapshots do not inflate the required20 distinct reference observations. This is a last-observation-carried-forward sampled book profile, not fabricated intervening snapshots. Missing or truncated depth is displayed as its actual blocking reason. Extended fetch gaps invalidate coverage. No extra Binance request cadence or socket was added.

Collection begins on the first Stress visit, continues across /app views, and shuts down when /app unmounts. Browser closure/suspension and genuine feed gaps cannot claim observations. Completed history persists in localStorage under `saibot92.liquidity-stress.observations-v2` (400 half-minute intervals/market). An API process restart does not own or erase this history. Page reload restores completed intervals but does not backfill its unobserved gap. Existing v1 records are left untouched; their liquidation buckets cannot be safely migrated because actual interval boundaries were not retained. They are not relabeled as verified v2 coverage.

Measured diagnostics show current valid samples/required samples, current-window coverage, independent reference counts, last actual valid book timestamp/stream interval, connection/subscription health, and the actual blocker. Estimated remaining time is conditional on healthy cadence; it is not a guaranteed countdown. Existing valid reference history is retained through failures, allowing recovery once a fresh current window exists.

There is no documented public historical depth archive or exhaustive historical liquidation endpoint equivalent to these observations. Candles and OI are not substituted. A globally durable archive would require the existing project persistence to be healthy and collection in an existing hosted worker; Neon is currently quota-blocked, so this patch does not silently add that dependency or provision a service.

Storage-pressure hardening: finalized book records retain only source timestamp and numerical measurements, excluding repeated source-description strings and unrelated snapshot metadata. If the 400-row payload exceeds the browser's shared localStorage quota, persistence retries with the latest260 completed intervals per market (still enough for the259-interval1h calibration). In-memory observations are preserved, other app/legacy records are not deleted, and failure of both writes is shown as session-only. Later successful writes restore the persistent indicator. Browser storage remains local rather than a global durable market archive.
