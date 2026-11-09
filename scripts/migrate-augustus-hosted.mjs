import { readFileSync, readdirSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = globalThis.WebSocket;
let pool;
try {
  if (process.argv.slice(2).join(' ') !== '--apply') throw Error('Use --apply only after reviewing the migration.');
  const url = new URL(process.env.DATABASE_MIGRATION_URL || '');
  if (!url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'require') throw Error('Neon migration URL required');
  pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
  const client = await pool.connect();
  try { const directory = new URL('../server/augustus/migrations/', import.meta.url); for (const name of readdirSync(directory).filter(n => /^\d+.*\.sql$/.test(n)).sort()) await client.query(readFileSync(new URL(name, directory), 'utf8')); console.log('Augustus schema migrations applied. Database scope and runtime-role grants must be configured separately.'); }
  finally { client.release(); }
} catch { console.error('Migration not applied or not confirmed. Verify the operator-only migration environment; no credentials logged.'); process.exitCode = 1; }
finally { await pool?.end(); }
