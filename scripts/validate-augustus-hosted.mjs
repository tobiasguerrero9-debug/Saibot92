// Identity-only hosted validation. Never calls authorization, execute or close.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Pool, neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = globalThis.WebSocket;
const origin = 'https://www.saibot92.auction', users = [], report = { liveExecution: false };
let stage = 'bootstrap', pool;
const fatal = () => { console.error(JSON.stringify({ status: 'FAIL', stage, secretDetailsOmitted: true })); process.exit(1); };
process.on('uncaughtException', fatal); process.on('unhandledRejection', fatal);
function cookies(user, response) { for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], at = pair.indexOf('='); user.cookies[pair.slice(0,at)] = pair.slice(at+1); } }
async function call(user, route, body) {
  const response = await fetch(origin + '/api/augustus-product/' + route, { method: body ? 'POST' : 'GET', headers: { Cookie: Object.entries(user.cookies).map(([k,v]) => k+'='+v).join('; '), ...(body ? { Origin: origin, 'Content-Type': 'application/json', 'X-Augustus-Canary-CSRF': user.csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  cookies(user,response); const data = await response.json(); if (!response.ok) { const error = Error('Hosted request rejected'); error.httpStatus = response.status; throw error; } return { data, response };
}
const check = (value) => { if (!value) throw Error('Hosted assertion failed'); };
try {
  for (const index of [0,1]) {
    const account = privateKeyToAccount(generatePrivateKey()), user = { account, address: account.address.toLowerCase(), cookies: {} }; users.push(user);
    stage = 'wallet ' + (index+1) + ' bootstrap';
    const bootstrap = await call(user,'bootstrap'); user.csrf = bootstrap.data.csrf; check(bootstrap.data.executionEnabled === false && bootstrap.data.environment === 'production');
    check(bootstrap.response.headers.getSetCookie().every(v => /HttpOnly/i.test(v) && /Secure/i.test(v) && /SameSite=Strict/i.test(v)));
    stage = 'wallet ' + (index+1) + ' identity challenge';
    const challenge = (await call(user,'challenge',{ address: user.address })).data;
    check(challenge.message.includes(origin) && challenge.message.includes('Identity only.') && challenge.message.includes(user.address));
    const signature = await account.signMessage({ message: challenge.message });
    stage = 'wallet ' + (index+1) + ' identity session';
    const session = (await call(user,'session',{ address: user.address, ...challenge, signature })).data; check(session.address.toLowerCase() === user.address);
    user.agent = session.agentAddress;
    stage = 'wallet ' + (index+1) + ' risk persistence';
    const risk = { maxNotionalUsd: index ? 30 : 20, maxLossUsd: index ? 2 : 1, maxLeverage: 5, direction: 'BOTH', sessionMinutes: 30 };
    await call(user,'risk',risk);
    const status = (await call(user,'status')).data;
    check(status.account.master.toLowerCase() === user.address && status.account.agent.toLowerCase() === user.agent.toLowerCase() && status.risk.maxNotionalUsd === risk.maxNotionalUsd && status.executionEnabled === false && status.canApprove === false);
    user.risk = risk; report['wallet'+(index+1)] = { identitySignIn: true, accountMapping: true, riskPersistence: true, executionDisabled: true };
  }
  stage = 'two-user session and agent isolation';
  check(users[0].agent.toLowerCase() !== users[1].agent.toLowerCase());
  for (const user of users) { const status = (await call(user,'status')).data; check(status.risk.maxNotionalUsd === user.risk.maxNotionalUsd && status.account.master.toLowerCase() === user.address); }
  report.sessionIsolation = true; report.agentIsolation = true; report.riskIsolation = true;
  stage = 'session revocation';
  await call(users[0],'disconnect',{});
  let revoked = false; try { await call(users[0],'status'); } catch(error) { revoked = error.httpStatus === 401; } check(revoked);
  check((await call(users[1],'status')).data.account.master.toLowerCase() === users[1].address); report.disconnectIsolation = true;
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.stage = stage; report.httpStatus = error.httpStatus || null; }
finally {
  // Delete only the two generated test identities. Never touch developer users.
  if (users.length) {
    try {
      const meta = JSON.parse(fs.readFileSync('work/augustus-production-provisioning.local','utf8'));
      const code = '$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))}finally{[Array]::Clear($p,0,$p.Length)}';
      const url = execFileSync(process.env.OPERATOR_PWSH, ['-NoLogo','-NoProfile','-NonInteractive','-Command',code], { input: fs.readFileSync(meta.productionChecks.runtimeCredentialFile,'utf8'), encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
      pool = new Pool({ connectionString: url, max: 1 }); pool.on('error',()=>{});
      for (const user of users) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN'); await client.query("SELECT set_config('augustus.wallet',$1,true)",[user.address]);
          check(!(await client.query('SELECT wallet FROM augustus_account_reviews WHERE wallet=$1',[user.address])).rows.length);
          for (const table of ['augustus_sessions','augustus_login_challenges','augustus_protection_queue','augustus_execution_operations','augustus_execution_jobs','augustus_execution_locks','augustus_approvals','augustus_proposals','augustus_events','augustus_state','augustus_agent_nonces','augustus_agents','augustus_accounts']) await client.query(`DELETE FROM ${table} WHERE wallet=$1`,[user.address]);
          await client.query('COMMIT');
        } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; } finally { client.release(); }
      }
      report.testIdentitiesCleaned = true;
    } catch { report.testIdentitiesCleaned = false; report.status = 'FAIL'; }
  }
  await pool?.end();
  fs.writeFileSync('work/augustus-hosted-validation.local',JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
  if (report.status !== 'PASS') process.exitCode = 1;
}
