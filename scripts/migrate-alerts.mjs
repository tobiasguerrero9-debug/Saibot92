import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor=globalThis.WebSocket;
let pool;
process.on('uncaughtException',()=>{console.error('Alerts migration failed safely.');process.exit(1)});
process.on('unhandledRejection',()=>{console.error('Alerts migration failed safely.');process.exit(1)});
try {
  if(process.argv.slice(2).join(' ')!=='--apply')throw Error();
  const url=new URL(process.env.DATABASE_MIGRATION_URL||''),role=process.env.ALERTS_RUNTIME_ROLE,stage=process.env.ALERTS_ENV,scope=process.env.AUGUSTUS_DATABASE_SCOPE;
  if(!url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.')||url.searchParams.get('sslmode')!=='require'||!/^[a-z][a-z0-9_]{1,62}$/.test(role||'')||!['development','preview','production'].includes(stage)||!scope?.startsWith(stage+':'))throw Error();
  pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const binding=(await c.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];if(binding?.scope!==scope||binding?.environment!==stage)throw Error();
    const runtime=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];if(!runtime||runtime.rolsuper||runtime.rolbypassrls)throw Error();
    if((await c.query('SELECT current_user AS name')).rows[0].name===role)throw Error();
    await c.query(readFileSync(new URL('../server/alerts/schema.sql',import.meta.url),'utf8').replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,''));
    const old=(await c.query('SELECT environment FROM saibot_alerts_monitor WHERE singleton=true')).rows[0];if(old&&old.environment!==stage)throw Error();
    await c.query('INSERT INTO saibot_alerts_monitor(singleton,environment) VALUES(true,$1) ON CONFLICT DO NOTHING',[stage]);
    await c.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON saibot_alerts_monitor,saibot_alerts_events TO "${role}"`);
    await c.query('COMMIT');console.log('Alerts schema applied; environment binding and non-owner runtime grants verified.');
  }catch{await c.query('ROLLBACK').catch(()=>{});throw Error()}finally{c.release()}
}catch{console.error('Alerts migration not confirmed. Verify operator-only URL, target environment and runtime role. No credentials logged.');process.exitCode=1}finally{await pool?.end()}
