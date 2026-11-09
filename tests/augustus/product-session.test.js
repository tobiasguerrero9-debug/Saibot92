import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductSession, productState, validateProductRisk, riskEnvelope } from '../../server/augustus/productSession.js';
import { ProductAuth } from '../../server/augustus/productAuth.js';
import { MAINNET } from '../../server/augustus/mainnetCanary.js';
import { SessionAudit } from '../../server/augustus/sessionAudit.js';
const owner = MAINNET.master;
function fixture(t, { simulatedExecution = false } = {}) {
  let now = Date.now(); const dir = mkdtempSync(join(tmpdir(), 'augustus-product-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const audit = new SessionAudit(join(dir, 'session.local'));
  const context = { symbol: 'ETH', timestamp: now, agentState: 'OBSERVING', marketBias: 'MILD BULLISH', contextScore: 51, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.52 }, openInterest: 100, funding: 0, liquidationContext: { status: 'OBSERVING', observedSince: now - 1000 }, squeezeState: 'NO_SQUEEZE_CLASSIFICATION', transitionPressure: 'Low Delta Skew' };
  const state = { network: 'Mainnet', master: owner, agent: MAINNET.agent, executionEnabled: false, accountMode: 'unifiedAccount', accountModeSupported: true, collateralKnown: true, equity: 7.8, availableMargin: 7.8, marginMode: 'cross', currentLeverage: 5, positions: [], orders: [], accountAt: now, ordersAt: now, marketAt: now, modeAt: now, activeAssetAt: now, reconciled: true, uncertain: false, agentAuthorized: true, market: { name: 'ETH', asset: 1, maxLeverage: 25, szDecimals: 4, markPx: '2000' } };
  const risk = { maxNotionalUsd: 20, maxLeverage: 5, maxLossUsd: 1, direction: 'BOTH', sessionMinutes: 30 };
  let current = null, executes = 0, closes = 0, cancels = 0;
  const engine = { invalidate() { current = null; }, configure() {}, evaluate: async () => ({ decision: 'ELIGIBLE PROPOSAL', reasons: [], proposal: current ||= { proposalId: 'proposal-1', bindingHash: 'binding-1', expiresAt: now + 10000, side: 'LONG', context } }), validateProposalId: async id => { if (!current || id !== current.proposalId || now >= current.expiresAt) throw Error('Setup expired'); } };
  const adapter = { read: async () => structuredClone(state), stopConfirmed: async () => true };
  const feed = { read: async () => structuredClone(context) };
  const executor = simulatedExecution ? { network: 'SIMULATION', run: async () => { executes++; return { status: 'PROTECTED' }; }, emergencyClose: async p => { assert.equal(p.reduceOnly, true); closes++; }, cancelOwnedEntries: async () => { cancels++; } } : null;
  const session = new ProductSession({ adapter, feed, engine, audit, clock: () => now, executor });
  const ready = async () => { session.connect(owner); session.configure(owner, risk); await session.arm(owner); };
  return { session, risk, state, context, engine, adapter, feed, audit, executor, ready, clock: () => now, advance: ms => { now += ms; }, eligible: () => { context.agentState = 'LOCKED IN'; context.contextScore = 75; context.orderFlow.buyRatio = 0.65; }, counts: () => ({ executes, closes, cancels }) };
}
test('onboarding requires verified dedicated wallet, risk configuration and agent authorization', async t => {
  const f = fixture(t); assert.throws(() => f.session.connect(MAINNET.agent), /does not own/);
  await assert.rejects(f.session.arm(owner)); f.session.connect(owner); f.session.configure(owner, f.risk); f.state.agentAuthorized = false; await assert.rejects(f.session.arm(owner), /authorization/);
});
test('risk form rejects invalid limits, excessive leverage, invalid direction and unlimited sessions', () => {
  const base = { maxNotionalUsd: 20, maxLeverage: 5, maxLossUsd: 1, direction: 'BOTH' };
  for (const patch of [{ maxNotionalUsd: 0 }, { maxNotionalUsd: 9 }, { maxLossUsd: 0 }, { maxLossUsd: Infinity }, { maxLossUsd: 20 }, { maxLeverage: 6 }, { direction: 'AUTO' }, { sessionMinutes: 0 }]) assert.throws(() => validateProductRisk({ ...base, ...patch }));
  assert.equal(validateProductRisk(base).sessionMinutes, 60);
});
test('leverage above 5x, absent collateral, existing position and conflicting order prevent ARM', async t => {
  for (const patch of [{ currentLeverage: 20 }, { availableMargin: 0 }, { positions: [{ coin: 'ETH' }] }, { orders: [{}] }]) { const f = fixture(t); Object.assign(f.state, patch); await assert.rejects(f.ready()); assert.equal(f.session.session.armed, false); }
});
test('ARM does not trade; OBSERVING context stays NO SETUP', async t => {
  const f = fixture(t); await f.ready(); await f.session.tick(); const status = await f.session.status(owner); assert.equal(status.state, 'NO SETUP'); assert.equal(status.proposal, null); assert.equal(status.executionEnabled, false); assert.equal(f.counts().executes, 0); assert.ok(status.reasons.some(r => r.includes('70')));
});
test('risk-budget stops fit user loss envelope after tick rounding for both directions', async t => {
  const f = fixture(t);
  for (const side of ['LONG', 'SHORT']) { const p = riskEnvelope(f.risk, f.state, side); assert.ok(side === 'LONG' ? p.stopLoss < 2002 : p.stopLoss > 1998); assert.equal(p.takeProfit, null); assert.equal(p.MAX_LOSS_USD, 1); }
  assert.throws(() => riskEnvelope({ ...f.risk, maxLossUsd: 0.00001 }, f.state, 'LONG'));
});
test('eligible proposal waits for exact approval; live execution endpoint remains blocked', async t => {
  const f = fixture(t); await f.ready(); f.eligible(); await f.session.tick(); const status = await f.session.status(owner); assert.equal(status.state, 'AWAITING APPROVAL'); assert.equal(status.canApprove, false);
  await assert.rejects(f.session.execute(owner, { proposalId: 'wrong', approved: true }), /expired/);
  await assert.rejects(f.session.execute(owner, { proposalId: status.proposal.proposalId, approved: true }), /disabled/); assert.equal(f.session.session.entries, 0);
});
test('wrong direction never produces a hidden or visible proposal', async t => {
  const f = fixture(t); f.risk.direction = 'SHORT'; await f.ready(); f.eligible(); let evaluations = 0; f.engine.evaluate = async () => { evaluations++; throw Error('must not generate'); }; await f.session.tick(); assert.equal(evaluations, 0); assert.equal((await f.session.status(owner)).proposal, null);
});
test('rejection binds to setup ID and binding; stale setup displays expiry', async t => {
  const f = fixture(t); await f.ready(); f.eligible(); await f.session.tick(); f.session.reject(owner, 'proposal-1'); assert.equal((await f.session.status(owner)).proposal, null);
  await f.session.tick(); assert.equal((await f.session.status(owner)).proposal, null);
  const g = fixture(t); await g.ready(); g.eligible(); await g.session.tick(); g.advance(10001); assert.equal((await g.session.status(owner)).state, 'SETUP EXPIRED'); await assert.rejects(g.session.execute(owner, { proposalId: 'proposal-1', approved: true }));
});
test('duplicate approval and concurrent execution are blocked in sandbox only', async t => {
  const f = fixture(t, { simulatedExecution: true }); await f.ready(); f.eligible(); await f.session.tick();
  const first = f.session.execute(owner, { proposalId: 'proposal-1', approved: true }); await assert.rejects(f.session.execute(owner, { proposalId: 'proposal-1', approved: true })); await first;
  assert.equal(f.counts().executes, 1); await assert.rejects(f.session.execute(owner, { proposalId: 'proposal-1', approved: true }));
});
test('stop failure emergency-closes reduce-only and persists killed state in sandbox', async t => {
  const f = fixture(t, { simulatedExecution: true }); await f.ready(); f.eligible(); await f.session.tick(); f.executor.run = async () => ({ status: 'UNPROTECTED' }); await assert.rejects(f.session.execute(owner, { proposalId: 'proposal-1', approved: true }), /Emergency/); assert.equal(f.counts().closes, 1); assert.equal(f.session.session.killed, true);
});
test('kill blocks proposals, cancels owned entries and requires separate close confirmation', async t => {
  const f = fixture(t, { simulatedExecution: true }); await f.ready(); await f.session.kill(owner, false); assert.equal(f.counts().closes, 0); assert.equal(f.counts().cancels, 1); assert.equal((await f.session.status(owner)).state, 'KILL SWITCH'); await assert.rejects(f.session.arm(owner)); await f.session.kill(owner, true); assert.equal(f.counts().closes, 1);
});
test('restart persists stopped state and never automatically rearms', async t => {
  const f = fixture(t); await f.ready(); await f.session.kill(owner); const restart = new ProductSession({ adapter: f.adapter, feed: f.feed, engine: f.engine, audit: f.audit, clock: f.clock }); assert.equal(restart.session.killed, true); assert.equal(restart.session.armed, false); assert.equal(restart.session.connected, false);
});
test('wallet disconnect, browser heartbeat loss and session expiry stop monitoring', async t => {
  const f = fixture(t); await f.ready(); f.session.disconnect(owner); assert.equal(f.session.session.armed, false);
  const g = fixture(t); await g.ready(); g.advance(30001); await g.session.tick(); assert.equal(g.session.session.armed, false);
  const h = fixture(t); await h.ready(); h.advance(31 * 60000); await h.session.tick(); assert.equal(h.session.session.armed, false);
});
test('live context staleness blocks setup generation after ARM', async t => {
  const f = fixture(t); await f.ready(); f.eligible(); f.advance(10001); await f.session.tick(); const status = await f.session.status(owner); assert.equal(status.proposal, null); assert.ok(status.reasons.some(r => /stale|fresh/i.test(r)));
});
test('UI states describe actual data, never assume protection from a position alone', () => {
  const base = { connected: true, configured: true, armed: true };
  assert.equal(productState(base), 'WATCHING'); assert.equal(productState({ ...base, proposal: {} }), 'AWAITING APPROVAL'); assert.equal(productState({ ...base, position: {} }), 'POSITION LIVE'); assert.equal(productState({ ...base, position: {}, protectedPosition: true }), 'PROTECTED'); assert.equal(productState({ ...base, executionState: 'EXECUTING' }), 'EXECUTING'); assert.equal(productState({ ...base, executionState: 'EXITING' }), 'EXITING');
});
test('wallet identity challenges are exact, expiring, single-use and master-only', async () => {
  let now = Date.now(); const auth = new ProductAuth({ clock: () => now, verify: async () => true }); assert.throws(() => auth.challenge(MAINNET.agent));
  const challenge = auth.challenge(owner), signature = '0x' + '1'.repeat(130); const result = await auth.authenticate({ address: owner, ...challenge, signature }); assert.equal(auth.address('Bearer ' + result.token), owner); await assert.rejects(auth.authenticate({ address: owner, ...challenge, signature }));
  const stale = auth.challenge(owner); now += 120001; await assert.rejects(auth.authenticate({ address: owner, ...stale, signature })); auth.logout('Bearer ' + result.token); assert.throws(() => auth.address('Bearer ' + result.token));
});

