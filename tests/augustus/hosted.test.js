import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedConfig, executionGate } from '../../server/augustus/hosted/config.js';
import { AgentVault } from '../../server/augustus/hosted/agentVault.js';
import { HostedStore } from '../../server/augustus/hosted/store.js';
import { publicData } from '../../server/augustus/hosted/runtime.js';
import { HostedAuth } from '../../server/augustus/hosted/auth.js';
import handler from '../../api/augustus.js';
const wallet = '0x' + '1'.repeat(40), other = '0x' + '2'.repeat(40);
const env = () => ({ AUGUSTUS_ENV: 'production', VERCEL_ENV: 'production', AUGUSTUS_ORIGIN: 'https://example.com', DATABASE_URL: 'postgresql://test:test@ep-test.neon.tech/test?sslmode=require', AGENT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString('base64'), AGENT_ENCRYPTION_KEY_ID: 'test-v1', AUGUSTUS_DATABASE_SCOPE: 'production:test', CRON_SECRET: 'x'.repeat(32), LIVE_EXECUTION: 'false' });
test('hosted configuration rejects missing configuration without echoing values', () => {
  assert.throws(() => hostedConfig({ DATABASE_URL: 'secret-value' }), e => !e.message.includes('secret-value'));
});
for (const [name, patch] of Object.entries({ previewExecution: { AUGUSTUS_ENV: 'preview', VERCEL_ENV: 'preview', LIVE_EXECUTION: 'true', AUGUSTUS_DATABASE_SCOPE: 'preview:test' }, wrongScope: { AUGUSTUS_DATABASE_SCOPE: 'preview:test' }, wrongEnvironment: { VERCEL_ENV: 'preview' }, insecureOrigin: { AUGUSTUS_ORIGIN: 'http://example.com' }, insecureDatabase: { DATABASE_URL: 'postgresql://test:test@ep-test.neon.tech/test' }, disabledTls: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } })) {
  test(`hosted configuration rejects ${name}`, () => assert.throws(() => hostedConfig({ ...env(), ...patch })));
}
test('execution gate defaults disabled and cannot arm without signer and protection recovery', () => {
  const config = hostedConfig(env());
  assert.equal(executionGate(config, null, {}).executionEnabled, false);
  const review = { reviewed: true, allowed: true, reviewId: 'review', expiresAt: Date.now() + 10000 };
  assert.equal(executionGate({ ...config, liveRequested: true, releaseReviewed: true }, review, { persistence: true, identity: true, mapping: true }).executionEnabled, false);
});
test('each user receives a unique encrypted agent and public response excludes ciphertext', () => {
  const vault = new AgentVault(hostedConfig(env())), a = vault.provision(wallet), b = vault.provision(other);
  assert.notEqual(a.address, b.address); assert.equal(vault.verifyMapping(wallet, a), true);
  assert.deepEqual(vault.publicRecord(a), { address: a.address });
  assert.deepEqual(publicData({ agent: a, privateKey: 'never', nested: { signature: 'never', safe: true } }), { agent: { address: a.address }, nested: { safe: true } });
});
test('agent ciphertext cannot be swapped across wallet, environment or key version', () => {
  const config = hostedConfig(env()), vault = new AgentVault(config), record = vault.provision(wallet);
  assert.throws(() => vault.verifyMapping(other, record));
  assert.throws(() => new AgentVault({ ...config, stage: 'preview' }).verifyMapping(wallet, record));
  assert.throws(() => new AgentVault({ ...config, keyId: 'other-version' }).verifyMapping(wallet, record));
});
function pool({ failCommit = false, mismatch = false } = {}) {
  const calls = [];
  return { calls, connect: async () => ({ release() { calls.push(['release']); }, async query(sql, args) {
    calls.push([sql, args]); if (sql === 'COMMIT' && failCommit) throw Error('sensitive database detail');
    return { rows: sql.includes('SELECT scope') ? [{ scope: mismatch ? 'preview:other' : 'production:test', environment: 'production' }] : [] };
  } }) };
}
test('tenant transaction binds wallet and scope and waits for confirmed commit', async () => {
  const p = pool(), store = new HostedStore(hostedConfig(env()), p);
  assert.equal(await store.transaction(wallet, async () => 'persisted'), 'persisted');
  assert.ok(p.calls.some(([sql, args]) => sql.includes('set_config') && args[0] === wallet));
  assert.equal(p.calls.at(-2)[0], 'COMMIT'); assert.equal(p.calls.at(-1)[0], 'release');
});
test('ambiguous COMMIT fails closed, rolls back and suppresses database details', async () => {
  const p = pool({ failCommit: true }), store = new HostedStore(hostedConfig(env()), p);
  await assert.rejects(store.transaction(wallet, async () => 'must not return'), e => /unconfirmed/.test(e.message) && !e.message.includes('sensitive'));
  assert.ok(p.calls.some(([sql]) => sql === 'ROLLBACK'));
});
test('wrong database environment blocks callback and no memory fallback occurs', async () => {
  let called = false; const store = new HostedStore(hostedConfig(env()), pool({ mismatch: true }));
  await assert.rejects(store.transaction(wallet, async () => { called = true; })); assert.equal(called, false);
});
test('hosted wallet proof is single use and sessions are bound to identity and CSRF', async () => {
  const challenges = new Map(), agents = new Map(), sessions = new Map(), config = hostedConfig(env());
  const store = { transaction: async (owner, fn) => fn({ async query(sql, args) {
    if (sql.startsWith('INSERT INTO augustus_login_challenges')) challenges.set(args[0], { wallet: args[1], message: args[2], expires_at: args[3] });
    if (sql.startsWith('DELETE FROM augustus_login_challenges')) { const row = challenges.get(args[0]); challenges.delete(args[0]); return { rows: row ? [row] : [] }; }
    if (sql.startsWith('SELECT address,encrypted')) return { rows: agents.has(owner) ? [agents.get(owner)] : [] };
    if (sql.startsWith('INSERT INTO augustus_agents')) agents.set(args[0], { address: args[1], encrypted: JSON.parse(args[2]) });
    if (sql.startsWith('INSERT INTO augustus_sessions')) sessions.set(args[0], { wallet: args[1], csrf_hash: args[2], origin: args[3], expires_at: args[4] });
    if (sql.startsWith('SELECT wallet,csrf_hash')) return { rows: sessions.has(args[0]) ? [sessions.get(args[0])] : [] };
    return { rows: [] };
  } }) };
  const auth = new HostedAuth({ store, vault: new AgentVault(config), config, verify: async () => true });
  const challenge = await auth.challenge(wallet), proof = { ...challenge, address: wallet, signature: '0x' + '1'.repeat(130) };
  const first = await auth.authenticate(proof, 'csrf-one');
  await assert.rejects(auth.authenticate(proof, 'csrf-one'));
  assert.equal(await auth.session(first.token, 'csrf-one'), wallet);
  await assert.rejects(auth.session(first.token, 'csrf-two'));
  const second = await auth.authenticate({ ...await auth.challenge(other), address: other, signature: proof.signature }, 'csrf-two');
  assert.equal(await auth.session(second.token, 'csrf-two'), other);
  assert.notEqual(first.agentAddress, second.agentAddress);
  const returning = await auth.authenticate({ ...await auth.challenge(wallet), address: wallet, signature: proof.signature }, 'csrf-three');
  assert.equal(returning.agentAddress, first.agentAddress);
  assert.equal(await auth.session(returning.token, 'csrf-three'), wallet);
  assert.equal(agents.size, 2);
});
test('public diagnostics denied before any database or secret configuration', async () => {
  let body; const headers = {};
  const res = { setHeader(k, v) { headers[k] = v; }, end(value) { body = JSON.parse(value); } };
  await handler({ query: { route: 'diagnostics' } }, res);
  assert.equal(res.statusCode, 403); assert.match(body.error, /not public/); assert.equal(headers['Cache-Control'], 'no-store');
});
