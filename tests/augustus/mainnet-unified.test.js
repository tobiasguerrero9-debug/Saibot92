import test from 'node:test';
import assert from 'node:assert/strict';
import { MAINNET } from '../../server/augustus/mainnetCanary.js';
import { MainnetAdapter } from '../../server/augustus/mainnetAdapter.js';
import { reconcileCollateral, authorizationReadiness, prepareCrossLeverageUpdate, assertCrossLeverage } from '../../server/augustus/mainnetAccountState.js';
import { prepareCollateralTransfer, collateralTemplate } from '../../server/augustus/mainnetCollateral.js';
const now = Date.now();
const spot = () => ({ balances: [{ coin: 'USDC', token: 0, total: '7.8', hold: '0' }], tokenToAvailableAfterMaintenance: [[0, '7.8']] });
const account = () => ({ marginSummary: { accountValue: '0', totalMarginUsed: '0' }, withdrawable: '0', assetPositions: [] });
const active = (leverage = 5) => ({ user: MAINNET.master.toLowerCase(), coin: 'ETH', leverage: { type: 'cross', value: leverage }, availableToTrade: ['7.8', '7.8'], maxTradeSzs: ['0.01', '0.01'] });
const context = () => ({ symbol: 'ETH', timestamp: now, agentState: 'DEAD MARKET', marketBias: 'NEUTRAL', contextScore: 30, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.5 }, openInterest: 100, funding: 0, liquidationContext: { status: 'OBSERVING', observedSince: now - 1000 }, squeezeState: 'NO_SQUEEZE_CLASSIFICATION', transitionPressure: 'Low Delta Skew' });
const snapshot = () => ({ network: 'Mainnet', master: MAINNET.master, agent: MAINNET.agent, executionEnabled: false, accountMode: 'unifiedAccount', accountModeSupported: true, collateralKnown: true, availableMargin: 7.8, equity: 7.8, market: { name: 'ETH', asset: 1, maxLeverage: 25 }, marginMode: 'cross', currentLeverage: 5, positions: [], orders: [], accountAt: now, ordersAt: now, marketAt: now, modeAt: now, activeAssetAt: now, reconciled: true, uncertain: false });
test('Unified Account uses spot/maintenance/ETH availability even when perpetual equity and withdrawable are zero', () => {
  const c = reconcileCollateral('unifiedAccount', spot(), account(), active()); assert.equal(c.availableMargin, 7.8); assert.equal(c.equity, 7.8); assert.equal(c.reportedPerpEquity, 0); assert.equal(c.reportedPerpWithdrawable, 0); assert.equal(c.transferRequired, false);
});
test('Unified usable collateral respects holds, maintenance constraints and both active-asset sides', () => {
  const s = spot(); s.balances[0].hold = '2'; s.tokenToAvailableAfterMaintenance[0][1] = '4';
  const a = active(); a.availableToTrade = ['3', '5']; const c = reconcileCollateral('unifiedAccount', s, account(), a); assert.equal(c.availableMargin, 3); assert.equal(c.spotFreeUSDC, 5.8);
  delete s.tokenToAvailableAfterMaintenance; assert.equal(reconcileCollateral('unifiedAccount', s, account(), a).collateralKnown, false);
});
test('future Standard mode preserves separate perpetual accounting; unsupported modes never inherit it', () => {
  const p = account(); p.marginSummary = { accountValue: '12', totalMarginUsed: '2' }; p.withdrawable = '9'; const a = active(); a.availableToTrade = ['10', '10'];
  assert.equal(reconcileCollateral('disabled', spot(), p, a).availableMargin, 9);
  for (const mode of ['portfolioMargin', 'default', 'unknown', null]) { const c = reconcileCollateral(mode, spot(), p, a); assert.equal(c.collateralKnown, false); assert.equal(c.availableMargin, 0); }
});
test('20x CROSS blocks authorization readiness; 5x CROSS passes without authorizing or enabling execution', () => {
  assert.equal(authorizationReadiness({ ...snapshot(), currentLeverage: 20 }, context(), 5, now).authorizationReady, false);
  const ready = authorizationReadiness(snapshot(), context(), 5, now); assert.equal(ready.authorizationReady, true); assert.equal(ready.executionEnabled, false);
});
test('leverage below user cap passes; exchange leverage above lower user cap fails', () => {
  assert.doesNotThrow(() => assertCrossLeverage({ marginMode: 'cross', currentLeverage: 2 }, 3));
  assert.equal(authorizationReadiness({ ...snapshot(), currentLeverage: 2 }, context(), 3, now).authorizationReady, true);
  assert.equal(authorizationReadiness(snapshot(), context(), 3, now).authorizationReady, false);
});
test('unknown/isolated margin mode, stale leverage, exposure, missing context and enabled execution block readiness', () => {
  for (const patch of [{ marginMode: 'unknown' }, { marginMode: 'isolated' }, { currentLeverage: null }, { activeAssetAt: now - 10001 }, { modeAt: now + 1 }, { positions: [{ coin: 'ETH' }] }, { orders: [{}] }, { executionEnabled: true }]) assert.equal(authorizationReadiness({ ...snapshot(), ...patch }, context(), 5, now).authorizationReady, false);
  assert.equal(authorizationReadiness(snapshot(), null, 5, now).authorizationReady, false);
});
test('normalization review prepares official CROSS 5x or lower user cap without submission or a transfer', () => {
  const review = prepareCrossLeverageUpdate({ ...snapshot(), currentLeverage: 20 }, 5, now);
  assert.deepEqual(review.action, { type: 'updateLeverage', asset: 1, isCross: true, leverage: 5 }); assert.equal(review.submitted, false); assert.equal(review.signed, false); assert.equal(review.transfers, false);
  assert.equal(prepareCrossLeverageUpdate(snapshot(), 3, now).action.leverage, 3);
  assert.throws(() => prepareCrossLeverageUpdate(snapshot(), 6, now));
});
test('Unified Account cannot prepare the obsolete spot-to-perp transfer', () => {
  assert.throws(() => prepareCollateralTransfer('4', '7.8', now, 'unifiedAccount'), /Unified/);
  assert.equal(collateralTemplate('unifiedAccount').required, false); assert.equal(collateralTemplate('unifiedAccount').action, null);
});
test('Unified restart re-reads mode, maintenance and leverage; old journal reservation cannot resume entries', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url, MAINNET.info); const q = JSON.parse(init.body); let value;
    if (q.type === 'metaAndAssetCtxs') value = [{ universe: [{ name: 'BTC', szDecimals: 5 }, { name: 'ETH', szDecimals: 4, maxLeverage: 25 }] }, [{ markPx: '50000' }, { markPx: '2000' }]];
    else if (q.type === 'userAbstraction') value = 'unifiedAccount';
    else if (q.type === 'spotClearinghouseState') value = spot();
    else if (q.type === 'clearinghouseState') value = account();
    else if (q.type === 'activeAssetData') value = active(20);
    else if (['frontendOpenOrders', 'userFills', 'extraAgents'].includes(q.type)) value = [];
    else throw Error('Unexpected read');
    return { ok: true, json: async () => value };
  };
  for (let restart = 0; restart < 2; restart++) {
    const adapter = new MainnetAdapter({ fetchImpl, clock: () => now, journal: { corrupt: false, events: [{ action: 'ADAPTER_WRITE_RESERVED' }] } });
    const s = await adapter.read(); assert.equal(s.accountMode, 'unifiedAccount'); assert.equal(s.availableMargin, 7.8); assert.equal(s.currentLeverage, 20); assert.equal(adapter.stopped, true); assert.equal(authorizationReadiness(s, context(), 5, now).authorizationReady, false);
  }
});
