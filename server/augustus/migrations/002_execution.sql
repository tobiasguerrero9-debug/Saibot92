BEGIN;
CREATE TABLE IF NOT EXISTS augustus_execution_jobs (
  wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet),
  execution_id uuid NOT NULL UNIQUE,
  proposal_id text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS augustus_execution_operations (
  wallet text NOT NULL REFERENCES augustus_accounts(wallet),
  cloid text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('entry','stop','exit','cancel')),
  nonce bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(wallet,cloid)
);
CREATE TABLE IF NOT EXISTS augustus_agent_nonces (
  wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet),
  nonce bigint NOT NULL
);
-- Server-only discovery/leases. Contains no signing material or proposal content.
CREATE TABLE IF NOT EXISTS augustus_protection_queue (
  wallet text PRIMARY KEY REFERENCES augustus_accounts(wallet),
  execution_id uuid NOT NULL UNIQUE,
  holder uuid,
  lease_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  fault boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS augustus_protection_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  healthy boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  worker_id uuid NOT NULL
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['augustus_execution_jobs','augustus_execution_operations','augustus_agent_nonces'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='tenant_wallet') THEN
    EXECUTE format('CREATE POLICY tenant_wallet ON %I USING(wallet=current_setting(''augustus.wallet'',true)) WITH CHECK(wallet=current_setting(''augustus.wallet'',true))',t);
  END IF;
END LOOP; END $$;
INSERT INTO augustus_schema_version(version) VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
