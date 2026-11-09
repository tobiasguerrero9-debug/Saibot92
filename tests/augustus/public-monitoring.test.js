import test from 'node:test';
import assert from 'node:assert/strict';
import { publicMonitoring } from '../../server/augustus/publicMonitoring.js';
const now = 1700000000000;
const context = () => ({ symbol: 'ETH', timestamp: now, agentState: 'LOCKED IN', marketBias: 'BULLISH', contextScore: 75, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.65 }, openInterest: 100, funding: 0, liquidationContext: { status: 'OBSERVING', observedSince: now - 100 }, squeezeState: 'NONE', transitionPressure: 'Low Delta Skew' });
test('public setup observation never creates an executable or user-specific proposal', () => {
  const result = publicMonitoring({ ...context(), wallet: 'private tenant', risk: { secret: true }, proposal: { proposalId: 'private' } }, now);
  assert.equal(result.setup, 'SETUP DETECTED');
  assert.equal(result.proposal, null); assert.equal(result.executionEnabled, false);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(result.configurationRequired, true);
});
test('public monitoring preserves eligibility thresholds and fails closed on stale or incomplete data', () => {
  assert.equal(publicMonitoring({ ...context(), agentState: 'DEAD MARKET', contextScore: 30 }, now).setup, 'NO SETUP');
  for (const input of [null, { ...context(), timestamp: now - 10001 }, { ...context(), whatChanged: {} }]) {
    const result = publicMonitoring(input, now);
    assert.equal(result.setup, 'NO SETUP'); assert.equal(result.proposal, null); assert.equal(result.executionEnabled, false);
  }
});
