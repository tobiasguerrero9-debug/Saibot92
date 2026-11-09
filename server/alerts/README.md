# Background Alerts

No live execution imports, wallet credentials or trading permissions. Production deployment verified on 2026-11-08: `dpl_B2gPPB18k28naiH1qSNaNavtCgr1`, https://www.saibot92.auction/app.

## Local review

Normal `/app` frontend/audio review uses the hosted read-only Alerts API through the Vite proxy, with TLS verification enabled. It no longer depends on the local SQLite worker. The commands below are for standalone SQLite persistence validation; inspect that test store directly at port 8793 rather than assuming `/app` uses it.

Run in three repository terminals (Node 22.13+):

1. `npm run alerts:worker:local` — independent 30-second worker; durable SQLite/WAL at `work/saibot-alerts.sqlite`.
2. `npm run alerts:api:local` — read-only API at port 8793. This process does not scan.
3. `npm run dev -- --host 127.0.0.1 --port 5173` — open `/app`.

Close every UI tab. Leave the first terminal running. Query `http://127.0.0.1:8793/api/alerts/status`: lastScan advances without a browser. Reopen `/app`; server events still exist. Stop/restart both server processes: history, previous classifier states and cooldowns survive. No synthetic event is injected into the real local database. A real event requires a naturally changing market; `npm run test:alerts` separately proves the deterministic transition/restart/closed-UI path using temporary database files and test-only market fixtures.

## Hosted runtime (deployed)

Vercel **daemon** `saibot-alerts`, one Frankfurt (`fra1`) instance, separate from Augustus workers. A normal HTTP function never owns a timer. Existing production daemons already use this runtime. Official reference: https://vercel.com/docs/daemons

Uses existing server-only `DATABASE_URL`, `AUGUSTUS_ENV`, `AUGUSTUS_DATABASE_SCOPE`; optional `ALERTS_ENV` must match the deployment environment. SQLite is rejected on Vercel and in production. Never configure `ALERTS_STORAGE=sqlite` on a host. No new Redis service or agent secret is required.

Before a future deployment, test the migration on a Neon staging branch first. Load the **operator-only direct** `DATABASE_MIGRATION_URL` locally, plus `ALERTS_ENV`, matching `AUGUSTUS_DATABASE_SCOPE` and `ALERTS_RUNTIME_ROLE`, then run `npm run alerts:migrate`. Migration role stays outside Vercel. Do not use production data/credentials for development. Two global public-market tables are deliberately separate from all user trading tables; no user identity, private risk state, keys, or approvals are stored here.

The existing project now runs `Dockerfile.alerts` through `vercel.json`; all three Alerts APIs return HTTP 200. No project or DNS changes were made.

## Reliability and endpoints

`GET /api/alerts` returns recent 100 events, current conditions, public scanner snapshot and health. `GET /api/alerts/live` and `GET /api/alerts/status` return their respective subsets. Browser polls the backend every 15 seconds; acknowledgements are browser-local IDs only. No global acknowledgement POST exists because anonymous users must not mark everyone's alerts as read.

Worker targets 30 seconds start-to-start. Fetch timeout is 15 seconds; missed or failed scans retry at the next cycle. Three batch REST calls per scan, no per-symbol fan-out or new WebSockets. Scanner reads the backend snapshot rather than starting a second batch loop. Existing selected-symbol UI telemetry remains unchanged and does not generate Alerts.

Postgres transaction advisory lock + persisted last-scan guard serialize replicas; SQLite uses BEGIN IMMEDIATE for local cross-process exclusion. Events, baseline, cooldowns, conditions and market snapshot commit atomically. Failed upstream scans preserve the last good baseline and record DEGRADED health. Ambiguous commits fail closed and the next cycle rereads durable state. Retain latest 1,000 global events; UI shows latest 100. Conditions older than 65 seconds are hidden. Acknowledgements never modify event data.

What Changed uses the existing fresh hosted ETH context when available; no universe-wide What Changed history is fabricated. The local batch-only worker cannot produce that event without this richer existing source. Liquidation risk reuses the existing market-context cascade classification, not a new predictor. Restart persists previous state instead of making current conditions fake historical events.

Hosted validation passed: isolated Neon schema-only branch migration, real compute restart, baseline/cooldown persistence, lock exclusion, 1,000-event retention, production runtime-role read/write grants, and production migration. With local Alerts services stopped and app tabs closed, four hosted scans were observed at 30.0–30.5 second intervals. Real events matched direct production Neon reads and appeared in the reopened production drawer. Production daemon restart was confirmed by a second startup log at 2026-11-08T16:20:51.965Z; subsequent ONLINE scans retained the proof event. PC power was not physically switched off; all local service dependencies were stopped. Existing live-execution flags are unchanged.
