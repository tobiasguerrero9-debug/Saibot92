# SAIBOT92 Journal / production vertical slice

The Mini App's JOURNAL tab stores wallet-owned structured decisions, immutable source snapshots, a deterministic post-trade review, derived memory and an offchain Compute ledger. No model provider, token transaction, trading authorization, account provisioning or new database is introduced.

## API and identity

One Vercel function handles `/api/journal`, `/api/journal/:id`, `/api/journal/:id/complete`, `/api/journal/compute`, `/api/journal/memory`, plus `/api/compute` and `/api/memory` aliases. GET `/api/journal/bootstrap` establishes CSRF state; POST challenge/session proves an EVM address using a two-minute, single-use, domain/environment-bound personal-sign message. This is separate from Augustus authentication and cannot provision or authorize a trading agent. POST logout revokes the session.

Opaque 30-minute session tokens are stored only as hashes in Postgres and issued in HttpOnly Secure SameSite=Strict cookies in production. POST additionally requires the same-origin CSRF token. No address query/body parameter grants access. The authenticated session wallet determines every journal operation; SQL also filters by wallet and FORCE RLS enforces the existing transaction-local wallet setting. Account/network changes clear the private UI and attempt session revocation. No wallet private key is stored by this feature.

Supported MVP wallet: an injected EVM provider using personal_sign. A connected provider address alone is insufficient: the server must verify its signature. Smart-contract wallet signature support and Solana signing are outside this slice.

## Persistence and accounting

Migration source is `server/journal/schema.sql`; `scripts/migrate-journal.mjs --apply` requires the existing direct Neon operator connection, exact environment binding and a distinct non-owner/NOBYPASSRLS runtime role. `journal_schema_version` records the migration hash and rejects drift. No SQLite or in-memory persistence fallback exists.

- `journal_entries`: wallet, UUID request id, normalized content fingerprint, original structured input, immutable browser/server snapshot, status and separate immutable final completion record.
- `journal_analysis`: one deterministic six-section review per completed journal.
- `agent_memory`: aggregate JSON profile rebuilt in SQL from that wallet's completed records.
- `compute_ledger`: immutable insert-only award rows, with unique wallet/journal/action, fixed +10 delta and balance_after.
- Two minimal authentication tables hold expiring challenges and hashed sessions; one migration-version table is operational metadata.

The existing HostedStore provides environment validation, transaction-local RLS identity, per-wallet advisory locking and COMMIT-before-success. Completion, analysis, ledger insertion and memory update share ONE transaction. A retry/concurrent completion returns no second award. Runtime grants exclude update/delete of the ledger and analysis. Snapshot/input mutation and any update to a completed journal are rejected by a database trigger.

One completed, valid journal earns exactly 10 offchain Compute. At most 10 completions per wallet per UTC day. Exact repeated content is rejected even with a different request ID; reuse of a request ID with changed input is rejected. The frontend cannot select credit amounts. This is not proof that a trade occurred, Sybil-resistant identity, redeemable currency or a verified performance score. No bonus is issued. Balances are decimal bigint strings; credit deltas are integers.

OPEN entries can be stored at entry time, then completed with a final result, exit/PnL and review. Original thesis, original notes and captured context remain unchanged. Completion data is stored separately. Invalid numeric syntax, non-finite values, leverage outside 1–100, excess text/tags, inconsistent result/PnL and unrecognized request fields fail validation.

## Context and memory

Browser telemetry freezes when a draft begins and is explicitly CLIENT_REPORTED_UNVERIFIED. Source-symbol mismatches are not attached to the new symbol. The snapshot includes available Agent State, Market Bias, Context Score, What Changed, OI, funding, order flow, force-order data, squeeze/liquidation conditions, Alerts and timestamps. The server independently snapshots its existing Alerts monitor, matching persisted Alert IDs/types/severities/timestamps and matching hosted market context at save time. Missing/stale sources are labelled, not manufactured. No additional live-feed worker is introduced.

Memory aggregates completed journal count, top symbols, long/short/no-trade counts, average reported leverage, reported win/loss counts by server-observed regime, explicit `mistake:` tags, common recorded entry triggers and frequent captured Alert types. No psychological conclusion, inferred cause of a loss, actual order execution or USD profitability is invented.

History uses a bounded 30-row keyset page and only summary columns; detail loads full context on demand. Aggregate queries stay in SQL. The existing latest-context index and journal wallet/history/ledger indexes bound reads. No repeated all-journal payload download or extra cache infrastructure is required.

## Validation and release

- `npm test`: existing Alerts/Augustus plus Journal domain/security validation.
- `npm run test:journal:ui`: compiles and renders the actual Journal component; tests capture immutability and source-symbol mismatch handling.
- `npm run test:journal:db`: runs real migration, signature/CSRF/replay, immutable snapshots, concurrent completion, ledger persistence, cross-wallet RLS and daily-limit tests on the isolated Neon validation branch. Never targets production.
- `npm run build`: production Vite build. The repository is JS/JSX, with no TypeScript source/config or pre-existing TypeScript suite; syntax, JSX compilation and lint are the applicable checks.

Operator helper `scripts/journal-operator.mjs` reuses the existing Neon project and roles. `--validation-apply` uses an expiring schema-only branch; `--production-apply` checks the existing production binding before applying the same migration. Connection strings remain in memory. No migration-owner credential belongs in Vercel. Runtime uses the existing DATABASE_URL, AUGUSTUS_ENV, AUGUSTUS_ORIGIN and AUGUSTUS_DATABASE_SCOPE; no new production secret is required.

Production verification must use signed QA wallet identities, not trusted address headers, and verify create/snapshot/complete/reload/balance/memory/cross-wallet denial. Browser-wallet testing must distinguish actual extension signatures from programmatic EOA signing. Existing `/api/alerts/status` and Augustus health/readiness must remain healthy with execution gates unchanged.
