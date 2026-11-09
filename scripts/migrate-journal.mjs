import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool,neonConfig} from '@neondatabase/serverless';
neonConfig.webSocketConstructor=globalThis.WebSocket;
export async function migrateJournal(env=process.env){
 const url=new URL(env.DATABASE_MIGRATION_URL||''),role=env.JOURNAL_RUNTIME_ROLE||env.ALERTS_RUNTIME_ROLE,stage=env.AUGUSTUS_ENV,scope=env.AUGUSTUS_DATABASE_SCOPE;
 if(!url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.')||url.searchParams.get('sslmode')!=='require'||!/^[a-z][a-z0-9_]{1,62}$/.test(role||'')||!['development','preview','production'].includes(stage)||!scope?.startsWith(stage+':'))throw Error('Migration configuration invalid');
 const pool=new Pool({connectionString:String(url),max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});const c=await pool.connect();
 try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5000'");
  const binding=(await c.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];if(binding?.scope!==scope||binding?.environment!==stage)throw Error('Environment binding mismatch');
  const runtime=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];if(!runtime||runtime.rolsuper||runtime.rolbypassrls||(await c.query('SELECT current_user AS name')).rows[0].name===role)throw Error('Distinct non-owner runtime required');
  const sql=readFileSync(new URL('../server/journal/schema.sql',import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  await c.query('CREATE TABLE IF NOT EXISTS journal_schema_version(version integer PRIMARY KEY,hash text NOT NULL)');
  const previous=(await c.query('SELECT hash FROM journal_schema_version WHERE version=1')).rows[0];if(previous&&previous.hash!==hash)throw Error('Migration drift: create a new reviewed migration');
  if(!previous){await c.query(sql);await c.query('INSERT INTO journal_schema_version(version,hash) VALUES(1,$1)',[hash]);}
  await c.query(`GRANT SELECT,INSERT,UPDATE ON journal_entries,agent_memory TO "${role}"`);
  await c.query(`GRANT SELECT,INSERT ON journal_analysis,compute_ledger TO "${role}"`);
  await c.query(`GRANT SELECT,INSERT,DELETE ON journal_login_challenges,journal_sessions TO "${role}"`);
  await c.query(`GRANT SELECT ON journal_schema_version TO "${role}"`);
  await c.query('COMMIT');return {migration:1,hash,environment:stage,applied:!previous,rls:true};
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();await pool.end();}
}
if(process.argv[1]&&new URL(import.meta.url).pathname.replace(/^\//,'').toLowerCase()===process.argv[1].replaceAll('\\','/').toLowerCase()){
 if(process.argv[2]!=='--apply'){console.error('Use --apply with the existing operator connection and runtime role.');process.exitCode=1;}
 else migrateJournal().then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('Journal migration NOT confirmed. Verify operator connection, runtime role and environment binding. No credentials logged.');process.exitCode=1;});
}
