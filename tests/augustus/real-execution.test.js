import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionRepository, approvalDigest } from '../../server/augustus/hosted/executionRepository.js';
import { ExecutionRunner } from '../../server/augustus/hosted/executionRunner.js';
import { createLiveExchange } from '../../server/augustus/hosted/liveExchange.js';
import { AgentVault } from '../../server/augustus/hosted/agentVault.js';
import { executionGate } from '../../server/augustus/hosted/config.js';
import { isExecutionClient } from '../../server/augustus/executionCapability.js';
import { MainnetAdapter } from '../../server/augustus/mainnetAdapter.js';
import { ProposalEngine } from '../../server/augustus/proposalEngine.js';
import { canonical } from '../../server/augustus/stableHash.js';
import { HostedRuntime } from '../../server/augustus/hosted/runtime.js';
const wallet = '0x' + '1'.repeat(40), agent = '0x' + '2'.repeat(40), tokenHash = 'a'.repeat(64);
const now = Date.now();
const context = () => ({ symbol: 'ETH', timestamp: now, agentState: 'LOCKED IN', marketBias: 'BULLISH', contextScore: 75, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.65 }, openInterest: 100, funding: 0, liquidationContext: { status: 'OBSERVING', observedSince: now - 100 }, squeezeState: 'NONE', transitionPressure: 'Low Delta Skew' });
function fixture() {
  const proposal = { proposalId: 'proposal-one', bindingHash: 'binding-one', symbol: 'ETH-PERP', side: 'LONG', orderType: 'IOC', asset: 1, szDecimals: 4, size: 0.01, notionalUsd: 20, estimatedEntry: 2000, stopLoss: 1950, takeProfit: null, leverage: 5, maxLossUsd: 1, costReserveUsd: 0.1, slippageReserveUsd: 0.1, emergencySlippageBps: 10, context: context(), createdAt: now, expiresAt: now + 10000, entryCloid: '0x' + '1'.repeat(32), stopCloid: '0x' + '2'.repeat(32), exitCloid: '0x' + '3'.repeat(32) };
  const risk = { maxNotionalUsd: 20, maxLossUsd: 1, maxLeverage: 5, direction: 'BOTH', sessionMinutes: 30 };
  return { wallet, agent, executionId: 'execution-one', proposal, risk, phase: 'FILLED', entrySent: true, managed: false, approvedAt: now - 1, engine: {}, protection: 'NOT_VERIFIED' };
}
test('reviewed account, expiry, production scope and healthy protection are all mandatory', () => {
  const config = { stage: 'production', liveRequested: true, releaseReviewed: true }, review = { reviewed: true, allowed: true, reviewId: 'operator-review', expiresAt: now + 10000 }, ready = { persistence: true, identity: true, mapping: true, protectionWorker: true, signerReady: true };
  assert.equal(executionGate(config, review, ready).executionEnabled, true);
  for (const field of ['persistence','identity','mapping','protectionWorker','signerReady']) assert.equal(executionGate(config, review, { ...ready, [field]: false }).executionEnabled, false);
  assert.equal(executionGate({ ...config, liveRequested: false }, review, ready).executionEnabled, false);
  assert.equal(executionGate({ ...config, stage: 'preview' }, review, ready).executionEnabled, false);
  assert.equal(executionGate(config, { ...review, expiresAt: now - 1 }, ready).executionEnabled, false);
});
function approvalFixture({ duplicate = false, locked = false, expired = false } = {}) {
  const f = fixture(), calls = [], repository = new ExecutionRepository({ config: { origin: 'https://test.example' }, clock: () => now });
  repository.gate = async () => ({ executionEnabled: true });
  const client = { async query(sql, args) { calls.push([sql, args]);
    if (sql.startsWith('SELECT wallet FROM augustus_sessions')) return { rows: [{ wallet }] };
    if (sql.startsWith('SELECT binding_hash')) return { rows: [{ binding_hash: f.proposal.bindingHash, invalidated: false, expires_at: new Date(expired ? now - 1 : now + 10000) }] };
    if (sql.startsWith('INSERT INTO augustus_approvals')) return { rows: duplicate ? [] : [{ proposal_id: f.proposal.proposalId }] };
    if (sql.startsWith('INSERT INTO augustus_execution_locks')) return { rows: locked ? [] : [{ execution_id: 'reserved' }] };
    return { rows: [] };
  } };
  const product = { session: { id: 'session', connected: true, armed: true, killed: false, entries: 0, expiresAt: now + 10000, risk: f.risk }, last: { proposal: f.proposal }, engine: { current: f.proposal, config: {}, result: {}, async validateProposalId(id) { assert.equal(id, f.proposal.proposalId); }, invalidate() {} }, emit() {}, save() {} };
  return { ...f, repository, client, product, calls, input: { approved: true, proposalId: f.proposal.proposalId, bindingHash: f.proposal.bindingHash } };
}
test('exact approved proposal reserves distinct CLOIDs, durable job and one-entry slot', async () => {
  const f = approvalFixture(), job = await f.repository.enqueue(f.client, wallet, f.product, f.input, agent, tokenHash);
  assert.equal(new Set([job.proposal.entryCloid, job.proposal.stopCloid, job.proposal.exitCloid]).size, 3);
  assert.equal(f.product.session.entries, 1); assert.equal(f.product.session.armed, false);
  assert.ok(f.calls.some(([sql]) => sql.startsWith('INSERT INTO augustus_execution_jobs')));
  assert.ok(f.calls.some(([sql]) => sql.startsWith('INSERT INTO augustus_protection_queue')));
});
for (const [name, opts, patch] of [ ['wrong proposal', {}, { proposalId: 'other' }], ['wrong binding', {}, { bindingHash: 'other' }], ['not approved', {}, { approved: false }], ['expired proposal', { expired: true }, {}], ['duplicate approval', { duplicate: true }, {}], ['duplicate execution', { locked: true }, {}] ]) {
  test(`approval fails closed: ${name}`, async () => { const f = approvalFixture(opts); await assert.rejects(f.repository.enqueue(f.client, wallet, f.product, { ...f.input, ...patch }, agent, tokenHash)); });
}
test('approval cannot be queued without authenticated session or with killed/disconnected state', async () => {
  const f = approvalFixture(); await assert.rejects(f.repository.enqueue(f.client, wallet, f.product, f.input, agent, null));
  for (const patch of [{ killed: true }, { connected: false }, { entries: 1 }]) { const r = approvalFixture(); Object.assign(r.product.session, patch); await assert.rejects(r.repository.enqueue(r.client, wallet, r.product, r.input, agent, tokenHash)); }
});
test('persisted approval linkage rejects wallet/agent/proposal substitution', async () => {
  const f = fixture(); f.approvalHash = approvalDigest({ wallet, agent, proposal: f.proposal, risk: f.risk });
  const c = { query: async () => ({ rows: [{ payload: f }] }) }, repo = new ExecutionRepository({});
  assert.equal((await repo.load(c, wallet, f.executionId)).wallet, wallet);
  f.agent = '0x' + '3'.repeat(40); await assert.rejects(repo.load(c, wallet, f.executionId));
});
test('JSONB key reordering preserves approval binding but content changes invalidate it', async () => {
  const f = fixture(); f.approvalHash = approvalDigest({ wallet, agent, proposal: f.proposal, risk: f.risk });
  const reordered = canonical(f), c = { query: async () => ({ rows: [{ payload: reordered }] }) }, repo = new ExecutionRepository({});
  assert.equal((await repo.load(c, wallet, f.executionId)).approvalHash, f.approvalHash);
  reordered.proposal.size *= 2; await assert.rejects(repo.load(c, wallet, f.executionId));
});
test('real SDK signs only scoped ETH actions using ephemeral test agent and mocked HTTP', async () => {
  const f = fixture(), config = { stage: 'production', databaseScope: 'production:test', keyId: 'test-only', key: Buffer.alloc(32, 4) }, vault = new AgentVault(config), record = vault.provision(wallet); f.agent = record.address;
  const seen = [], operations = new Set();
  const repository = { current: async () => f, beforeSend: async () => seen.push('gate'), ownedEntryOrders: async () => [71], reserveOperation: async (w, id, holder, op) => { assert.equal(w, wallet); if (operations.has(op.cloid)) throw Error('Duplicate'); operations.add(op.cloid); seen.push('commit'); return { nonce: now + operations.size }; } };
  const client = createLiveExchange({ wallet, record, vault, repository, job: f, holder: 'worker', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.hyperliquid.xyz/exchange'); const body = JSON.parse(init.body); assert.equal(body.action.type, 'order'); assert.equal(body.action.orders[0].a, 1); assert.ok(body.signature); assert.ok(body.expiresAfter); seen.push('HTTP');
    return { ok: true, json: async () => ({ status: 'ok', response: { type: 'order', data: { statuses: [{ resting: { oid: 71 } }] } } }) };
  } });
  assert.equal(isExecutionClient(client), true);
  const request = { grouping: 'na', orders: [{ a: 1, b: true, p: '2000', s: '0.01', r: false, c: f.proposal.entryCloid, t: { limit: { tif: 'Ioc' } } }] };
  await client.order(request); assert.deepEqual(seen, ['commit','gate','HTTP']);
  await assert.rejects(client.order(request));
  await assert.rejects(client.order({ ...request, orders: [{ ...request.orders[0], a: 0 }] }));
  await assert.rejects(client.cancel({ cancels: [{ a: 1, o: 999 }] }));
  await assert.rejects(client.assertManagedPosition({ szi: '0.005', entryPx: '2000' }));
  f.managed = true; f.fill = { size: 0.005, price: 2000 };
  await client.assertManagedPosition({ szi: '0.005', entryPx: '2000' });
  await assert.rejects(client.assertManagedPosition({ szi: '0.01', entryPx: '2000' }));
  await assert.rejects(client.assertManagedPosition({ szi: '0.005', entryPx: '2100' }));
  assert.equal(client.updateLeverage, undefined); assert.equal(client.usdSend, undefined);
  assert.throws(() => new MainnetAdapter({ master: wallet, agent, tenantScoped: true, executionClient: {} }));
});
function recoveryFixture({ stopFailure = false, restart = false, closeFailure = false, mismatch = false, killed = false } = {}) {
  let job = fixture(), protectedNow = restart, position = { coin: 'ETH', szi: '0.005', entryPx: '2000' };
  if (restart) Object.assign(job, { managed: true, phase: 'PROTECTED', fill: { size: 0.005, price: 2000, side: 'LONG', orderId: 71 } });
  job.killed = killed;
  const events = [], calls = [];
  const repository = { async mutate(w, id, holder, fn) { assert.equal(w, wallet); assert.equal(id, job.executionId); const result = await fn(job, { query: async () => ({ rows: [{ address: agent, encrypted: {} }] }) }); return result ?? job; }, async save(j, value, event) { if (event) events.push(event); } };
  const adapter = { read: async () => ({ positions: position ? [position] : [], orders: [], fills: [], market: { markPx: '2000' } }), info: async () => ({ status: 'order', order: { status: 'filled' } }), entry: async () => { throw Error('Restart must not replay entry'); }, reconcile: async () => { calls.push('reconcile'); if (mismatch) throw Error('Unowned exposure'); return { size: 0.005, price: 2000, side: 'LONG', orderId: 71 }; }, stopConfirmed: async () => { calls.push('verify'); return protectedNow; }, protect: async p => { calls.push('stop'); assert.equal(p.size, 0.005); assert.equal(p.reduceOnly, true); protectedNow = !stopFailure; }, cancelEntries: async () => { calls.push('cancel'); }, emergencyClose: async p => { calls.push('close'); assert.equal(p.reduceOnly, true); if (closeFailure) throw Error(); position = null; } };
  const runner = new ExecutionRunner({ repository, vault: { verifyMapping() {} }, context: async () => context(), adapterFactory: () => adapter, clientFactory: () => ({}) });
  return { runner, repository, adapter, events, calls, job, missingStop() { protectedNow = false; }, setClosed() { position = null; } };
}
test('partial fill protects actual size and requires independent readback before PROTECTED', async () => {
  const f = recoveryFixture(), result = await f.runner.run(wallet, f.job.executionId, 'worker');
  assert.equal(result.healthy, true); assert.equal(f.job.phase, 'PROTECTED'); assert.equal(f.job.actualSize, 0.005);
  assert.deepEqual(f.calls, ['reconcile','verify','stop','verify']);
});
test('successful stop response without verification triggers emergency reduce-only close', async () => {
  const f = recoveryFixture({ stopFailure: true }), result = await f.runner.run(wallet, f.job.executionId, 'worker');
  assert.equal(result.terminal, true); assert.equal(f.job.phase, 'CLOSED'); assert.ok(f.calls.includes('close'));
  assert.ok(f.events.includes('PROTECTION_FAILED')); assert.ok(f.events.includes('REDUCE_ONLY_CLOSE_CONFIRMED'));
});
test('worker restart discovers linked live position and verifies protection without entry replay', async () => {
  const f = recoveryFixture({ restart: true }); await f.runner.run(wallet, f.job.executionId, 'new-worker'); assert.equal(f.job.phase, 'PROTECTED'); assert.deepEqual(f.calls, ['verify']);
});
test('protection disappearing after restart triggers emergency close', async () => {
  const f = recoveryFixture({ restart: true }); f.missingStop(); await f.runner.run(wallet, f.job.executionId, 'new-worker'); assert.ok(f.calls.includes('close')); assert.equal(f.job.phase, 'CLOSED');
});
test('ambiguous emergency close remains FAILED and active for recovery, never PROTECTED', async () => {
  const f = recoveryFixture({ stopFailure: true, closeFailure: true }); const result = await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(result.healthy, false); assert.equal(result.terminal, false); assert.equal(f.job.phase, 'EXIT_UNCERTAIN'); assert.equal(f.job.protection, 'FAILED');
});
test('kill survives worker restart and preserves a verified live stop', async () => {
  const f = recoveryFixture({ restart: true, killed: true }); await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(f.job.killed, true); assert.equal(f.job.phase, 'PROTECTED'); assert.equal(f.calls.includes('close'), false);
});
test('explicit managed manual close uses reduce-only and confirms flat state', async () => {
  const f = recoveryFixture({ restart: true }); f.job.closeRequested = true; await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(f.job.phase, 'CLOSED'); assert.ok(f.events.includes('MANUAL_CLOSE')); assert.ok(f.calls.includes('close'));
});
test('unattributed position is not adopted or closed as an Augustus position', async () => {
  const f = recoveryFixture({ mismatch: true }); const result = await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(result.healthy, false); assert.equal(f.calls.includes('close'), false); assert.equal(f.job.managed, false);
});
test('one flat snapshot cannot retire an execution that may still settle', async () => {
  const f = recoveryFixture({ restart: true }); f.setClosed();
  const first = await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(first.terminal, false); assert.equal(f.job.phase, 'SETTLEMENT_PENDING');
  f.job.flatObservedAt = Date.now() - 3000;
  const second = await f.runner.run(wallet, f.job.executionId, 'worker'); assert.equal(second.terminal, true); assert.equal(f.job.phase, 'CLOSED');
});
test('readback exception attempts emergency close rather than leaving a claimed protected position', async () => {
  const f = recoveryFixture({ restart: true }); f.adapter.stopConfirmed = async () => { throw Error('Connection failure'); };
  const result = await f.runner.run(wallet, f.job.executionId, 'worker'); assert.ok(f.calls.includes('close')); assert.equal(result.terminal, true); assert.equal(f.job.protection, 'FLAT');
});
test('complete real SDK path: exact proposal revalidation, IOC partial fill, actual-size stop and independent verification', async () => {
  const config = { stage: 'production', databaseScope: 'production:test', keyId: 'test-only', key: Buffer.alloc(32, 5) }, vault = new AgentVault(config), record = vault.provision(wallet); record.address = record.address.toLowerCase();
  const state = { positions: [], orders: [], fills: [], writes: [] }, market = { name: 'ETH', szDecimals: 4, maxLeverage: 25 };
  const fetchImpl = async (url, init) => {
    const req = JSON.parse(init.body);
    if (url.endsWith('/exchange')) {
      assert.ok(req.signature); assert.equal(req.action.type, 'order'); const o = req.action.orders[0]; state.writes.push(o);
      if (!o.r) { state.positions = [{ position: { coin: 'ETH', szi: '0.005', entryPx: '2000' } }]; state.fills = [{ coin: 'ETH', oid: 71, tid: 1, px: '2000', sz: '0.005', side: 'B', time: now }]; }
      else { assert.equal(o.s, '0.005'); assert.equal(o.t.trigger.tpsl, 'sl'); state.orders = [{ coin: 'ETH', oid: 72, cloid: o.c, side: 'A', reduceOnly: true, isTrigger: true, triggerPx: o.t.trigger.triggerPx, sz: o.s, orderType: 'Stop Market' }]; }
      return { ok: true, json: async () => ({ status: 'ok', response: { type: 'order', data: { statuses: [o.r ? { resting: { oid: 72 } } : { filled: { oid: 71, totalSz: '0.005', avgPx: '2000' } }] } } }) };
    }
    assert.equal(url, 'https://api.hyperliquid.xyz/info'); let value;
    switch (req.type) {
      case 'metaAndAssetCtxs': value = [{ universe: [{ name: 'BTC' }, market] }, [{ markPx: '50000' }, { markPx: '2000' }]]; break;
      case 'clearinghouseState': value = { marginSummary: { accountValue: '7.8', totalMarginUsed: '0' }, withdrawable: '7.8', assetPositions: state.positions }; break;
      case 'frontendOpenOrders': value = state.orders; break;
      case 'userFills': value = state.fills; break;
      case 'extraAgents': value = [{ address: record.address, validUntil: now + 100000 }]; break;
      case 'userAbstraction': value = 'disabled'; break;
      case 'spotClearinghouseState': value = { balances: [], tokenToAvailableAfterMaintenance: [[0, '0']] }; break;
      case 'activeAssetData': value = { user: wallet, coin: 'ETH', leverage: { type: 'cross', value: 5 }, availableToTrade: ['7.8','7.8'] }; break;
      case 'orderStatus': value = { status: 'order', order: { status: 'filled', order: { oid: 71, coin: 'ETH' } } }; break;
      default: throw Error('Unexpected test request');
    }
    return { ok: true, json: async () => structuredClone(value) };
  };
  const adapterFactory = options => new MainnetAdapter({ ...options, clock: () => now, fetchImpl });
  const reader = adapterFactory({ master: wallet, agent: record.address, tenantScoped: true }), engine = new ProposalEngine({ adapter: reader, feed: { read: async () => context() }, clock: () => now });
  engine.configure({ MAX_NOTIONAL_USD: 20, MAX_LOSS_USD: 1, notionalUsd: 20, leverage: 5, stopLoss: 1950, maxLossUsd: 1, costReserveUsd: 0.1, slippageReserveUsd: 0.1, emergencySlippageBps: 10 });
  const eligible = await engine.evaluate(); assert.equal(eligible.decision, 'ELIGIBLE PROPOSAL', eligible.reasons.join(';'));
  const job = { ...fixture(), agent: record.address, phase: 'QUEUED', entrySent: false, proposal: { ...eligible.proposal, entryCloid: fixture().proposal.entryCloid, stopCloid: fixture().proposal.stopCloid, exitCloid: fixture().proposal.exitCloid }, engine: canonical({ config: engine.config, current: engine.current, result: engine.result }) };
  const operations = new Set(), events = [];
  const repository = { async mutate(w, id, holder, fn) { assert.equal(w, wallet); const result = await fn(job, { query: async () => ({ rows: [record] }) }); return result ?? job; }, async save(j, value, event) { if (event) events.push(event); }, current: async () => job, beforeSend: async () => true, async reserveOperation(w, id, holder, op) { assert.equal(w, wallet); assert.equal(operations.has(op.cloid), false); operations.add(op.cloid); if (op.kind === 'entry') { job.entrySent = true; job.phase = 'ENTRY_UNCERTAIN'; } return { nonce: now + operations.size }; } };
  const runner = new ExecutionRunner({ repository, vault, context: async () => context(), clock: () => now, adapterFactory, clientFactory: opts => createLiveExchange({ ...opts, fetchImpl, clock: () => now }) });
  const result = await runner.run(wallet, job.executionId, 'worker');
  assert.equal(result.healthy, true); assert.equal(job.phase, 'PROTECTED'); assert.equal(job.fill.size, 0.005);
  assert.equal(state.writes.length, 2); assert.equal(state.writes[0].r, false); assert.equal(state.writes[1].r, true); assert.equal(state.writes[1].s, '0.005');
  await runner.run(wallet, job.executionId, 'worker-after-restart'); assert.equal(state.writes.length, 2);
  assert.ok(events.includes('FINAL_REVALIDATION_PASSED')); assert.ok(events.includes('STOP_INDEPENDENTLY_VERIFIED'));
});
function durableFixture() {
  const job = fixture(); Object.assign(job, { phase: 'ENTRY_VALIDATED', entrySent: false, sessionId: 'session', identitySessionHash: tokenHash });
  job.approvalHash = approvalDigest({ wallet, agent, proposal: job.proposal, risk: job.risk });
  let db = { job, operations: [], nonce: now, sessionValid: true, healthy: true, allowed: true, context: context(), state: { session: { id: 'session', entries: 1, connected: true, killed: false, risk: job.risk, expiresAt: now + 10000, heartbeatAt: now } } }, failCommit = false;
  const store = { async transaction(owner, fn) {
    assert.equal(owner, wallet); const next = structuredClone(db);
    const result = await fn({ async query(sql, args) {
      if (sql.startsWith('UPDATE augustus_protection_queue')) return { rows: args[2] === 'worker' ? [{ wallet }] : [] };
      if (sql.startsWith('SELECT payload FROM augustus_execution_jobs')) return { rows: [{ payload: next.job }] };
      if (sql.startsWith('SELECT execution_id')) return { rows: [{ execution_id: next.job.executionId }] };
      if (sql.startsWith('SELECT allowed,reviewed')) return { rows: [{ allowed: next.allowed, reviewed: true, review_id: 'review', expires_at: new Date(now + 10000) }] };
      if (sql.startsWith('SELECT healthy')) return { rows: [{ healthy: next.healthy, observed_at: new Date(now) }] };
      if (sql.startsWith('INSERT INTO augustus_agent_nonces')) return { rows: [{ nonce: ++next.nonce }] };
      if (sql.startsWith('INSERT INTO augustus_execution_operations')) { if (next.operations.includes(args[1])) throw Error('unique violation'); next.operations.push(args[1]); }
      if (sql.startsWith('UPDATE augustus_execution_jobs')) next.job = JSON.parse(args[2]);
      if (sql.startsWith('SELECT wallet FROM augustus_sessions')) return { rows: next.sessionValid ? [{ wallet }] : [] };
      if (sql.startsWith('SELECT payload FROM augustus_state')) return { rows: [{ payload: next.state }] };
      if (sql.startsWith('SELECT payload,worker_healthy')) return { rows: [{ payload: next.context, worker_healthy: true, observed_at: new Date(now) }] };
      return { rows: [] };
    } });
    if (failCommit) throw Error('Commit not acknowledged'); db = next; return structuredClone(result);
  } };
  return { repository: new ExecutionRepository({ store, config: { stage: 'production', origin: 'https://test.example', liveRequested: true, releaseReviewed: true }, clock: () => now }), get: () => db, commitFails() { failCommit = true; } };
}
test('durable write intent consumes entry before signing and duplicate execution cannot replay', async () => {
  const f = durableFixture(); const result = await f.repository.reserveOperation(wallet, 'execution-one', 'worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid });
  assert.ok(Number.isSafeInteger(result.nonce)); assert.equal(f.get().job.entrySent, true); assert.equal(f.get().operations.length, 1);
  await assert.rejects(f.repository.reserveOperation(wallet, 'execution-one', 'worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid }));
  assert.equal(f.get().operations.length, 1);
});
test('unconfirmed commit prevents signer invocation and any HTTP submission', async () => {
  const f = durableFixture(); f.commitFails(); let signerCalls = 0, httpCalls = 0;
  const client = createLiveExchange({ wallet, record: {}, vault: { async withSigner() { signerCalls++; } }, repository: f.repository, job: f.get().job, holder: 'worker', fetchImpl: async () => { httpCalls++; } });
  // current() also requires an acknowledged commit; neither boundary can return
  // a successful result after the simulated connection loses COMMIT.
  await assert.rejects(client.order({ grouping: 'na', orders: [{ a: 1, b: true, p: '2000', s: '0.01', r: false, c: f.get().job.proposal.entryCloid, t: { limit: { tif: 'Ioc' } } }] }));
  assert.equal(signerCalls, 0); assert.equal(httpCalls, 0); assert.equal(f.get().job.entrySent, false);
});
test('lost lease and unhealthy protection worker both block entry reservation', async () => {
  const f = durableFixture(); await assert.rejects(f.repository.reserveOperation(wallet, 'execution-one', 'other-worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid }));
  f.get().healthy = false; await assert.rejects(f.repository.reserveOperation(wallet, 'execution-one', 'worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid })); assert.equal(f.get().operations.length, 0);
});
test('final transmission rejects revoked identity, changed risk, disconnected or killed session', async () => {
  for (const change of [d => { d.sessionValid = false; }, d => { d.state.session.risk.maxLossUsd = 2; }, d => { d.state.session.connected = false; }, d => { d.job.killed = true; }, d => { d.allowed = false; }]) {
    const f = durableFixture(); await f.repository.reserveOperation(wallet, 'execution-one', 'worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid }); change(f.get());
    await assert.rejects(f.repository.beforeSend(wallet, 'execution-one', 'worker', 'entry'));
  }
});
test('final transmission rejects stale context and a materially changed eligible setup', async () => {
  for (const change of [c => { c.timestamp = now - 10001; }, c => { c.contextScore = 30; }, c => { c.contextScore = 76; }]) {
    const f = durableFixture(); await f.repository.reserveOperation(wallet, 'execution-one', 'worker', { kind: 'entry', cloid: f.get().job.proposal.entryCloid }); change(f.get().context);
    await assert.rejects(f.repository.beforeSend(wallet, 'execution-one', 'worker', 'entry'));
  }
});
test('kill is durable and close requires exact execution ID, ownership and confirmation', async () => {
  const f = durableFixture();
  await f.repository.store.transaction(wallet, c => f.repository.control(c, wallet, 'kill'));
  assert.equal(f.get().job.killed, true);
  await assert.rejects(f.repository.store.transaction(wallet, c => f.repository.control(c, wallet, 'close', { confirmed: true, executionId: 'other' })));
  f.get().job.managed = true;
  await assert.rejects(f.repository.store.transaction(wallet, c => f.repository.control(c, wallet, 'close', { confirmed: false, executionId: 'execution-one' })));
  await f.repository.store.transaction(wallet, c => f.repository.control(c, wallet, 'close', { confirmed: true, executionId: 'execution-one' }));
  assert.equal(f.get().job.closeRequested, true);
});
test('hosted KILL commits intent without market/context reads, even during API outage', async () => {
  const queries = [], saved = { session: { id: 'session', connected: true, armed: true, killed: false, entries: 0, risk: fixture().risk } };
  const store = { transaction: async (owner, fn) => { assert.equal(owner, wallet); const result = await fn({ async query(sql, args) {
    queries.push([sql, args]);
    if (sql.startsWith('SELECT address,encrypted')) return { rows: [{ address: agent, encrypted: {} }] };
    if (sql.startsWith('SELECT payload FROM augustus_state')) return { rows: [{ payload: saved }] };
    if (sql.startsWith('SELECT event')) return { rows: [] };
    return { rows: [] };
  } }); queries.push(['COMMIT']); return result; } };
  const runtime = new HostedRuntime({ store, vault: { verifyMapping() {} }, config: {}, adapterFactory: () => ({ master: wallet, agent, read() { throw Error('Market unavailable'); } }) });
  const result = await runtime.tenant(wallet, 'kill'); assert.equal(result.killed, true); assert.equal(result.armed, false); assert.equal(queries.at(-1)[0], 'COMMIT');
  const written = queries.find(([sql]) => sql.startsWith('INSERT INTO augustus_state'));
  assert.equal(JSON.parse(written[1][1]).session.killed, true);
});

