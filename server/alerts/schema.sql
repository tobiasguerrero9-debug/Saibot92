BEGIN;
CREATE TABLE IF NOT EXISTS saibot_alerts_monitor (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  environment text NOT NULL CHECK(environment IN ('development','preview','production')),
  payload jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS saibot_alerts_events (
  id text PRIMARY KEY, observed_at timestamptz NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS saibot_alerts_events_time ON saibot_alerts_events(observed_at DESC,id);
REVOKE ALL ON saibot_alerts_monitor,saibot_alerts_events FROM PUBLIC;
COMMIT;
