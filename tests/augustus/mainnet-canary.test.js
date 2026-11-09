import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionAudit } from '../../server/augustus/sessionAudit.js';
import { MAINNET, MainnetCanary, canaryEnvironment, validateCanaryCaps, validateCanaryProposal, prepareMainnetApproval, CONTEXT_FIELDS } from '../../server/augustus/mainnetCanary.js';
const now = Date.now();
const caps = { MAX_NOTIONAL_USD: 20, MAX_LOSS_USD: 2 }; // Test fixtures, never defaults.
function snapshot() { return { network: 'Mainnet', master: MAINNET.master, agent: MAINNET.agent, accountAt: now, ordersAt: now, marketAt: now, modeAt: now, activeAssetAt: now, reconciled: true, uncertain: false, accountModeSupported: true, collateralKnown: true, marginMode: 'cross', currentLeverage: 2, positions: [], orders: [], equity: 100, availableMargin: 100, agentAuthorized: true }; }
function proposal() { return { symbol: 'ETH-PERP', side: 'LONG', orderType: 'IOC', leverage: 2, notionalUsd: 20, size: 0.01, estimatedEntry: 2000, stopLoss: 1900, maxLossUsd: 2, costReserveUsd: 0.1, slippageReserveUsd: 0.1, createdAt: now, context: { ...Object.fromEntries(CONTEXT_FIELDS.map(k => [k, 'test fixture'])), timestamp: now } }; }
function harness(t, overrides = {}, env = { AUGUSTUS_MODE: 'MAINNET_CANARY', AUGUSTUS_ACK_MAINNET: 'true', AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' }) {
  const dir = mkdtempSync(join(tmpdir(), 'augustus-canary-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const audit = new SessionAudit(join(dir, 'audit.jsonl')); let protectedPosition = false, state = snapshot(), entries = 0, closes = 0;
  const gateway = { network: 'SIMULATION', read: async () => structuredClone(state), entry: async p => { entries++; state.positions = [{ coin: 'ETH', size: p.size }]; }, reconcile: async () => ({ symbol: 'ETH-PERP', side: 'LONG', size: 0.01, price: 2000 }), stopConfirmed: async () => protectedPosition, protect: async () => { protectedPosition = true; }, cancelEntries: async () => {}, emergencyClose: async p => { assert.equal(p.reduceOnly, true); closes++; state.positions = []; }, ...overrides };
  const engine = new MainnetCanary({ env, audit, gateway, simulation: true, clock: () => now });
  return { engine, gateway, audit, counts: () => ({ entries, closes }), resetState: () => { state = snapshot(); } };
}
test('live gate cannot be enabled through environment flags; simulated gateway cannot masquerade as live', async t => {
  assert.equal(canaryEnvironment({ AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' }).executionEnabled, false);
  const h = harness(t); const live = new MainnetCanary({ env: { AUGUSTUS_MODE: 'MAINNET_CANARY', AUGUSTUS_ACK_MAINNET: 'true', AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' }, audit: h.audit, gateway: h.gateway });
  live.configure(caps); await assert.rejects(live.arm(), /disabled/); assert.equal(h.counts().entries, 0);
  assert.throws(() => new MainnetCanary({ audit: h.audit, gateway: { network: 'Mainnet' }, simulation: true }), /simulation/);
  const noAck = harness(t, {}, { AUGUSTUS_MODE: 'MAINNET_CANARY', AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' }); noAck.engine.configure(caps); await assert.rejects(noAck.engine.arm(), /environment gate/);
});
test('both explicit caps required; no financial defaults', () => {
  for (const value of [{}, { MAX_NOTIONAL_USD: 20 }, { ...caps, MAX_LOSS_USD: 0 }, { ...caps, MAX_NOTIONAL_USD: '20' }, { ...caps, MAX_LOSS_USD: Infinity }]) assert.throws(() => validateCanaryCaps(value));
});
test('risk policy rejects other markets, oversized/lossy/high-leverage trades and absent/wrong stops', () => {
  for (const patch of [{ symbol: 'BTC-PERP' }, { leverage: 6 }, { notionalUsd: 21 }, { maxLossUsd: 3 }, { maxLossUsd: 0.1 }, { stopLoss: null }, { stopLoss: 2100 }, { size: 0.02 }, { slippageReserveUsd: 0 }, { takeProfit: 1900 }]) assert.throws(() => validateCanaryProposal({ ...proposal(), ...patch }, caps, snapshot(), now));
});
test('rejects stale/future data, wrong accounts, unknown state, positions, orders and insufficient collateral', () => {
  for (const patch of [{ marketAt: now - 10001 }, { ordersAt: now + 1 }, { accountAt: null }, { reconciled: false }, { uncertain: true }, { master: MAINNET.agent }, { network: 'Testnet' }, { positions: [{ coin: 'BTC' }] }, { positions: [{ coin: 'ETH' }] }, { orders: [{ coin: 'ETH' }] }, { availableMargin: 1 }, { agentAuthorized: false }]) assert.throws(() => validateCanaryProposal(proposal(), caps, { ...snapshot(), ...patch }, now));
  assert.throws(() => validateCanaryProposal({ ...proposal(), context: {} }, caps, snapshot(), now));
});
test('approval binds exact immutable proposal; one entry; protective exits remain possible after entry limit', async t => {
  const h = harness(t); h.engine.configure(caps); await h.engine.arm(); const review = await h.engine.propose(proposal());
  assert.match(review.proposal.entryCloid, /^0x[0-9a-f]{32}$/); assert.equal(new Set([review.proposal.entryCloid, review.proposal.stopCloid, review.proposal.exitCloid]).size, 3);
  await assert.rejects(h.engine.approveAndExecute({ approved: false, proposalHash: review.proposalHash }));
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: 'changed' }));
  review.proposal.notionalUsd = 999;
  await h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash });
  assert.equal(h.counts().entries, 1); assert.equal(h.engine.state, 'PROTECTED');
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }));
  await assert.rejects(h.engine.propose(proposal()));
  h.gateway.stopConfirmed = async () => false; await h.engine.stop(); assert.equal(h.counts().closes, 1);
  const actions = h.audit.events.map(e => e.action); for (const action of ['SESSION_ARMED', 'ENTRY_PROPOSED', 'USER_APPROVED', 'ORDER_SUBMITTED', 'ORDER_FILLED', 'STOP_CONFIRMED', 'POSITION_UPDATED', 'EMERGENCY_STOP']) assert.ok(actions.includes(action));
});
test('unconfirmed SL retries the same CLOID then closes reduce-only and stops', async t => {
  const ids = []; const h = harness(t, { stopConfirmed: async () => false, protect: async p => { assert.equal(p.reduceOnly, true); ids.push(p.stopCloid); } });
  h.engine.configure(caps); await h.engine.arm(); const review = await h.engine.propose(proposal());
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }), /EMERGENCY_STOPPED/);
  assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]); assert.equal(h.counts().closes, 1); assert.equal(h.engine.entries, 1);
});
test('entry ambiguity consumes the slot; audit recovery never automatically resumes entry', async t => {
  const h = harness(t, { entry: async () => { throw Error('Simulated timeout after unknown exchange acceptance'); } });
  h.engine.configure(caps); await h.engine.arm(); const review = await h.engine.propose(proposal());
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash })); assert.equal(h.engine.entries, 1);
  const resumed = new MainnetCanary({ env: h.engine.environment, audit: h.audit, gateway: h.gateway, simulation: true }); assert.equal(resumed.recoveryRequired, true);
});
test('single-flight lock rejects concurrent entry and STOP blocks new execution immediately', async t => {
  let release; const h = harness(t); h.engine.configure(caps); await h.engine.arm(); const review = await h.engine.propose(proposal());
  h.gateway.read = () => new Promise(resolve => { release = () => resolve(snapshot()); });
  const entry = h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash });
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }), /lock/);
  await h.engine.stop(); release(); await assert.rejects(entry, /Kill switch/); assert.equal(h.counts().entries, 0);
});
test('failed audit blocks entry; completed session audit records terminal closure', async t => {
  const h = harness(t); h.engine.configure(caps); await h.engine.arm(); const review = await h.engine.propose(proposal());
  const append = h.audit.append.bind(h.audit); h.audit.append = () => { throw Error('disk full'); };
  await assert.rejects(h.engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }), /Audit/); assert.equal(h.counts().entries, 0);
  h.audit.append = append;
  const clean = harness(t); clean.engine.configure(caps); await clean.engine.arm(); const p = await clean.engine.propose(proposal()); await clean.engine.approveAndExecute({ approved: true, proposalHash: p.proposalHash }); clean.resetState(); await clean.engine.reconcileClosed(); assert.equal(clean.engine.state, 'COMPLETED'); assert.ok(clean.audit.events.some(e => e.action === 'SESSION_COMPLETED'));
});
test('prepared authorization pins wallets, mainnet, safe timestamp and expiry without submitting', () => {
  const p = prepareMainnetApproval(now); assert.equal(p.action.type, 'approveAgent'); assert.equal(p.action.hyperliquidChain, 'Mainnet'); assert.equal(p.action.agentAddress, MAINNET.agent); assert.equal(p.master, MAINNET.master); assert.equal(p.nonce, p.action.nonce); assert.equal(p.expiry - p.nonce, 86400000); assert.equal(p.executionEnabled, false); assert.equal(p.submitted, false);
});
