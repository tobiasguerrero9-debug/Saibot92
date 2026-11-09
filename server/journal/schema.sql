CREATE TABLE IF NOT EXISTS journal_entries(id uuid PRIMARY KEY,wallet text NOT NULL CHECK(wallet ~ '^0x[0-9a-f]{40}$'),request_id uuid NOT NULL,fingerprint text NOT NULL,input jsonb NOT NULL,snapshot jsonb NOT NULL,completion jsonb,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','COMPLETED')),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,UNIQUE(wallet,request_id),UNIQUE(wallet,fingerprint),UNIQUE(id,wallet));
CREATE INDEX IF NOT EXISTS journal_history ON journal_entries(wallet,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS journal_analysis(journal_id uuid PRIMARY KEY,wallet text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(journal_id,wallet) REFERENCES journal_entries(id,wallet));
CREATE TABLE IF NOT EXISTS agent_memory(wallet text PRIMARY KEY,payload jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS compute_ledger(id uuid PRIMARY KEY,wallet text NOT NULL,journal_id uuid NOT NULL,action text NOT NULL CHECK(action='JOURNAL_COMPLETED'),credits_delta integer NOT NULL CHECK(credits_delta=10),balance_after bigint NOT NULL CHECK(balance_after>=10),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(wallet,journal_id,action),FOREIGN KEY(journal_id,wallet) REFERENCES journal_entries(id,wallet));
CREATE INDEX IF NOT EXISTS compute_wallet ON compute_ledger(wallet,created_at DESC);
CREATE TABLE IF NOT EXISTS journal_login_challenges(nonce_hash text PRIMARY KEY,wallet text NOT NULL,message text NOT NULL,csrf_hash text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS journal_sessions(token_hash text PRIMARY KEY,wallet text NOT NULL,csrf_hash text NOT NULL,origin text NOT NULL,expires_at timestamptz NOT NULL);
CREATE OR REPLACE FUNCTION journal_immutable_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.wallet IS DISTINCT FROM OLD.wallet OR NEW.id IS DISTINCT FROM OLD.id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint OR NEW.input IS DISTINCT FROM OLD.input OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.status='COMPLETED' THEN RAISE EXCEPTION 'Journal content and completed entries are immutable'; END IF; RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='journal_snapshot_guard') THEN CREATE TRIGGER journal_snapshot_guard BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION journal_immutable_snapshot(); END IF;
 FOREACH t IN ARRAY ARRAY['journal_entries','journal_analysis','agent_memory','compute_ledger'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='journal_wallet') THEN EXECUTE format('CREATE POLICY journal_wallet ON %I USING(wallet=current_setting(''augustus.wallet'',true)) WITH CHECK(wallet=current_setting(''augustus.wallet'',true))',t);END IF;
 END LOOP;
END $$;
REVOKE ALL ON journal_entries,journal_analysis,agent_memory,compute_ledger,journal_login_challenges,journal_sessions FROM PUBLIC;

