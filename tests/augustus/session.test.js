import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionSessionController } from '../../server/augustus/sessionController.js';
import { SessionGateway } from '../../server/augustus/sessionGateway.js';
import { validateEnvelope, decideEligibility } from '../../server/augustus/sessionPolicy.js';
import { HyperliquidInfoClient } from '../../src/augustus/services/hyperliquidInfoClient.js';

const owner = '0x1111111111111111111111111111111111111111';
const envelope = { symbol: 'ETH', direction: 'LONG_ONLY', maxPositionUsd: 50, maxLeverage: 2, maxLoss: 2, lossUnit: 'USD', stopLoss: 95, takeProfit: 110, durationMinutes: 30, maxTrades: 1 };
function harness() {
  let now = 1800000000000, position = null, orders = [];
  const events = [], calls = [], health = { connected: true, lastSeen: now, status: 'CONNECTED' };
  const market = { name: 'ETH', asset: 1, markPx: '100', maxLeverage: 25, szDecimals: 3, receivedAt: now };
  const account = () => ({ address: owner, equity: 1000, availableMargin: 1000, positions: position ? [position] : [], orders, receivedAt: now });
  const read = () => ({ account: account(), market, position });
  const snap = () => ({ account: account(), markets: [market], access: { granted: true, account: owner, verifiedAt: now }, executionEnabled: true, agentAuthorized: true, uncertain: false });
  const context = { symbol: 'ETH', timestamp: now, agentState: 'LOCKED IN', marketBias: 'LONG', contextScore: 78, whatChanged: { hasHistory: true }, orderFlow: { buyRatio: 0.65 } };
  const gateway = {
    read: async () => read(), snapshot: async () => snap(), movements: async () => [],
    prepare: (session, snapshot, side) => new SessionGateway({}).prepare(session, snapshot, side),
    setLeverage: async () => { calls.push('leverage'); },
    submitEntry: async proposal => { calls.push('entry'); position = { coin: 'ETH', szi: String(proposal.size), entryPx: '100', unrealizedPnl: '0', leverage: { value: proposal.leverage } }; return { status: 'FILLED' }; },
    reconcileEntry: async () => ({ ...read(), order: { status: 'FILLED', orderId: 42 } }),
    protection: state => state.position && orders.find(o => o.kind === 'sl'),
    actualRisk: (state, stop) => Math.abs(Number(state.position.szi)) * (Math.abs(Number(state.position.entryPx) - stop) + Number(state.position.entryPx) * .002),
    submitProtection: async (state, price, kind) => { calls.push(kind); orders.push({ coin: 'ETH', kind, oid: kind === 'sl' ? 43 : 44, reduceOnly: true, isTrigger: true, triggerPx: String(price), sz: state.position.szi, side: 'A', orderType: kind === 'sl' ? 'Stop Market' : 'Take Profit Market' }); return { status: 'RESTING' }; },
    confirmProtection: async () => orders.some(o => o.kind === 'sl') ? { ...read(), stop: orders.find(o => o.kind === 'sl') } : null,
    cancelEntries: async () => { calls.push('cancel'); orders = orders.filter(o => o.reduceOnly); return read(); },
    close: async () => { calls.push('close'); position = null; return { ...read(), closed: true, order: { status: 'FILLED', orderId: 45 } }; },
    cleanupFlat: async () => { orders = []; return { ...read(), clean: !position }; },
  };
  const audit = { append: e => events.push(structuredClone(e)), latest: () => null, list: id => events.filter(e => e.executionId === id) };
  const engine = new ExecutionSessionController({ gateway, context: async () => context, health: () => health, audit, clock: () => now });
  return { engine, gateway, audit, calls, events, health, context, market, account, snap, read,
    setPosition: p => { position = p; }, setOrders: o => { orders = o; }, advance: ms => { now += ms; }, now: () => now,
    arm: async () => { await engine.configure(owner, envelope); await engine.arm(owner, true); },
  };
}

