import { Pool, neonConfig } from '@neondatabase/serverless';
import { publicSnapshot } from './engine.js';
import { PersistenceBackoff } from './reliability.js';
neonConfig.webSocketConstructor = globalThis.WebSocket;
export class PostgresAlertsRepository {
  constructor(env = process.env, { pool, clock, report = record => console.log(JSON.stringify(record)) } = {}) {
    this.stage = env.ALERTS_ENV || env.AUGUSTUS_ENV;
    this.scope = env.AUGUSTUS_DATABASE_SCOPE;
    const url = new URL(env.DATABASE_URL || '');
    if (!['development','preview','production'].includes(this.stage) || (env.VERCEL_ENV && env.VERCEL_ENV !== this.stage) || !url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'require' || !this.scope?.startsWith(this.stage + ':')) throw Error('Alerts environment unavailable');
    this.pool = pool || new Pool({ connectionString: env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000 }); this.pool.on('error', () => {});
    this.backoff = new PersistenceBackoff({ clock }); this.report = report;
    this.telemetry = { queries: 0, responseBytes: 0 };
  }
  async query(client, label, sql, args) {
    const started = Date.now(); this.telemetry.queries++;
    const result = await client.query(sql, args);
    const bytes = Buffer.byteLength(JSON.stringify(result.rows || [])); this.telemetry.responseBytes += bytes;
    this.report({ event: 'ALERTS_DB_QUERY', label, rows: result.rows?.length || 0, responseBytes: bytes, durationMs: Date.now() - started });
    return result;
  }
  observeClient(client) {
    if (!client.alertsErrorObserved && typeof client.on === 'function') {
      client.alertsErrorObserved = true;
      // pg removes the pool's idle-error listener while a client is checked out.
      // A socket error must reject the query, not become an uncaught EventEmitter error.
      client.on('error', () => { client.alertsConnectionBroken = true; });
    }
  }
  async checked(client, view = 'worker') {
    const binding = (await this.query(client, 'binding', 'SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];
    if (binding?.scope !== this.scope || binding?.environment !== this.stage) throw Error('Scope mismatch');
    const projections = {
      worker: "payload - 'markets' - 'conditions'",
      all: "payload - 'baseline' - 'cooldowns'",
      inbox: "jsonb_build_object('status',payload->'status','conditions',payload->'conditions')",
      live: "jsonb_build_object('status',payload->'status','conditions',payload->'conditions')",
      status: "jsonb_build_object('status',payload->'status')",
    };
    if (!Object.hasOwn(projections, view)) throw Error('Invalid projection');
    const row = (await this.query(client, 'monitor_' + view, `SELECT environment,${projections[view]} AS payload FROM saibot_alerts_monitor WHERE singleton=true`)).rows[0];
    if (row && row.environment !== this.stage) throw Error('Alerts environment mismatch');
    return row?.payload || null;
  }
  async cycle(scan) {
    this.backoff.check(); let c, broken = false;
    try {
      c = await this.pool.connect();
      this.observeClient(c);
      await c.query('BEGIN'); await c.query("SET LOCAL statement_timeout='20000'"); await c.query("SET LOCAL idle_in_transaction_session_timeout='25000'");
      const locked = (await c.query("SELECT pg_try_advisory_xact_lock(928992,92) AS acquired")).rows[0]?.acquired;
      if (!locked) { await c.query('ROLLBACK'); return { skipped: true }; }
      const previous = await this.checked(c);
      const context = (await c.query("SELECT payload FROM augustus_context WHERE observed_at>now()-interval '10 seconds' AND worker_healthy=true ORDER BY observed_at DESC LIMIT 1")).rows[0]?.payload;
      const next = await scan(previous, context);
      if (next) {
        if (next.newEvents?.length) await c.query("INSERT INTO saibot_alerts_events(id,observed_at,payload) SELECT e->>'id',to_timestamp((e->>'timestamp')::double precision/1000),e FROM jsonb_array_elements($1::jsonb) AS e ON CONFLICT(id) DO NOTHING", [JSON.stringify(next.newEvents)]);
        if (next.status?.state === 'DEGRADED') {
          // A failed fetch must not erase the last market snapshot omitted by the worker projection.
          await c.query("UPDATE saibot_alerts_monitor SET payload=jsonb_set(payload,'{status}',$1::jsonb) WHERE singleton=true", [JSON.stringify(next.status)]);
        } else {
          const payload = { ...next }; delete payload.newEvents;
          await c.query('INSERT INTO saibot_alerts_monitor(singleton,environment,payload) VALUES(true,$1,$2) ON CONFLICT(singleton) DO UPDATE SET payload=EXCLUDED.payload', [this.stage,JSON.stringify(payload)]);
        }
        await c.query('DELETE FROM saibot_alerts_events WHERE id IN (SELECT id FROM saibot_alerts_events ORDER BY observed_at DESC,id DESC OFFSET 1000)');
      }
      await c.query('COMMIT'); this.backoff.success(); return { committed: true, events: next?.newEvents?.length || 0, state: next?.status?.state || previous?.status?.state || 'RECOVERING' };
    } catch (error) { broken = true; await c?.query('ROLLBACK').catch(() => {}); throw this.backoff.fail(error); }
    finally { c?.release(broken || c.alertsConnectionBroken === true); }
  }
  async read({ view = 'all' } = {}) {
    this.backoff.check(); let c, broken = false;
    try {
      c = await this.pool.connect();
      this.observeClient(c);
      await c.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ');
      await c.query("SET LOCAL statement_timeout='10000'");
      const record = await this.checked(c, view);
      const events = ['all','inbox'].includes(view) ? (await this.query(c, 'recent_events', 'SELECT payload FROM saibot_alerts_events ORDER BY observed_at DESC,id DESC LIMIT 100')).rows.map(r => r.payload) : [];
      await c.query('COMMIT'); this.backoff.success(); return publicSnapshot(record, events);
    } catch (error) { broken = true; await c?.query('ROLLBACK').catch(() => {}); throw this.backoff.fail(error); } finally { c?.release(broken || c.alertsConnectionBroken === true); }
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
