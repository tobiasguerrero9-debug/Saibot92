import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductExecution } from '../../server/augustus/productExecution.js';
import { MAINNET } from '../../server/augustus/mainnetCanary.js';
function setup(stopFailure = false) {
  const now = Date.now(); let position = null, protectedPosition = false; const events = [], calls = [];
  const context = { symbol: 'ETH', timestamp: now, agentState: 'LOCKED IN', marketBias: 'BULLISH', contextScore: 75, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.65 }, openInterest: 100, funding: 0, liquidationContext: { status: 'OBSERVING', observedSince: now - 100 }, squeezeState: 'NONE', transitionPressure: 'Low Delta Skew' };
  const gateway = { network: 'SIMULATION', read: async () => ({ network: 'Mainnet', master: MAINNET.master, agent: MAINNET.agent, executionEnabled: false, equity: 7.8, availableMargin: 7.8, accountModeSupported: true, collateralKnown: true, marginMode: 'cross', currentLeverage: 5, agentAuthorized: true, accountAt: now, ordersAt: now, marketAt: now, modeAt: now, activeAssetAt: now, reconciled: true, uncertain: false, positions: position ? [position] : [], orders: [] }), entry: async () => { calls.push('entry'); position = { coin: 'ETH', szi: '0.005', entryPx: '2000' }; }, reconcile: async () => ({ symbol: 'ETH-PERP', side: 'LONG', size: 0.005, price: 2000 }), stopConfirmed: async () => protectedPosition, protect: async p => { assert.equal(p.reduceOnly, true); assert.equal(p.size, 0.005); calls.push('stop'); protectedPosition = !stopFailure; }, cancelEntries: async () => { calls.push('cancel'); }, emergencyClose: async p => { assert.equal(p.reduceOnly, true); calls.push('close'); position = null; } };
  const executor = new ProductExecution({ gateway, audit: { events, append: e => events.push(e), list: () => events }, clock: () => now });
  const proposal = { proposalId: 'user-approved-id', symbol: 'ETH-PERP', side: 'LONG', orderType: 'IOC', leverage: 5, size: 0.01, estimatedEntry: 2000, notionalUsd: 20, stopLoss: 1950, maxLossUsd: 1, costReserveUsd: 0.1, slippageReserveUsd: 0.1, createdAt: now, context };
  return { executor, gateway, calls, proposal, risk: { maxNotionalUsd: 20, maxLossUsd: 1 } };
}
test('product execution bridge reconciles partial fill, protects actual size and never repeats entry', async () => {
  const f = setup(); const result = await f.executor.run(f.proposal, f.risk); assert.equal(result.status, 'PROTECTED'); assert.equal(result.proposal.proposalId, 'user-approved-id'); assert.equal(result.position.szi, '0.005'); assert.equal((await f.executor.monitor()).protected, true);
  await assert.rejects(f.executor.run(f.proposal, f.risk)); assert.equal(f.calls.filter(x => x === 'entry').length, 1);
});
test('product bridge emergency-closes unconfirmed stop and cannot bind a real network adapter', async () => {
  const f = setup(true); await assert.rejects(f.executor.run(f.proposal, f.risk), /EMERGENCY_STOPPED/); assert.equal(f.calls.filter(x => x === 'close').length, 1);
  assert.throws(() => new ProductExecution({ gateway: { network: 'Mainnet' } }), /disabled/);
});
