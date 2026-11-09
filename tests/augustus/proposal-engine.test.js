import test from 'node:test';
import assert from 'node:assert/strict';
import { ProposalEngine } from '../../server/augustus/proposalEngine.js';
import { roundEthOrder } from '../../server/augustus/mainnetAdapter.js';
import { MAINNET, validateCanaryProposal } from '../../server/augustus/mainnetCanary.js';
function fixture() {
  let now = Date.now();
  const context = { symbol: 'ETH', timestamp: now, source: 'test fixture only', agentState: 'LOCKED IN', marketBias: 'BULLISH', contextScore: 75, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.65 }, openInterest: 100, funding: 0.0001, liquidationContext: { status: 'OBSERVING', observedSince: now - 1000 }, squeezeState: 'NO_SQUEEZE_CLASSIFICATION', transitionPressure: 'Moderate Long Bias' };
  const state = { network: 'Mainnet', master: MAINNET.master, agent: MAINNET.agent, accountModeSupported: true, collateralKnown: true, accountMode: 'unifiedAccount', equity: 7.8, availableMargin: 7.8, accountAt: now, ordersAt: now, marketAt: now, modeAt: now, activeAssetAt: now, marginMode: 'cross', currentLeverage: 5, reconciled: true, uncertain: false, orders: [], positions: [], agentAuthorized: true, executionEnabled: false, market: { name: 'ETH', asset: 1, markPx: '2000', szDecimals: 4, maxLeverage: 25 } };
  const config = { MAX_NOTIONAL_USD: 20, MAX_LOSS_USD: 2, notionalUsd: 20, leverage: 5, stopLoss: 1900, takeProfit: 2200, maxLossUsd: 2, costReserveUsd: 0.1, slippageReserveUsd: 0.1, emergencySlippageBps: 10 };
  const adapter = { read: async () => structuredClone(state), roundedProposal: async (input, caps) => { const p = roundEthOrder(input, state.market); validateCanaryProposal(p, caps, state, now); return p; }, entry() { throw Error('Forbidden write'); }, protect() { throw Error('Forbidden write'); }, setLeverage() { throw Error('Forbidden write'); } };
  const engine = new ProposalEngine({ adapter, feed: { read: async () => structuredClone(context) }, clock: () => now });
  return { engine, context, state, config, adapter, advance: ms => { now += ms; }, refresh: () => { context.timestamp = now; for (const k of ['accountAt', 'ordersAt', 'marketAt', 'modeAt', 'activeAssetAt']) state[k] = now; } };
}
test('current OBSERVING/51 context produces explicit NO TRADE reasons without threshold changes', async () => {
  const f = fixture(); f.context.agentState = 'OBSERVING'; f.context.contextScore = 51; f.context.orderFlow.buyRatio = 0.529;
  const result = await f.engine.evaluate(); assert.equal(result.decision, 'NO TRADE'); assert.equal(result.proposal, null);
  for (const phrase of ['OBSERVING', 'below required 70', '58%', 'not configured']) assert.ok(result.reasons.some(r => r.includes(phrase)));
  assert.equal(result.executionEnabled, false); assert.equal(result.approvalEnabled, false);
});
test('eligible strategy still cannot invent missing user caps or stop configuration', async () => {
  const f = fixture(); const result = await f.engine.evaluate(); assert.equal(result.decision, 'NO TRADE'); assert.match(result.reasons.join(' '), /not configured/);
  assert.throws(() => f.engine.configure({ ...f.config, stopLoss: null }));
});
test('eligible fixture produces one complete unique ID-bound unsigned proposal and exact metrics', async () => {
  const f = fixture(); f.engine.configure(f.config); const result = await f.engine.evaluate(); assert.equal(result.decision, 'ELIGIBLE PROPOSAL', result.reasons.join(' '));
  const p = result.proposal; assert.ok(p.proposalId); assert.equal(p.side, 'LONG'); assert.equal(p.orderType, 'IOC'); assert.equal(p.leverage, 5); assert.ok(p.notionalUsd <= 20); assert.equal(p.estimatedMarginRequiredUsd, p.notionalUsd / 5); assert.ok(p.estimatedMaximumLossUsd <= 2); assert.ok(p.riskReward > 0); assert.ok(p.whyEligible); assert.equal(p.contextTimestamp, f.context.timestamp);
  assert.equal((await f.engine.evaluate()).proposal.proposalId, p.proposalId);
  assert.equal((await f.engine.validateProposalId(p.proposalId)).executionEnabled, false);
  result.proposal.size = 1000; assert.notEqual(f.engine.status().proposal.size, 1000);
});
test('price/context changes invalidate old proposal IDs and bind a replacement', async () => {
  const f = fixture(); f.engine.configure(f.config); const initial = await f.engine.evaluate(); const id = initial.proposal.proposalId;
  f.context.contextScore = 76; const replacement = await f.engine.evaluate(); assert.notEqual(replacement.proposal.proposalId, id); await assert.rejects(f.engine.validateProposalId(id), /superseded/); assert.equal(f.engine.status().invalidated.length, 1);
  f.context.contextScore = 51; assert.equal((await f.engine.evaluate()).decision, 'NO TRADE'); assert.equal(f.engine.status().proposal, null);
});
test('expiry, stale data, exposure, bad margin and missing authorization fail closed', async () => {
  for (const patch of [{ positions: [{}] }, { orders: [{}] }, { currentLeverage: 20 }, { marginMode: 'isolated' }, { availableMargin: 0 }, { agentAuthorized: false }]) {
    const f = fixture(); f.engine.configure(f.config); Object.assign(f.state, patch); assert.equal((await f.engine.evaluate()).decision, 'NO TRADE');
  }
  const f = fixture(); f.engine.configure(f.config); const p = (await f.engine.evaluate()).proposal; f.advance(10001); assert.equal(f.engine.status().proposal, null); await assert.rejects(f.engine.validateProposalId(p.proposalId));
});
test('single-flight evaluations never create concurrent outstanding proposals', async () => {
  const f = fixture(); f.engine.configure(f.config); const [a, b] = await Promise.all([f.engine.evaluate(), f.engine.evaluate()]); assert.equal(a.proposal.proposalId, b.proposal.proposalId);
});
test('REST failure cannot preserve a stale eligible proposal', async () => {
  const f = fixture(); f.engine.configure(f.config); await f.engine.evaluate(); f.adapter.read = async () => { throw Error('Read-only source unavailable'); }; const result = await f.engine.evaluate(); assert.equal(result.decision, 'NO TRADE'); assert.equal(result.proposal, null);
});
test('rounded notional minimum and user risk reserve cannot be bypassed to create a proposal', async () => {
  const f = fixture(); f.engine.configure({ ...f.config, notionalUsd: 5 }); assert.equal((await f.engine.evaluate()).decision, 'NO TRADE');
  f.engine.configure({ ...f.config, maxLossUsd: 0.1 }); assert.equal((await f.engine.evaluate()).decision, 'NO TRADE');
});
