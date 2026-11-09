import { Pool, neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = globalThis.WebSocket;
let pool;
try {
  const url = new URL(process.env.DATABASE_MIGRATION_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech') || url.searchParams.get('sslmode') !== 'require') throw Error();
  pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    const scope = (await client.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];
    if (scope?.environment !== 'production' || !scope.scope.startsWith('production:')) throw Error();
    const identity = (await client.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    console.log(JSON.stringify({ targetVerified: true, ...identity, environment: scope.environment, scope: scope.scope }));
  } finally { client.release(); }
} catch { console.error('Migration target not verified. No migration authorized: check the operator connection and existing Production database scope binding. No credentials logged.'); process.exitCode = 1; }
finally { await pool?.end(); }
