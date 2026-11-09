// Operator task: configure the existing Vercel project, never submit an order.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const project = 'prj_CgqlwSu2M7VaQLonQnQsnCV0WmOg', team = 'team_iyzIUl5FP3dXwosN8X6npsLh';
const manifest = JSON.parse(fs.readFileSync('work/augustus-production-provisioning.local','utf8'));
let phase = 'configuration preflight';
const fail = () => { console.error(JSON.stringify({ status: 'FAIL', phase, secretsLogged: false })); process.exit(1); };
process.on('uncaughtException', fail); process.on('unhandledRejection', fail);
function protect(value, decrypt) {
  const code = decrypt
    ? '$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))}finally{[Array]::Clear($p,0,$p.Length)}'
    : '$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());try{$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p))}finally{[Array]::Clear($b,0,$b.Length)}';
  return execFileSync(process.env.OPERATOR_PWSH, ['-NoLogo','-NoProfile','-NonInteractive','-Command',code], { input: value, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 15000 }).trim();
}
try {
  if (!manifest.productionDatabaseVerified || manifest.productionChecks.status !== 'PASS' || manifest.productionChecks.activeExecutionJobs !== 0 || manifest.productionChecks.reviewedAccounts !== 0) throw Error();
  const { token } = JSON.parse(fs.readFileSync('C:/Users/tobia/AppData/Roaming/com.vercel.cli/Data/auth.json','utf8'));
  async function api(route, method = 'GET', body) {
    const response = await fetch(`https://api.vercel.com${route}${route.includes('?') ? '&' : '?'}teamId=${team}`, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    const data = await response.json(); if (!response.ok) throw Error('Vercel request failed'); return data;
  }
  const details = await api('/v9/projects/' + project);
  if (details.id !== project || details.name !== 'saibot92') throw Error();
  const existing = (await api('/v9/projects/' + project + '/env')).envs || [];
  const runtimeUrl = protect(fs.readFileSync(manifest.productionChecks.runtimeCredentialFile,'utf8'), true);
  const parsed = new URL(runtimeUrl);
  if (parsed.username !== 'augustus_production_runtime' || !parsed.hostname.includes('-pooler.') || parsed.pathname !== '/augustus_production') throw Error();
  const backupPath = path.resolve('../work/augustus-production-secrets.local');
  let secrets;
  if (fs.existsSync(backupPath)) secrets = JSON.parse(protect(fs.readFileSync(backupPath,'utf8'), true));
  else {
    if (existing.some(e => ['AGENT_ENCRYPTION_KEY_BASE64','CRON_SECRET'].includes(e.key) && e.target?.includes('production'))) throw Error('Existing secrets must not be rotated');
    secrets = { AGENT_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'), CRON_SECRET: randomBytes(32).toString('hex') };
    fs.writeFileSync(backupPath, protect(JSON.stringify(secrets), false), { flag: 'wx' });
  }
  const values = { DATABASE_URL: runtimeUrl, AUGUSTUS_ENV: 'production', AUGUSTUS_ORIGIN: 'https://www.saibot92.auction', AUGUSTUS_DATABASE_SCOPE: 'production:augustus-v1', ...secrets, AGENT_ENCRYPTION_KEY_ID: 'production-agent-v1', LIVE_EXECUTION: 'false', AUGUSTUS_RELEASE_REVIEWED: 'false', AUGUSTUS_DIAGNOSTICS_ENABLED: 'false' };
  const secretNames = new Set(['DATABASE_URL','AGENT_ENCRYPTION_KEY_BASE64','CRON_SECRET']);
  const pending = Object.entries(values).filter(([key]) => !existing.some(e => e.key === key && e.target?.includes('production'))).map(([key,value]) => ({ key,value,type:secretNames.has(key)?'sensitive':'encrypted',visibility:secretNames.has(key)?'secret':'config',target:['production'],comment:'Augustus production; live execution disabled.' }));
  phase = 'Production variable creation';
  if (pending.length) await api('/v10/projects/' + project + '/env', 'POST', pending);
  const verified = (await api('/v9/projects/' + project + '/env')).envs || [];
  for (const key of Object.keys(values)) {
    const entry = verified.find(e => e.key === key && e.target?.includes('production'));
    if (!entry || (secretNames.has(key) && entry.type !== 'sensitive')) throw Error('Variable verification failed');
    if (secretNames.has(key) && entry.target.some(t => t !== 'production')) throw Error('Production secret shared with non-production');
  }
  if (verified.some(e => e.key === 'DATABASE_MIGRATION_URL')) throw Error('Migration credential must not be hosted');
  fs.mkdirSync('.vercel', { recursive: true });
  const link = { projectId: project, orgId: team, projectName: 'saibot92' };
  if (fs.existsSync('.vercel/project.json')) { const old = JSON.parse(fs.readFileSync('.vercel/project.json','utf8')); if (old.projectId !== project || old.orgId !== team) throw Error('Existing Vercel linkage mismatch'); }
  else fs.writeFileSync('.vercel/project.json',JSON.stringify(link,null,2));
  const result = { status: 'PASS', projectId: project, createdVariables: pending.map(e => e.key), productionVariables: Object.keys(values), secretVariables: [...secretNames], liveExecution: false, releaseReviewed: false, diagnosticsEnabled: false, migrationCredentialHosted: false, encryptionBackup: backupPath };
  fs.writeFileSync('work/augustus-vercel-configuration.local', JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch { fail(); }
