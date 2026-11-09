# Approved-proposal execution path

Implementation is server-only; live submission remains OFF by default. No deployment, real signature, authorization or order was performed during implementation.

## Transaction boundary

The same-origin API authenticates the wallet cookie and CSRF proof. Execution requires an allowed, unexpired operator review, Production scope, both live flags, current agent mapping and a fresh protection-worker heartbeat. Approval includes the exact proposalId and bindingHash. The original engine revalidates eligibility, risk, price, account and context. One transaction consumes approval, reserves the one-entry slot and persists the execution job with unique executionId and entry/stop/exit CLOIDs. Only after acknowledged COMMIT can a separate worker discover the job.

Immediately before entry signing/transmission the worker checks current proposal eligibility, account state, ETH metadata, CROSS leverage, risk caps, session identity/revocation, kill state and unchanged fresh context. Each write intent and monotonically increasing per-agent nonce must commit before the SDK signer is invoked. No transfer, authorization or leverage method is exposed by the live exchange wrapper. The network target is fixed to the Mainnet exchange endpoint, redirects are rejected and requests have a short expiresAfter. Every SDK HTTP request in tests is intercepted by a mock transport.

## Protection and restart

The independent `augustus-protection` Daemon leases persisted jobs. The context Daemon is unchanged. Entry ambiguity consumes the slot and is reconciled by CLOID; entry is never replayed. Attribution requires actual fills linked to the reserved entry and a matching ETH position. The worker cancels only owned residual entries. It protects the actual filled size and independently checks the live stop's CLOID, market, side, trigger, reduce-only flag and exact size before reporting PROTECTED.

Missing, rejected, mismatched or unreadable protection triggers an incident and an emergency reduce-only close for verified managed exposure. Closing rereads actual size and never reverses exposure. A partial/uncertain close is not reported complete. A second close uses a new CLOID only after the previous exit is independently terminal and remaining ownership is still valid; two attempts maximum. Persisted uncertainty remains an incident and blocks new entries. Flat state is independently verified before owned protection cleanup.

Restarted workers reconstruct linkage from the job, fills and exchange state. Leases fence stale workers and database uniqueness prevents replaying reserved writes. A dead worker, missed reconciliation deadline or unresolved incident closes the entry gate. Database or exchange outages can prevent protection/closing; the software reports uncertainty rather than guaranteeing safety during an outage. Unattributed or externally enlarged/reversed exposure is never adopted or automatically closed.

KILL/disconnect and explicit managed CLOSE requests commit without requiring a working market API. KILL invalidates pending proposals/approvals and cancels owned pending entries through the worker, while preserving verified stops. CLOSE requires the exact executionId plus explicit confirmation. Risk or context changes cannot silently amend a previously approved entry.

## Migration and grants before hosted validation

As the operator, run `npm run augustus:hosted:migrate` using only DATABASE_MIGRATION_URL. It now applies both numbered migrations. Runtime health requires versions 1 and 2. After migration, grant the corresponding non-owner runtime role SELECT/INSERT/UPDATE/DELETE on:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.augustus_execution_jobs,
  public.augustus_execution_operations,
  public.augustus_agent_nonces,
  public.augustus_protection_queue,
  public.augustus_protection_health
TO augustus_production_runtime;
```

Repeat with Development/Preview runtime roles in their separate databases. Jobs, operations and nonces use forced wallet RLS. The queue and heartbeat are server-only worker discovery/control records, not public API data. No additional secret variable is needed; the worker decrypts the authenticated user's mapped agent only inside a scoped SDK signing callback. Never put keys in VITE_ variables.

Keep `LIVE_EXECUTION=false`, `AUGUSTUS_RELEASE_REVIEWED=false` and diagnostics false. `/api/augustus-product/ready` now requires the context and protection workers, but is not account-specific trading approval. Vercel configuration declares the second Daemon; `npm run augustus:protection:worker` is its entrypoint. Do not start it against an account with live managed jobs unless operational recovery has been explicitly reviewed.

## Remaining operational validation

Real Neon migrations/grants/RLS/commit-loss and simultaneous-worker testing, Vercel worker rollout/restart/heartbeat validation, hosted wallet/session isolation, and a fresh naturally eligible proposal remain required. Mainnet orders have not been tested live. One-entry reservations are deliberately not automatically released; beginning another trading session after a consumed slot requires a separate reviewed lifecycle change. No environment flag alone creates an account review or an approved proposal.

The first canary must stop at the review screen showing exact proposalId, size/notional, leverage, entry/stop, optional target, maximum estimated loss, margin, collateral, fresh context and gate/worker/emergency-close status. It requires separate explicit human approval. Do not force eligibility or enable flags as part of this implementation.
