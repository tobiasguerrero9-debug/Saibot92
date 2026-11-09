import { Pool, neonConfig } from '@neondatabase/serverless';
import { publicSnapshot } from './engine.js';
neonConfig.webSocketConstructor = globalThis.WebSocket;
export class PostgresAlertsRepository {
  constructor(env = process.env) {
    this.stage = env.ALERTS_ENV || env.AUGUSTUS_ENV;
    this.scope = env.AUGUSTUS_DATABASE_SCOPE;
    const url = new URL(env.DATABASE_URL || '');
    if (!['development','preview','production'].includes(this.stage) || (env.VERCEL_ENV && env.VERCEL_ENV !== this.stage) || !url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'require' || !this.scope?.startsWith(this.stage + ':')) throw Error('Alerts environment unavailable');
    this.pool = new Pool({ connectionString: env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000 }); this.pool.on('error', () => {});
  }
  async checked(client) {
    const binding = (await client.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];
    if (binding?.scope !== this.scope || binding?.environment !== this.stage) throw Error('Scope mismatch');
    const row = (await client.query('SELECT environment,payload FROM saibot_alerts_monitor WHERE singleton=true')).rows[0];
    if (row && row.environment !== this.stage) throw Error('Alerts environment mismatch');
    return row?.payload || null;
  }
  async cycle(scan) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN'); await c.query("SET LOCAL statement_timeout='20000'"); await c.query("SET LOCAL idle_in_transaction_session_timeout='25000'");
      const locked = (await c.query("SELECT pg_try_advisory_xact_lock(928992,92) AS acquired")).rows[0]?.acquired;
      if (!locked) { await c.query('ROLLBACK'); return { skipped: true }; }
      const previous = await this.checked(c);
      const context = (await c.query("SELECT payload FROM augustus_context WHERE observed_at>now()-interval '10 seconds' AND worker_healthy=true ORDER BY observed_at DESC LIMIT 1")).rows[0]?.payload;
      const next = await scan(previous, context);
      if (next) {
        if (next.newEvents?.length) await c.query("INSERT INTO saibot_alerts_events(id,observed_at,payload) SELECT e->>'id',to_timestamp((e->>'timestamp')::double precision/1000),e FROM jsonb_array_elements($1::jsonb) AS e ON CONFLICT(id) DO NOTHING", [JSON.stringify(next.newEvents)]);
        const payload = { ...next }; delete payload.newEvents;
        await c.query('INSERT INTO saibot_alerts_monitor(singleton,environment,payload) VALUES(true,$1,$2) ON CONFLICT(singleton) DO UPDATE SET payload=EXCLUDED.payload', [this.stage,JSON.stringify(payload)]);
        await c.query('DELETE FROM saibot_alerts_events WHERE id IN (SELECT id FROM saibot_alerts_events ORDER BY observed_at DESC,id DESC OFFSET 1000)');
      }
      await c.query('COMMIT'); return { committed: true, events: next?.newEvents?.length || 0 };
    } catch { await c.query('ROLLBACK').catch(() => {}); throw Error('Alerts persistence unavailable'); }
    finally { c.release(); }
  }
  async read() {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ');
      await c.query("SET LOCAL statement_timeout='10000'");
      const record = await this.checked(c);
      const events = (await c.query('SELECT payload FROM saibot_alerts_events ORDER BY observed_at DESC,id DESC LIMIT 100')).rows.map(r => r.payload);
      await c.query('COMMIT'); return publicSnapshot(record, events);
    } catch { await c.query('ROLLBACK').catch(() => {}); throw Error('Alerts persistence unavailable'); } finally { c.release(); }
  }
  close() { return this.pool.end(); }
}
export async function createAlertsRepository(env = process.env) {
  if (env.ALERTS_STORAGE === 'sqlite') {
    if (env.NODE_ENV === 'production' || env.VERCEL_ENV || env.ALERTS_ENV !== 'development') throw Error('SQLite is local development only');
    const { SqliteAlertsRepository } = await import('./sqliteRepository.js');
    return new SqliteAlertsRepository(env.ALERTS_SQLITE_PATH || 'work/saibot-alerts.sqlite');
  }
  return new PostgresAlertsRepository(env);
}
