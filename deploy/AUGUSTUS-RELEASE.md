# Augustus hosted release preparation

Execution remains disabled. This is deployment preparation, not a live trading release. See [the execution-path implementation and migration-2 addendum](AUGUSTUS-EXECUTION-PATH.md) for the current signer/protection worker and additional grants. Cloud operational validation is still pending.

## Neon setup

Create three separate databases/branches: augustus-development, augustus-preview and augustus-production. Never copy production sessions or encrypted agent records into another environment. Use a schema owner only to apply `server/augustus/migrations/001_hosted.sql` through `DATABASE_MIGRATION_URL` with `npm run augustus:hosted:migrate`. This connection is operator-only and must not be installed in the deployed application.

Create a separate runtime login with NOSUPERUSER, NOBYPASSRLS, no schema ownership and no membership in privileged roles. Grant CONNECT on its database, USAGE on public, SELECT/INSERT/UPDATE/DELETE on the augustus tables, and USAGE/SELECT on the two identity sequences. Do not grant schema CREATE or role administration. Restrict `augustus_account_reviews` and `augustus_deployment` to SELECT for the runtime; only the operator may modify release reviews or environment bindings.

As schema owner, insert exactly one `augustus_deployment` row with `singleton=true`, environment matching development/preview/production and a unique scope such as `production:augustus-v1`. The matching scope must be set in the application. Use a pooled runtime connection with `sslmode=require`.

## Vercel environment contract

Configure these server-only variables separately for each Vercel environment. None may have a VITE_ prefix.

| Variable | Configuration |
| --- | --- |
| DATABASE_URL | Neon runtime role pooled connection, SSL required |
| AUGUSTUS_ENV | development, preview or production, matching VERCEL_ENV |
| AUGUSTUS_ORIGIN | Exact deployed origin, HTTPS outside development |
| AUGUSTUS_DATABASE_SCOPE | Exact environment binding stored in Neon |
| AGENT_ENCRYPTION_KEY_BASE64 | Independently generated 32 random bytes encoded as Base64; unique per environment |
| AGENT_ENCRYPTION_KEY_ID | Environment-specific encryption key version identifier |
| CRON_SECRET | Independently generated random secret, at least 32 characters |
| LIVE_EXECUTION | false |
| AUGUSTUS_RELEASE_REVIEWED | false |
| AUGUSTUS_DIAGNOSTICS_ENABLED | false |

Store secrets using encrypted Vercel server environment variables. Never paste credentials into chat. Preserve encryption keys securely; losing them prevents recovery of encrypted user agents. Key rotation/migration requires a separate reviewed procedure. `.env.example` contains names only. `DATABASE_MIGRATION_URL` is only for the local migration operator.

## Deployment and checks still required

The existing Vercel project serves the static frontend and server API. The configured context Daemon requires project support for Vercel Daemons. It collects real public telemetry and writes fresh context to Neon; functions cannot replace this continuous collector with a timer. No filesystem persistence is assumed. If Daemon deployment is unavailable, deployment remains blocked until a supported continuous worker is provisioned.

Run `npm run augustus:hosted:check` with the target environment. `/api/augustus-product/health` is liveness only; `/api/augustus-product/ready` checks database and context. Validate HTTPS, same-origin cookies, CSRF, rate limits, actual Neon transactions/RLS, two independent wallet sessions, restart recovery, desktop/mobile and stale-context rejection on Preview before Production. No cloud deployment or real database validation has been performed without credentials.

## Stop-policy release hold

Tests cover filled and partial entries, independently verified reduce-only stops, stop rejection, emergency close, duplicate identifiers and restart reconciliation. An exchange acknowledgement alone never means PROTECTED. A server-only signer and separate protection worker are implemented behind disabled global and reviewed-account gates. Hosted operation has not been verified. Do not enable execution to bypass validation. Partial or ambiguous emergency closes require reconciliation; exhausted recovery remains an incident, never a new entry.

## Manual wallet validation

User confirmed identity sign-in, Unified 7.8 USDC, 5x CROSS, authorized agent detection, risk configuration and ARM monitoring. Refresh persistence, disconnect/reconnect and wrong-wallet isolation were answered "PASS/FAIL" and remain unverified. No financial signature or trade occurred. Repeat these three checks in the hosted environment; local pilot validation does not certify hosted persistence.
