// Operator-only deployment task. No Hyperliquid imports or order/signing paths.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { HostedStore } from '../server/augustus/hosted/store.js';
neonConfig.webSocketConstructor = globalThis.WebSocket;
const manifestPath = 'work/augustus-production-provisioning.local';
const metadata = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
const branch = process.argv[2], production = branch === metadata.productionBranchId;
const restartCheck = process.argv.includes('--restart-check');
if (metadata.projectId !== 'dark-term-83490658' || ![metadata.productionBranchId, metadata.validationBranchId].includes(branch) || (production && !metadata.validationPassed)) throw Error('Verified provisioning target required');
const database = 'augustus_production', role = 'augustus_production_runtime', owner = 'augustus_production_migrator';
const cliRoot = 'C:/Users/tobia/AppData/Roaming/npm/node_modules/neon';
const cliPackage = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
const cli = path.join(cliRoot, typeof cliPackage.bin === 'string' ? cliPackage.bin : cliPackage.bin.neon);
let step = 'operator connection', adminPool, runtimePool, report = { branch, production, executionEnabled: false };
const check = (value, message) => { if (!value) throw Error(message); };
// Never allow Node's default error printer to serialize a pg client (which can
// contain a connection string). Expected idle disconnects are handled per pool.
const fatal = () => { console.error(JSON.stringify({ status: 'FAIL', step, errorCode: 'UNHANDLED_OPERATOR_FAILURE', credentialsLogged: false })); process.exit(1); };
process.on('uncaughtException', fatal); process.on('unhandledRejection', fatal);
function poolFor(connectionString, max = 1) { const pool = new Pool({ connectionString, max, connectionTimeoutMillis: 15000 }); pool.on('error', () => { /* Reconnection checks use a fresh pool; never print the pg client. */ }); return pool; }
function connection() {
  const output = execFileSync(process.execPath, [cli, 'connection-string', branch, '--project-id', metadata.projectId, '--role-name', owner, '--database-name', database, '--ssl', 'require', '--no-color'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 30000 }).trim();
  const match = output.match(/postgres(?:ql)?:\/\/[^\s"<>]+/);
  check(match, 'Operator connection unavailable'); const url = new URL(match[0]);
  check(url.hostname.endsWith('.neon.tech') && !url.hostname.includes('-pooler.') && url.searchParams.get('sslmode') === 'require' && decodeURIComponent(url.username) === owner && url.pathname === '/' + database, 'Operator target mismatch');
  return url;
}
function protect(value, decrypt = false) {
  check(process.env.OPERATOR_PWSH && fs.existsSync(process.env.OPERATOR_PWSH), 'Operator PowerShell unavailable');
  const code = decrypt
    ? '$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))}finally{[Array]::Clear($p,0,$p.Length)}'
    : '$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());try{$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p))}finally{[Array]::Clear($b,0,$b.Length)}';
  return execFileSync(process.env.OPERATOR_PWSH, ['-NoLogo','-NoProfile','-NonInteractive','-Command',code], { input: value, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 15000 }).trim();
}
const tenantTables = ['augustus_accounts','augustus_agents','augustus_state','augustus_events','augustus_proposals','augustus_approvals','augustus_execution_locks','augustus_account_reviews','augustus_execution_jobs','augustus_execution_operations','augustus_agent_nonces'];
try {
  const operator = connection();
  adminPool = poolFor(operator.toString());
  const identity = (await adminPool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
  check(identity.database === database && identity.role === owner, 'Operator identity mismatch');
  step = 'numbered migrations';
  const migrated = spawnSync(process.execPath, ['scripts/migrate-augustus-hosted.mjs','--apply'], { env: { ...process.env, DATABASE_MIGRATION_URL: operator.toString() }, encoding: 'utf8', timeout: 90000, stdio: ['ignore','pipe','pipe'] });
  check(migrated.status === 0, 'Migration unconfirmed');
  report.migrations = (await adminPool.query('SELECT version FROM augustus_schema_version ORDER BY version')).rows.map(r => r.version);
  check(report.migrations.includes(1) && report.migrations.includes(2), 'Migration versions incomplete');
  step = 'runtime credential protection';
  const credentialPath = path.resolve('../work', `augustus-runtime-${branch}.local`);
  let runtime;
  const exists = (await adminPool.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [role])).rows.length > 0;
  if (exists) {
    check(fs.existsSync(credentialPath), 'Existing runtime credential unavailable; rotation forbidden');
    runtime = new URL(protect(fs.readFileSync(credentialPath, 'utf8'), true));
  } else {
    runtime = new URL(operator); runtime.username = role; runtime.password = randomBytes(32).toString('hex');
    runtime.hostname = runtime.hostname.replace('.', '-pooler.');
    fs.writeFileSync(credentialPath, protect(runtime.toString()), { flag: 'wx' });
    check(protect(fs.readFileSync(credentialPath, 'utf8'), true) === runtime.toString(), 'Encrypted credential recovery failed');
    // Password is generated hexadecimal, never interpolated from user input.
    await adminPool.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD '${runtime.password}'`);
  }
  check(runtime.username === role && runtime.pathname === operator.pathname && runtime.hostname.replace('-pooler.', '.') === operator.hostname, 'Runtime target mismatch');
  step = 'scope and least privilege grants';
  await adminPool.query(`BEGIN;
    INSERT INTO augustus_deployment(singleton,scope,environment) VALUES(true,'production:augustus-v1','production') ON CONFLICT DO NOTHING;
    REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${database} TO ${role};
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO ${role};
    GRANT SELECT ON augustus_schema_version,augustus_deployment,augustus_account_reviews TO ${role};
    GRANT SELECT,INSERT,UPDATE,DELETE ON augustus_accounts,augustus_agents,augustus_state,augustus_events,augustus_proposals,augustus_approvals,augustus_execution_locks,augustus_login_challenges,augustus_sessions,augustus_context,augustus_rate_limits,augustus_health_checks,augustus_worker_leases,augustus_execution_jobs,augustus_execution_operations,augustus_agent_nonces,augustus_protection_queue,augustus_protection_health TO ${role};
    GRANT USAGE,SELECT ON SEQUENCE augustus_events_id_seq,augustus_context_id_seq TO ${role};
    COMMIT;`);
  const scope = (await adminPool.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];
  check(scope.scope === 'production:augustus-v1' && scope.environment === 'production', 'Deployment scope mismatch');
  step = 'runtime authentication and RLS catalog';
  runtimePool = poolFor(runtime.toString(), 2);
  const flags = (await runtimePool.query('SELECT current_user AS role,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  check(flags.role === role && !flags.rolsuper && !flags.rolbypassrls && !flags.rolcreatedb && !flags.rolcreaterole, 'Runtime role elevated');
  const inherited = await runtimePool.query("SELECT r.rolname FROM pg_roles r WHERE r.rolname IN ('neon_superuser',$1) AND pg_has_role(current_user,r.oid,'MEMBER')", [owner]);
  check(!inherited.rows.length, 'Runtime inherits privileged role');
  const tables = (await runtimePool.query('SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[])', ['public', tenantTables])).rows;
  check(tables.length === tenantTables.length && tables.every(r => r.relrowsecurity && r.relforcerowsecurity && r.owner !== role), 'Tenant RLS or ownership invalid');
  const privileges = (await runtimePool.query("SELECT has_schema_privilege(current_user,'public','CREATE') AS schema_create,has_database_privilege(current_user,current_database(),'CREATE') AS db_create,has_table_privilege(current_user,'augustus_deployment','INSERT,UPDATE,DELETE') AS binding_write,has_table_privilege(current_user,'augustus_account_reviews','INSERT,UPDATE,DELETE') AS review_write")).rows[0];
  check(Object.values(privileges).every(v => v === false), 'Runtime can alter protected control plane');
  report.runtimeRole = role; report.runtimeNonOwner = true; report.runtimeBypassRLS = false; report.forcedRLSTables = tables.length;
  const storeConfig = { stage: 'production', databaseScope: scope.scope, databaseUrl: runtime.toString() };
  const store = new HostedStore(storeConfig, runtimePool); await store.health();
  // Remove only this operator script's marked probes from an interrupted run.
  // Never scan or delete ordinary application state or audit events.
  const interrupted = (await adminPool.query("SELECT s.wallet,e.event->>'sentinel' AS sentinel FROM augustus_state s JOIN augustus_events e ON e.wallet=s.wallet WHERE s.payload->>'validationOnly'='true' AND e.event->>'action'='PERSISTENCE_PROBE'")).rows;
  for (const probe of interrupted) {
    check(/^0x[0-9a-f]{40}$/.test(probe.wallet) && /^[0-9a-f-]{36}$/.test(probe.sentinel), 'Interrupted probe identity invalid');
    await store.transaction(probe.wallet, async c => {
      await c.query("DELETE FROM augustus_events WHERE wallet=$1 AND event->>'action'='PERSISTENCE_PROBE' AND event->>'sentinel'=$2", [probe.wallet,probe.sentinel]);
      check((await c.query("DELETE FROM augustus_state WHERE wallet=$1 AND payload->>'validationOnly'='true' RETURNING wallet", [probe.wallet])).rows.length === 1, 'Probe cleanup state mismatch');
      await c.query('DELETE FROM augustus_accounts WHERE wallet=$1', [probe.wallet]);
      await c.query('DELETE FROM augustus_health_checks WHERE id=$1', [probe.sentinel]);
    });
  }
  report.interruptedProbesCleaned = interrupted.length;
  step = 'two-wallet isolation rollback probes';
  const a = '0x' + randomBytes(20).toString('hex'), b = '0x' + randomBytes(20).toString('hex');
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('augustus.wallet',$1,true)", [a]);
    await client.query('INSERT INTO augustus_accounts(wallet) VALUES($1)', [a]);
    await client.query('INSERT INTO augustus_agents(wallet,address,encrypted) VALUES($1,$2,$3)', [a, '0x' + randomBytes(20).toString('hex'), JSON.stringify({ validationOnly: true })]);
    await client.query('INSERT INTO augustus_state(wallet,payload) VALUES($1,$2)', [a, JSON.stringify({ validationOnly: true, session: { killed: true } })]);
    const pid = randomUUID(), eid = randomUUID();
    await client.query('INSERT INTO augustus_proposals(wallet,proposal_id,binding_hash,payload,expires_at) VALUES($1,$2,$3,$4,now()+interval \'1 minute\')', [a,pid,'validation',JSON.stringify({ validationOnly: true })]);
    await client.query('INSERT INTO augustus_approvals(wallet,proposal_id,binding_hash) VALUES($1,$2,$3)', [a,pid,'validation']);
    await client.query('INSERT INTO augustus_execution_locks(wallet,execution_id,proposal_id) VALUES($1,$2,$3)', [a,eid,pid]);
    await client.query('INSERT INTO augustus_execution_jobs(wallet,execution_id,proposal_id,payload) VALUES($1,$2,$3,$4)', [a,eid,pid,JSON.stringify({ validationOnly: true })]);
    await client.query('INSERT INTO augustus_execution_operations(wallet,cloid,kind,nonce) VALUES($1,$2,$3,$4)', [a,'validation-' + randomUUID(),'entry',1]);
    await client.query('INSERT INTO augustus_agent_nonces(wallet,nonce) VALUES($1,1)', [a]);
    await client.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [a,JSON.stringify({ action: 'ISOLATION_PROBE', validationOnly: true })]);
    await client.query("SELECT set_config('augustus.wallet',$1,true)", [b]);
    const isolated = ['augustus_accounts','augustus_agents','augustus_state','augustus_proposals','augustus_approvals','augustus_execution_locks','augustus_events','augustus_execution_jobs','augustus_execution_operations','augustus_agent_nonces'];
    for (const table of isolated) check(Number((await client.query(`SELECT count(*) AS n FROM ${table} WHERE wallet=$1`, [a])).rows[0].n) === 0, 'Cross-wallet read possible');
    check((await client.query('UPDATE augustus_state SET payload=$2 WHERE wallet=$1 RETURNING wallet', [a,'{}'])).rows.length === 0, 'Cross-wallet update possible');
    await client.query('SAVEPOINT forbidden_write'); let blocked = false;
    try { await client.query('INSERT INTO augustus_accounts(wallet) VALUES($1)', [a]); } catch (error) { blocked = error.code === '42501'; }
    await client.query('ROLLBACK TO SAVEPOINT forbidden_write'); check(blocked, 'Cross-wallet insertion not rejected by RLS');
    await client.query('INSERT INTO augustus_accounts(wallet) VALUES($1)', [b]);
    await client.query("SELECT set_config('augustus.wallet',$1,true)", [a]);
    check(Number((await client.query('SELECT count(*) AS n FROM augustus_accounts WHERE wallet=$1', [b])).rows[0].n) === 0, 'Reverse wallet isolation failed');
    await client.query('ROLLBACK'); report.walletIsolation = true; report.agentIsolation = true; report.proposalIsolation = true; report.approvalIsolation = true; report.lockIsolation = true; report.executionStateIsolation = true;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  step = 'durable kill and audit reconnect probes';
  const probe = '0x' + randomBytes(20).toString('hex'), sentinel = randomUUID();
  metadata.pendingPersistenceProbe = { branch, wallet: probe, sentinel }; fs.writeFileSync(manifestPath, JSON.stringify(metadata, null, 2));
  try {
    await store.transaction(probe, async c => {
      await c.query('INSERT INTO augustus_accounts(wallet) VALUES($1)', [probe]);
      await c.query('INSERT INTO augustus_state(wallet,payload) VALUES($1,$2)', [probe, JSON.stringify({ validationOnly: true, session: { killed: true } })]);
      await c.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [probe, JSON.stringify({ action: 'PERSISTENCE_PROBE', sentinel })]);
      await c.query('INSERT INTO augustus_health_checks(id) VALUES($1)', [sentinel]);
    });
    if (restartCheck) {
      step = 'Neon compute restart';
      const output = execFileSync(process.execPath, [cli,'postgres','computes','list','--project-id',metadata.projectId,'--branch',branch,'-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 30000 });
      const data = JSON.parse(output), endpoints = Array.isArray(data) ? data : data.endpoints;
      const candidates = endpoints.filter(e => e.branch_id === branch && e.type === 'read_write');
      check(candidates.length === 1, 'Unique branch compute required');
      await runtimePool.end(); runtimePool = null; await adminPool.end(); adminPool = null;
      execFileSync(process.execPath, [cli,'postgres','computes','restart',candidates[0].id,'--project-id',metadata.projectId,'-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 90000 });
      runtimePool = poolFor(runtime.toString(), 2);
      adminPool = poolFor(operator.toString());
      report.restartedCompute = candidates[0].id;
    }
    // A separate pool authenticates again: no in-memory state can satisfy this check.
    const freshPool = poolFor(runtime.toString());
    try {
      const freshStore = new HostedStore(storeConfig, freshPool);
      await freshStore.transaction(probe, async c => {
        check((await c.query('SELECT payload FROM augustus_state WHERE wallet=$1', [probe])).rows[0]?.payload?.session?.killed === true, 'Kill state not durable');
        check((await c.query("SELECT event FROM augustus_events WHERE wallet=$1 AND event->>'sentinel'=$2", [probe,sentinel])).rows.length === 1, 'Audit event not durable');
        check((await c.query('SELECT id FROM augustus_health_checks WHERE id=$1', [sentinel])).rows.length === 1, 'Commit not durable');
      });
    } finally { await freshPool.end(); }
    report.reconnectPersistence = true; report.killSwitchPersistence = true; report.auditPersistence = true; if (restartCheck) report.computeRestartPersistence = true;
  } finally {
    if (!runtimePool) runtimePool = poolFor(runtime.toString());
    const cleanupStore = new HostedStore(storeConfig, runtimePool);
    await cleanupStore.transaction(probe, async c => { await c.query('DELETE FROM augustus_events WHERE wallet=$1', [probe]); await c.query('DELETE FROM augustus_state WHERE wallet=$1', [probe]); await c.query('DELETE FROM augustus_accounts WHERE wallet=$1', [probe]); await c.query('DELETE FROM augustus_health_checks WHERE id=$1', [sentinel]); });
    delete metadata.pendingPersistenceProbe; fs.writeFileSync(manifestPath, JSON.stringify(metadata, null, 2));
  }
  step = 'fail closed scope probe';
  const wrongScope = new HostedStore({ ...storeConfig, databaseScope: 'preview:wrong-scope' }, runtimePool);
  let rejected = false; try { await wrongScope.health(); } catch { rejected = true; } check(rejected, 'Wrong deployment scope not blocked');
  report.wrongScopeRejected = true;
  report.reviewedAccounts = Number((await adminPool.query('SELECT count(*) AS n FROM augustus_account_reviews WHERE allowed=true OR reviewed=true')).rows[0].n);
  report.activeExecutionJobs = Number((await adminPool.query('SELECT count(*) AS n FROM augustus_protection_queue WHERE active=true')).rows[0].n);
  check(report.reviewedAccounts === 0 && report.activeExecutionJobs === 0, 'Unexpected reviewed account or active execution job');
  report.probeCleanup = true; report.runtimeCredentialFile = credentialPath; report.status = 'PASS';
  if (production) metadata.productionDatabaseVerified = true; else metadata.validationPassed = true;
  metadata[production ? 'productionChecks' : 'validationChecks'] = report;
  fs.writeFileSync(manifestPath, JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  report.status = 'FAIL'; report.step = step; report.errorCode = /^[A-Z0-9_]{3,32}$/.test(error.code || '') ? error.code : 'CHECK_NOT_CONFIRMED';
  fs.writeFileSync(`work/augustus-neon-failure-${branch}.local`, JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report)); process.exitCode = 1;
} finally { await runtimePool?.end(); await adminPool?.end(); }
