import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { OrderRequest, UpdateLeverageRequest, CancelRequest } from '@nktkas/hyperliquid/api/exchange';
import { MainnetAdapter, roundEthOrder } from '../../server/augustus/mainnetAdapter.js';
import { MAINNET, MainnetCanary } from '../../server/augustus/mainnetCanary.js';
import { MainnetContextFeed, validateLiveContext } from '../../server/augustus/mainnetContext.js';
import { prepareCollateralTransfer, collateralTemplate } from '../../server/augustus/mainnetCollateral.js';
const now = Date.now(), caps = { MAX_NOTIONAL_USD: 20, MAX_LOSS_USD: 2 };
const ids = { entryCloid: '0x' + '1'.repeat(32), stopCloid: '0x' + '2'.repeat(32), exitCloid: '0x' + '3'.repeat(32) };
const market = { name: 'ETH', asset: 1, szDecimals: 4, maxLeverage: 25, markPx: '2000' };
function context() { return { symbol: 'ETH', timestamp: now, agentState: 'LOCKED IN', marketBias: 'LONG', contextScore: 75, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.7 }, openInterest: 100, funding: 0.0001, liquidationContext: { status: 'OBSERVING', observedSince: now - 1000, events: [] }, squeezeState: 'NO_SQUEEZE_CLASSIFICATION', transitionPressure: 'Moderate Long Bias' }; }
function proposal() { return { ...ids, symbol: 'ETH-PERP', side: 'LONG', orderType: 'IOC', size: 0.01, estimatedEntry: 2000, notionalUsd: 20, stopLoss: 1900, takeProfit: null, leverage: 2, maxLossUsd: 2, costReserveUsd: 0.1, slippageReserveUsd: 0.1, emergencySlippageBps: 10, context: context(), createdAt: now }; }
function fixture({ partial = false, stopFailure = false, noSandbox = false } = {}) {
  const state = { positions: [], orders: [], fills: [], calls: [], status: 'filled' };
  const fetchImpl = async (url, init) => {
    assert.equal(url, MAINNET.info); const req = JSON.parse(init.body);
    if (req.user) assert.equal(req.user, MAINNET.master);
    let body;
    if (req.type === 'metaAndAssetCtxs') body = [{ universe: [{ name: 'BTC', szDecimals: 5, maxLeverage: 40 }, market] }, [{ markPx: '50000' }, { markPx: '2000' }]];
    else if (req.type === 'clearinghouseState') body = { marginSummary: { accountValue: '100', totalMarginUsed: '0' }, withdrawable: '100', assetPositions: state.positions.map(position => ({ position })) };
    else if (req.type === 'frontendOpenOrders') body = state.orders;
    else if (req.type === 'userFills') body = state.fills;
    else if (req.type === 'extraAgents') body = [{ address: MAINNET.agent, validUntil: now + 100000 }];
    else if (req.type === 'userAbstraction') body = 'disabled';
    else if (req.type === 'spotClearinghouseState') body = { balances: [], tokenToAvailableAfterMaintenance: [[0, '0']] };
    else if (req.type === 'activeAssetData') body = { user: MAINNET.master, coin: 'ETH', leverage: { type: 'cross', value: 2 }, availableToTrade: ['100', '100'] };
    else if (req.type === 'orderStatus') body = { status: 'order', order: { status: state.status, order: { coin: 'ETH', oid: 71, sz: '0' } } };
    else throw Error('Unexpected info request');
    return { ok: true, json: async () => structuredClone(body) };
  };
  const exchange = {
    updateLeverage: async p => { v.parse(UpdateLeverageRequest.entries.action, { type: 'updateLeverage', ...p }); assert.equal(p.isCross, true); state.calls.push({ leverage: p }); return { status: 'ok' }; },
    cancel: async p => { v.parse(CancelRequest.entries.action, { type: 'cancel', ...p }); state.calls.push({ cancel: p }); state.orders = state.orders.filter(o => !p.cancels.some(c => c.o === o.oid)); return { status: 'ok' }; },
    order: async body => {
      v.parse(OrderRequest.entries.action, { type: 'order', ...body }); state.calls.push(body); const o = body.orders[0]; assert.equal(o.a, 1);
      if (o.t.trigger) {
        if (stopFailure) throw Error('Sandbox stop timeout');
        state.orders.push({ coin: 'ETH', oid: 72, cloid: o.c, reduceOnly: o.r, isTrigger: true, orderType: 'Stop Market', triggerPx: o.t.trigger.triggerPx, sz: o.s, side: o.b ? 'B' : 'A' });
      } else if (o.r) { state.positions = []; }
      else {
        const size = partial ? 0.005 : Number(o.s); state.positions = [{ coin: 'ETH', szi: String(size), entryPx: '2000' }];
        state.fills = [{ coin: 'ETH', oid: 71, tid: 1, px: '2000', sz: String(size), side: 'B' }];
      }
      return { status: 'ok', response: { type: 'order', data: { statuses: [{ filled: { oid: 71, totalSz: o.s, avgPx: '2000' } }] } } };
    },
  };
  const adapter = new MainnetAdapter({ fetchImpl, clock: () => now, ...(noSandbox ? {} : { mockExchange: exchange, sandbox: true }) });
  return { adapter, state };
}
test('real mainnet adapter reads metadata/account but cannot write, sign or enable via configuration', async () => {
  const { adapter } = fixture({ noSandbox: true }); const s = await adapter.read(); assert.equal(s.market.asset, 1); assert.equal(s.availableMargin, 100);
  for (const method of ['entry', 'setLeverage', 'protect', 'emergencyClose']) await assert.rejects(adapter[method](proposal(), caps), /disabled/);
  assert.throws(() => new MainnetAdapter({ master: MAINNET.agent }), /mapping|mismatch/);
});
test('rounding truncates size, limits price precision and fails closed for invalid/dust size or missing stops', () => {
  const rounded = roundEthOrder({ ...proposal(), estimatedEntry: 2240.678, size: 0.010099 }, market);
  assert.equal(rounded.wirePrice, '2240.6'); assert.equal(rounded.wireSize, '0.01');
  for (const patch of [{ estimatedEntry: NaN }, { estimatedEntry: -1 }, { size: Infinity }, { size: 0.00001 }, { size: 0.001 }, { stopLoss: null }, { leverage: 6 }, { symbol: 'BTC-PERP' }]) assert.throws(() => roundEthOrder({ ...proposal(), ...patch }, market));
});
test('SDK-shaped CROSS IOC entry uses dynamic ETH index with no implicit leverage update; duplicate entry blocked', async () => {
  const { adapter, state } = fixture(); await adapter.entry(proposal(), caps);
  const wire = state.calls.find(x => x.orders)?.orders[0]; assert.equal(wire.a, 1); assert.equal(wire.r, false); assert.equal(wire.t.limit.tif, 'Ioc');
  await assert.rejects(adapter.entry(proposal(), caps), /slot exhausted/); assert.equal(state.calls.filter(x => x.orders).length, 1);
  assert.equal(state.calls.some(x => x.leverage), false);
});
test('adapter single-flight gate blocks concurrent entries even with different CLOIDs', async () => {
  const { adapter, state } = fixture(); const first = adapter.entry(proposal(), caps);
  await assert.rejects(adapter.entry({ ...proposal(), entryCloid: '0x' + 'f'.repeat(32) }, caps), /slot exhausted/);
  await first; assert.equal(state.calls.filter(c => c.orders?.[0].r === false).length, 1);
});
test('partial IOC fill reconciles from actual fills and actual position, not requested size or acknowledgement', async () => {
  const { adapter, state } = fixture({ partial: true }); await adapter.entry(proposal(), caps); state.status = 'canceled';
  const fill = await adapter.reconcile(ids.entryCloid); assert.equal(fill.size, 0.005); assert.equal(fill.partial, true);
  state.fills.push(structuredClone(state.fills[0])); assert.equal((await adapter.reconcile(ids.entryCloid)).size, 0.005);
  state.status = 'open'; await assert.rejects(adapter.reconcile(ids.entryCloid), /uncertain/);
});
test('protect actual partial fill with reduce-only stop; validate side/trigger/size and prevent duplicate stop', async () => {
  const { adapter, state } = fixture({ partial: true }); await adapter.entry(proposal(), caps); await adapter.protect(proposal());
  const stop = state.calls.at(-1).orders[0]; assert.equal(stop.s, '0.005'); assert.equal(stop.r, true); assert.equal(stop.t.trigger.tpsl, 'sl');
  assert.equal(await adapter.stopConfirmed(proposal()), true);
  state.orders[0].side = 'B'; assert.equal(await adapter.stopConfirmed(proposal()), false);
  await assert.rejects(adapter.protect(proposal()), /uncertain/);
});
test('stop failure has no ambiguous replay; emergency close is reduce-only and remains possible after entry limit', async () => {
  const { adapter, state } = fixture({ stopFailure: true }); await adapter.entry(proposal(), caps);
  await assert.rejects(adapter.protect(proposal())); await assert.rejects(adapter.protect(proposal()), /uncertain/);
  await adapter.emergencyClose(proposal()); assert.equal(state.calls.at(-1).orders[0].r, true); assert.equal(state.positions.length, 0);
});
test('STOP preserves confirmed SL, blocks entries and cancels only own pending entry', async () => {
  const { adapter, state } = fixture(); await adapter.entry(proposal(), caps); await adapter.protect(proposal());
  state.orders.push({ coin: 'ETH', oid: 73, cloid: ids.entryCloid, reduceOnly: false }, { coin: 'ETH', oid: 74, cloid: 'external', reduceOnly: false });
  await adapter.stop(); assert.equal(state.orders.some(x => x.oid === 73), false); assert.equal(state.orders.some(x => x.oid === 74), true); assert.equal(await adapter.stopConfirmed(proposal()), true);
  await assert.rejects(adapter.entry(proposal(), caps), /stopped/);
});
test('existing position, stale context, absent liquidation history and undersized rounded entry all block before SDK writes', async () => {
  const { adapter, state } = fixture(); state.positions = [{ coin: 'ETH', szi: '0.01', entryPx: '2000' }]; await assert.rejects(adapter.entry(proposal(), caps), /positions/); assert.equal(state.calls.length, 0);
  state.positions = [];
  await assert.rejects(adapter.entry({ ...proposal(), context: { ...context(), timestamp: now - 10001 } }, caps), /stale/);
  await assert.rejects(adapter.entry({ ...proposal(), context: { ...context(), liquidationContext: { status: 'UNAVAILABLE' } } }, caps), /incomplete/);
  await assert.rejects(adapter.roundedProposal({ ...proposal(), size: 0.00001 }, caps)); assert.equal(state.calls.length, 0);
});
test('restart with a previous durable write reservation fails closed', async () => {
  const adapter = new MainnetAdapter({ journal: { corrupt: false, events: [{ action: 'ADAPTER_WRITE_RESERVED' }] } }); assert.equal(adapter.stopped, true); assert.equal(adapter.entryUsed, true);
});
test('context wiring uses actual feed output, marks provenance, enforces history/freshness and direction eligibility', async () => {
  const feed = new MainnetContextFeed({ read: async () => ({ ...context(), source: 'execution prices come from Hyperliquid TESTNET' }) });
  const output = await feed.eligible('LONG', now); assert.ok(output.context.source.includes('MAINNET')); assert.ok(output.whyEntryEligible);
  await assert.rejects(feed.eligible('SHORT', now), /ineligible/);
  assert.throws(() => validateLiveContext({ ...context(), whatChanged: { hasHistory: false } }, now), /incomplete/);
  assert.throws(() => validateLiveContext({ ...context(), timestamp: now + 1 }, now), /stale/);
});
test('collateral action is unsigned internal spot-to-perp; amount must be explicitly selected and within available funds', () => {
  const p = prepareCollateralTransfer('1.23', '7.8', now, 'disabled'); assert.equal(p.action.type, 'usdClassTransfer'); assert.equal(p.action.amount, '1.23'); assert.equal(p.action.toPerp, true); assert.equal(p.submitted, false); assert.equal(p.trade, false);
  for (const amount of [null, '', '0', '8', 'NaN', '1.000000001']) assert.throws(() => prepareCollateralTransfer(amount, '7.8', now, 'disabled'));
  assert.equal(collateralTemplate().amountChosen, false);
});
test('canary controller integrates with SDK-shaped adapter for partial fill and stop failure without duplicate entry', async () => {
  for (const stopFailure of [false, true]) {
    const { adapter, state } = fixture({ partial: true, stopFailure });
    const events = [], audit = { events, append: event => events.push(event), list: () => events };
    const engine = new MainnetCanary({ env: { AUGUSTUS_MODE: 'MAINNET_CANARY', AUGUSTUS_ACK_MAINNET: 'true', AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' }, audit, gateway: adapter, clock: () => now, simulation: true });
    engine.configure(caps); await engine.arm(); const review = await engine.propose(proposal());
    if (stopFailure) {
      await assert.rejects(engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }), /EMERGENCY_STOPPED/);
      assert.equal(state.positions.length, 0);
    } else {
      await engine.approveAndExecute({ approved: true, proposalHash: review.proposalHash }); assert.equal(engine.state, 'PROTECTED');
    }
    assert.equal(state.calls.filter(c => c.orders?.[0].r === false).length, 1);
  }
});

