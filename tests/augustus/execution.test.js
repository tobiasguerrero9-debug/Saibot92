import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RISK } from '../../src/augustus/config.js';
import { ExecutionGuard, makeProposal } from '../../server/augustus/domain.js';
import { executeApprovedProposal } from '../../server/augustus/executeProposal.js';

function harness() {
  const address = '0x1111111111111111111111111111111111111111';
  const market = { asset: 1, name: 'ETH', markPx: '100', maxLeverage: 25, szDecimals: 3, receivedAt: Date.now() };
  const account = { address, equity: 1000, availableMargin: 1000, positions: [], orders: [], receivedAt: Date.now() };
  const snap = { markets: [market], account, access: { granted: true, account: address, verifiedAt: Date.now() }, agentAuthorized: true, dailyLossPercent: 0 };
  const proposal = makeProposal({ symbol: 'ETH', side: 'LONG', orderType: 'market', stop: 95, target: 110, leverage: 2 }, snap, DEFAULT_RISK, address);
  const writes = [], audit = [], flags = [];
  const deps = { stored: { proposal, settings: DEFAULT_RISK }, address, snapshot: async () => snap, exchange: { updateLeverage: async data => { writes.push(['leverage', data]); }, order: async (data, options) => { writes.push(['order', data, options]); return { status: 'ok', response: { data: { statuses: [{ filled: { oid: 42, totalSz: String(proposal.size), avgPx: '100' } }, 'waitingForFill', 'waitingForTrigger'] } } }; } }, info: { orderStatus: async () => ({ status: 'order', order: { status: 'filled', order: { oid: 42, sz: '0' } } }), account: async () => ({ ...account, positions: [{ coin: 'ETH', szi: String(proposal.size) }], orders: [{ coin: 'ETH', reduceOnly: true, isTrigger: true, triggerPx: String(proposal.stop) }] }) }, audit: row => audit.push(row), setUncertain: flag => flags.push(flag), executionEnabled: true, uncertain: false };
  return { deps, snap, writes, audit, flags };
}
test('mocked approved flow sizes, sends bracket, verifies order and position, and journals', async () => {
  const h = harness(), guard = new ExecutionGuard();
  const result = await guard.run(h.deps.stored.proposal.id, true, () => executeApprovedProposal(h.deps));
  assert.equal(result.status, 'FILLED'); assert.equal(result.protectionVerified, true); assert.equal(result.uncertain, false);
  const [, order, options] = h.writes.find(([method]) => method === 'order');
  assert.equal(order.grouping, 'normalTpsl'); assert.equal(order.orders.length, 3);
  assert.equal(order.orders[0].r, false); assert.equal(order.orders[1].r, true); assert.equal(order.orders[2].r, true);
  assert.equal(order.orders[1].t.trigger.tpsl, 'sl'); assert.equal(order.orders[2].t.trigger.tpsl, 'tp');
  assert.equal(options.expiresAfter, h.deps.stored.proposal.expiresAt);
  assert.deepEqual(h.flags, [true, false]); assert.equal(h.audit[0].userApproval, true);
  await assert.rejects(guard.run(h.deps.stored.proposal.id, true, () => executeApprovedProposal(h.deps)));
});
test('no execution adapter call without explicit approval', async () => {
  const h = harness(); await assert.rejects(new ExecutionGuard().run('p', false, () => executeApprovedProposal(h.deps))); assert.equal(h.writes.length, 0);
});
test('risk rejection before exchange calls', async () => {
  const h = harness(); h.snap.agentAuthorized = false;
  assert.equal((await executeApprovedProposal(h.deps)).status, 'REJECTED'); assert.equal(h.writes.length, 0);
});
test('risk is rechecked after leverage update before order', async () => {
  const h = harness(); let count = 0;
  h.deps.snapshot = async () => { if (++count > 1) h.snap.account.availableMargin = 0; return h.snap; };
  assert.equal((await executeApprovedProposal(h.deps)).status, 'REJECTED'); assert.equal(h.writes.length, 1);
});
test('unknown order reconciliation halts further entries', async () => {
  const h = harness(); h.deps.info.orderStatus = async () => ({ status: 'unknownOid' });
  const result = await executeApprovedProposal(h.deps); assert.equal(result.uncertain, true); assert.equal(result.status, 'FAILED');
});
test('missing stop verification after fill halts further entries', async () => {
  const h = harness(); h.deps.info.account = async () => ({ ...h.snap.account, positions: [{ coin: 'ETH', szi: '1' }], orders: [] });
  const result = await executeApprovedProposal(h.deps); assert.equal(result.protectionVerified, false); assert.equal(result.uncertain, true);
});
test('timeout does not retry and preserves submitted audit status', async () => {
  const h = harness(); let sends = 0; h.deps.exchange.order = async () => { sends++; throw new Error('timeout'); };
  await assert.rejects(executeApprovedProposal(h.deps)); assert.equal(sends, 1); assert.equal(h.audit.at(-1).status, 'SUBMITTED'); assert.equal(h.flags.at(-1), true);
});
test('testnet disabled and uncertain prior submission reject', async () => {
  for (const changes of [{ executionEnabled: false }, { uncertain: true }]) {
    const h = harness(); Object.assign(h.deps, changes); await assert.rejects(executeApprovedProposal(h.deps)); assert.equal(h.writes.length, 0);
  }
});
