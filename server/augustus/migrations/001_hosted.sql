BEGIN;
CREATE TABLE IF NOT EXISTS augustus_schema_version (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS augustus_deployment (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), scope text NOT NULL UNIQUE, environment text NOT NULL CHECK(environment IN ('development','preview','production')));
-- Bind this row manually per Neon branch. Never clone production scope into Preview.
CREATE TABLE IF NOT EXISTS augustus_accounts (wallet text PRIMARY KEY CHECK(wallet ~ '^0x[0-9a-f]{40}$'), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_agents (wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet), address text NOT NULL UNIQUE CHECK(address ~ '^0x[0-9a-f]{40}$'), encrypted jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_state (wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet), revision bigint NOT NULL DEFAULT 0, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, wallet text NOT NULL REFERENCES augustus_accounts(wallet), event jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_proposals (wallet text NOT NULL REFERENCES augustus_accounts(wallet), proposal_id text NOT NULL, binding_hash text NOT NULL, payload jsonb NOT NULL, expires_at timestamptz NOT NULL, invalidated boolean NOT NULL DEFAULT false, PRIMARY KEY(wallet,proposal_id));
CREATE TABLE IF NOT EXISTS augustus_approvals (wallet text NOT NULL REFERENCES augustus_accounts(wallet), proposal_id text NOT NULL, binding_hash text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(), consumed boolean NOT NULL DEFAULT false, PRIMARY KEY(wallet,proposal_id), FOREIGN KEY(wallet,proposal_id) REFERENCES augustus_proposals(wallet,proposal_id));
CREATE TABLE IF NOT EXISTS augustus_execution_locks (wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet), execution_id uuid NOT NULL UNIQUE, proposal_id text NOT NULL, entry_reserved boolean NOT NULL DEFAULT true, reconciliation_required boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_account_reviews (wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet), allowed boolean NOT NULL DEFAULT false, reviewed boolean NOT NULL DEFAULT false, review_id text, expires_at timestamptz);
CREATE TABLE IF NOT EXISTS augustus_login_challenges (nonce_hash text PRIMARY KEY, wallet text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS augustus_sessions (token_hash text PRIMARY KEY, wallet text NOT NULL REFERENCES augustus_accounts(wallet), csrf_hash text NOT NULL, origin text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS augustus_context (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, observed_at timestamptz NOT NULL, payload jsonb NOT NULL, worker_healthy boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS augustus_rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS augustus_health_checks (id text PRIMARY KEY, checked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS augustus_worker_leases (name text PRIMARY KEY, holder uuid NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS augustus_context_recent ON augustus_context(observed_at DESC);
CREATE INDEX IF NOT EXISTS augustus_events_wallet ON augustus_events(wallet,id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['augustus_accounts','augustus_agents','augustus_state','augustus_events','augustus_proposals','augustus_approvals','augustus_execution_locks','augustus_account_reviews'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='tenant_wallet') THEN
    EXECUTE format('CREATE POLICY tenant_wallet ON %I USING (wallet = current_setting(''augustus.wallet'', true)) WITH CHECK (wallet = current_setting(''augustus.wallet'', true))', t);
  END IF;
END LOOP; END $$;
INSERT INTO augustus_schema_version(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
