import { Pool, neonConfig } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
neonConfig.webSocketConstructor = globalThis.WebSocket;
export class HostedStore {
  constructor(config, pool = null) { this.config = config; this.pool = pool || new Pool({ connectionString: config.databaseUrl, max: 3, connectionTimeoutMillis: 10000 }); this.pool.on?.('error', () => { this.failed = true; }); }
  async transaction(wallet, fn) {
    let client;
    try {
      if (this.failed) throw Error('Database pool unavailable');
      client = await this.pool.connect(); await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '12000'");
      const scope = await client.query('SELECT scope, environment FROM augustus_deployment WHERE singleton = true');
      if (scope.rows[0]?.scope !== this.config.databaseScope || scope.rows[0]?.environment !== this.config.stage) throw Error('Database environment binding mismatch');
      await client.query("SELECT set_config('augustus.wallet', $1, true)", [wallet.toLowerCase()]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [wallet.toLowerCase()]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result; // No success response until COMMIT is acknowledged.
    } catch { if (client) await client.query('ROLLBACK').catch(() => {}); throw Error('Persistence unavailable or unconfirmed; operation blocked.'); }
    finally { client?.release(); }
  }
  async health() { return this.transaction('0x0000000000000000000000000000000000000000', async c => { const r = await c.query("SELECT version FROM augustus_schema_version WHERE version IN (1,2)"); if (r.rows.length !== 2) throw Error('Migrations missing'); const role = (await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]; if (!role || role.rolsuper || role.rolbypassrls) throw Error('Runtime role must not bypass tenant policies'); const id = randomUUID(); await c.query('INSERT INTO augustus_health_checks(id) VALUES($1)', [id]); await c.query('DELETE FROM augustus_health_checks WHERE id=$1', [id]); return { database: true, schema: true, scope: true, durableWrite: true, tenantPolicies: true }; }); }
  async rateLimit(key, limit = 60) {
    return this.transaction('0x0000000000000000000000000000000000000000', async c => { const r = await c.query("INSERT INTO augustus_rate_limits (bucket, hits, expires_at) VALUES ($1, 1, now() + interval '1 minute') ON CONFLICT (bucket) DO UPDATE SET hits = CASE WHEN augustus_rate_limits.expires_at < now() THEN 1 ELSE augustus_rate_limits.hits + 1 END, expires_at = CASE WHEN augustus_rate_limits.expires_at < now() THEN now() + interval '1 minute' ELSE augustus_rate_limits.expires_at END RETURNING hits", [key]); if (r.rows[0].hits > limit) throw Error('Rate limit exceeded'); return true; });
  }
}