test('disarmed controller never trades', async () => { const h = harness(); await h.engine.tick(); await h.engine.configure(owner, envelope); await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); });
test('only ETH and one trade per session are accepted', () => {
  assert.throws(() => validateEnvelope({ ...envelope, symbol: 'BTC' }));
  assert.throws(() => validateEnvelope({ ...envelope, maxTrades: 2 }));
});
for (const [key, value] of [['maxPositionUsd', 101], ['maxLeverage', 4], ['maxLoss', 6], ['stopLoss', 0], ['durationMinutes', 1]]) test(`envelope rejects ${key}`, () => assert.throws(() => validateEnvelope({ ...envelope, [key]: value })));
test('explicit ARM consent required and equity risk ceiling cannot be exceeded', async () => {
  const h = harness(); await h.engine.configure(owner, { ...envelope, maxLoss: 5 });
  await assert.rejects(h.engine.arm(owner, false)); await h.engine.arm(owner, true);
  assert.equal(h.engine.session.lossBudgetUsd, 5); assert.equal(h.engine.session.armed, true);
});
test('real-context eligibility policy has WAIT/NOT_ELIGIBLE/ENTRY_ELIGIBLE', () => {
  const h = harness(); assert.equal(decideEligibility(null, envelope, h.now()).decision, 'WAIT');
  assert.equal(decideEligibility(h.context, { ...envelope, direction: 'SHORT_ONLY' }, h.now()).decision, 'NOT_ELIGIBLE');
  assert.equal(decideEligibility(h.context, envelope, h.now()).decision, 'ENTRY_ELIGIBLE');
  assert.equal(decideEligibility({ ...h.context, whatChanged: { hasHistory: false } }, envelope, h.now()).decision, 'WAIT');
});
test('one full mocked session: arm -> entry -> fill -> stop -> manage -> close -> audit', async () => {
  const h = harness(); await h.arm(); await h.engine.tick();
  assert.equal(h.engine.session.state, 'MANAGING'); assert.equal(h.engine.session.trades, 1);
  assert.ok(h.calls.indexOf('sl') > h.calls.indexOf('entry')); assert.ok(h.events.some(e => e.action === 'STOP_CONFIRMED'));
  await h.engine.tick(); assert.equal(h.calls.filter(c => c === 'entry').length, 1);
  await h.engine.closeNow(owner, true); assert.equal(h.read().position, null);
  assert.ok(h.events.some(e => e.action === 'POSITION_CLOSED'));
  assert.ok(h.events.filter(e => e.action !== 'CHECKPOINT').every(e => e.symbol === 'ETH' && e.executionId && e.timestamp && e.reason));
});
test('stale market and stale WebSocket block entries', async () => {
  for (const input of ['market', 'ws']) {
    const h = harness(); await h.arm(); if (input === 'market') h.market.receivedAt -= 11000; else h.health.lastSeen -= 11000;
    await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED');
  }
});
test('STOP cancels pending entry orders and preserves SL', async () => {
  const h = harness(); await h.arm(); await h.engine.tick();
  h.setOrders([...h.read().account.orders, { coin: 'ETH', oid: 9, reduceOnly: false }]);
  await h.engine.stop(owner); assert.equal(h.engine.session.armed, false); assert.equal(h.calls.includes('close'), false);
  assert.ok(h.read().account.orders.every(o => o.reduceOnly)); assert.ok(h.read().account.orders.some(o => o.kind === 'sl'));
});
test('STOP during in-flight entry prevents duplicates and completes protection', async () => {
  const h = harness(); await h.arm(); let release;
  const submit = h.gateway.submitEntry; h.gateway.submitEntry = async p => { await new Promise(resolve => { release = resolve; }); return submit(p); };
  const tick = h.engine.tick(); while (!release) await new Promise(resolve => setImmediate(resolve));
  const stopping = h.engine.stop(owner); assert.equal(h.engine.session.armed, false); release(); await tick; await stopping;
  assert.equal(h.calls.filter(c => c === 'entry').length, 1); assert.ok(h.calls.includes('sl')); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED');
});
test('single-flight rejects concurrent ARM/configuration and never duplicates entry', async () => {
  const h = harness(); await h.arm(); const tick = h.engine.tick(); await h.engine.tick(); await tick;
  assert.equal(h.calls.filter(c => c === 'entry').length, 1); await assert.rejects(h.engine.arm(owner, true));
});
test('stop failure reconciles safely then emergency-closes reduce-only path', async () => {
  const h = harness(); await h.arm(); h.gateway.submitProtection = async () => { h.calls.push('sl-failed'); throw new Error('ambiguous'); }; h.gateway.confirmProtection = async () => null;
  await h.engine.tick(); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED'); assert.equal(h.read().position, null); assert.ok(h.calls.includes('close'));
  assert.ok(h.events.some(e => e.action === 'EXIT_TRIGGERED'));
});
test('partial entry fill is protected using actual size only', async () => {
  const h = harness(); await h.arm(); const submit = h.gateway.submitEntry;
  h.gateway.submitEntry = async p => { const result = await submit(p); h.setPosition({ ...h.read().position, szi: String(p.size / 2) }); return result; };
  await h.engine.tick(); assert.equal(Number(h.read().account.orders.find(o => o.kind === 'sl').sz), Number(h.read().position.szi));
  assert.ok(h.events.some(e => e.action === 'ORDER_FILLED' && e.reason.includes('Partial')));
});
test('session expiry and heartbeat loss preserve verified protection and stop decisions', async () => {
  for (const expiry of [true, false]) {
    const h = harness(); await h.arm(); await h.engine.tick();
    if (expiry) h.engine.session.expiresAt = h.now() - 1; else h.engine.session.heartbeatAt -= 31000;
    await h.engine.tick(); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED'); assert.equal(h.calls.includes('close'), false);
  }
});
test('max loss reached triggers emergency close', async () => {
  const h = harness(); await h.arm(); await h.engine.tick(); const read = h.gateway.read;
  h.gateway.read = async () => { const r = await read(); r.account.equity = 990; return r; };
  await h.engine.tick(); assert.ok(h.calls.includes('close')); assert.equal(h.engine.session.armed, false);
});
test('restart with open position never re-arms and preserves confirmed SL', async () => {
  const h = harness(); await h.arm(); await h.engine.tick();
  h.audit.latest = () => structuredClone(h.engine.session);
  const restored = new ExecutionSessionController({ gateway: h.gateway, context: async () => h.context, health: () => h.health, audit: h.audit, clock: h.now });
  await restored.tick(); assert.equal(restored.session.state, 'EMERGENCY_STOPPED'); assert.equal(restored.session.armed, false); assert.equal(h.calls.filter(c => c === 'entry').length, 1); assert.ok(!h.calls.includes('close'));
});
test('exchange/local position mismatch stops without closing unrelated exposure', async () => {
  const h = harness(); await h.arm(); h.setPosition({ coin: 'ETH', szi: '0.2', entryPx: '100' });
  await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); assert.equal(h.calls.includes('close'), false); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED');
});
test('ambiguous entry never retries and prevents configuring a new session', async () => {
  const h = harness(); await h.arm(); h.gateway.submitEntry = async () => { h.calls.push('entry'); throw new Error('timeout'); };
  h.gateway.reconcileEntry = async () => ({ ...h.read(), order: { status: 'FAILED' } });
  await h.engine.tick(); await h.engine.tick(); assert.equal(h.calls.filter(c => c === 'entry').length, 1); await assert.rejects(h.engine.configure(owner, envelope));
});
test('development eligibility override is unavailable by default', async () => { const h = harness(); await h.arm(); assert.throws(() => h.engine.force(owner, 'LONG')); });
test('audit failure before entry prevents order submission', async () => {
  const h = harness(); await h.arm(); h.audit.append = () => { throw new Error('disk failed'); };
  await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); assert.equal(h.engine.session.armed, false);
});
test('audit failure after fill cannot prevent protective stop and disarm', async () => {
  const h = harness(); await h.arm(); const append = h.audit.append;
  h.audit.append = event => { if (event.action === 'ORDER_FILLED') throw new Error('disk failed'); append(event); };
  await h.engine.tick(); assert.ok(h.calls.includes('sl')); assert.equal(h.engine.session.armed, false); assert.ok(h.read().account.orders.some(o => o.kind === 'sl'));
});
test('partial emergency exit retries only after terminal outcome with unique close ids', async () => {
  const h = harness(); await h.arm(); h.gateway.confirmProtection = async () => null;
  const ids = []; h.gateway.close = async (address, id) => { ids.push(id); if (ids.length === 1) { h.setPosition({ ...h.read().position, szi: '0.01' }); return { ...h.read(), closed: false, order: { status: 'CANCELED' } }; } h.setPosition(null); return { ...h.read(), closed: true, order: { status: 'FILLED' } }; };
  await h.engine.tick(); assert.equal(ids.length, 2); assert.notEqual(ids[0], ids[1]); assert.equal(h.read().position, null);
});
test('unknown emergency exit outcome is never replayed', async () => {
  const h = harness(); await h.arm(); h.gateway.confirmProtection = async () => null;
  let exits = 0; h.gateway.close = async () => { exits++; return { ...h.read(), closed: false, order: { status: 'FAILED' } }; };
  h.gateway.reconcileEntry = async () => ({ ...h.read(), order: { status: 'FAILED' } });
  await h.engine.tick(); await h.engine.tick(); assert.equal(exits, 1);
});
test('restart with unprotected ETH position triggers reduce-only emergency exit', async () => {
  const h = harness(); await h.arm(); await h.engine.tick(); h.setOrders([]); h.audit.latest = () => structuredClone(h.engine.session);
  const restarted = new ExecutionSessionController({ gateway: h.gateway, context: async () => h.context, health: () => h.health, audit: h.audit, clock: h.now });
  await restarted.tick(); assert.ok(h.calls.includes('close')); assert.equal(h.read().position, null); assert.equal(restarted.session.armed, false);
});
test('after explicit close, completed session is flat and fully audited', async () => {
  const h = harness(); await h.arm(); await h.engine.tick(); await h.engine.closeNow(owner, true);
  assert.equal(h.engine.session.state, 'COMPLETED'); assert.equal(h.read().account.orders.length, 0);
  assert.ok(h.events.some(e => e.to === 'EXITING')); assert.ok(h.events.some(e => e.action === 'SESSION_COMPLETED'));
});
test('both directions still enforce stop and direction envelope', async () => {
  const h = harness(); await h.engine.configure(owner, { ...envelope, direction: 'SHORT_ONLY', stopLoss: 105, takeProfit: 90 }); await h.engine.arm(owner, true);
  await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); assert.equal(h.engine.session.decision.decision, 'NOT_ELIGIBLE');
});
test('external account ledger movements invalidate session baseline', async () => { const h = harness(); await h.arm(); h.gateway.movements = async () => [{}]; await h.engine.tick(); assert.equal(h.calls.includes('entry'), false); assert.equal(h.engine.session.state, 'EMERGENCY_STOPPED'); });
test('real gateway exit order is reduce-only and uses actual exchange size', async () => {
  let pos = { coin: 'ETH', szi: '-0.25', entryPx: '100', leverage: { value: 2 } }, sent;
  const info = { account: async () => ({ positions: pos ? [pos] : [], orders: [] }), markets: async () => [{ name: 'ETH', markPx: '100', asset: 1, szDecimals: 3 }], orderStatus: async () => ({ status: 'order', order: { status: 'filled', order: { oid: 7, sz: '0' } } }) };
  const exchange = { order: async input => { sent = input; pos = null; } };
  const gateway = new SessionGateway({ exchange, info, delay: async () => {} });
  assert.equal((await gateway.close(owner, '0x' + '1'.repeat(32))).closed, true); assert.equal(sent.orders[0].r, true); assert.equal(sent.orders[0].b, true); assert.equal(sent.orders[0].s, '0.25');
});
test('gateway protection requires reduce-only, correct side, trigger and enough size', () => {
  const gateway = new SessionGateway({}), position = { coin: 'ETH', szi: '0.3' }, read = { position, account: { orders: [{ coin: 'ETH', reduceOnly: true, isTrigger: true, triggerPx: '95', sz: '0.3', side: 'A', orderType: 'Stop Market' }] } };
  assert.ok(gateway.protection(read, 95, 'LONG')); read.account.orders[0].reduceOnly = false; assert.equal(gateway.protection(read, 95, 'LONG'), null);
});
test('STOP cancellation does not cancel unrelated ETH orders', async () => {
  let orders = [{ coin: 'ETH', oid: 1, cloid: 'ours', reduceOnly: false }, { coin: 'ETH', oid: 2, cloid: 'external', reduceOnly: false }, { coin: 'ETH', oid: 3, reduceOnly: true }], canceled;
  const info = { account: async () => ({ positions: [], orders }), markets: async () => [{ name: 'ETH', markPx: '100', asset: 1, szDecimals: 3 }] };
  const gateway = new SessionGateway({ info, exchange: { cancel: async request => { canceled = request; orders = orders.filter(order => !request.cancels.some(c => c.o === order.oid)); } } });
  await gateway.cancelEntries(owner, 'ours', 1); assert.deepEqual(canceled.cancels.map(c => c.o), [1]); assert.deepEqual(orders.map(o => o.oid), [2, 3]);
});
test('flat cleanup only removes this session protection', async () => {
  let orders = [{ coin: 'ETH', oid: 1, cloid: 'ours-stop', reduceOnly: true }, { coin: 'ETH', oid: 2, cloid: 'external', reduceOnly: true }];
  const info = { account: async () => ({ positions: [], orders }), markets: async () => [{ name: 'ETH', markPx: '100', asset: 1, szDecimals: 3 }] };
  const gateway = new SessionGateway({ info, exchange: { cancel: async request => { orders = orders.filter(order => !request.cancels.some(c => c.o === order.oid)); } } });
  const result = await gateway.cleanupFlat(owner, { cloids: ['ours-stop'] }); assert.deepEqual(orders.map(o => o.oid), [2]); assert.equal(result.clean, false);
});
test('socket loss reconnects and updates health only after a real data message', { timeout: 6000 }, async () => {
  const sockets = [], statuses = []; let updates = 0, reconnected;
  const connectedAgain = new Promise(resolve => { reconnected = resolve; });
  class Socket { constructor() { sockets.push(this); this.readyState = 1; if (sockets.length === 2) reconnected(); } send() {} close() {} }
  const client = new HyperliquidInfoClient(); const stop = client.watchMarket('ETH', () => updates++, s => statuses.push(s), Socket);
  sockets[0].onopen(); sockets[0].onmessage({ data: JSON.stringify({ channel: 'activeAssetCtx', data: { coin: 'ETH', ctx: { markPx: '100' } } }) });
  sockets[0].onclose(); assert.equal(statuses.at(-1), 'RECONNECTING'); assert.equal(updates, 1); await connectedAgain; assert.equal(sockets.length, 2); stop();
});
