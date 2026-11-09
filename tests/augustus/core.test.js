import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RISK } from '../../src/augustus/config.js';
import { units, verifyHolder } from '../../src/augustus/services/holderAccessService.js';
import { sizePosition } from '../../src/augustus/risk/positionSizer.js';
import { evaluateRisk } from '../../src/augustus/risk/riskEngine.js';
import { transitionState } from '../../src/augustus/state/augustusState.js';
import { parseExecutionResponse, parseOrderStatus } from '../../src/augustus/execution/responseParser.js';
import { HyperliquidInfoClient } from '../../src/augustus/services/hyperliquidInfoClient.js';
import { ExecutionGuard, makeProposal, dailyLossFromPortfolio } from '../../server/augustus/domain.js';

const account = '0x1111111111111111111111111111111111111111';
const config = { TOKEN_CHAIN_ID: 4663, TOKEN_CONTRACT_ADDRESS: '0x7673a00106c99d1e00b85496f9f495076873b654', MIN_HOLDER_BALANCE: '1' };
const hex = value => `0x${BigInt(value).toString(16).padStart(64, '0')}`;
function wallet(balance, decimals = 6, chain = '0x1237') {
  return { request: async ({ method, params }) => {
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_accounts') return [account];
    if (method === 'eth_call') return params[0].data === '0x313ce567' ? hex(decimals) : hex(balance);
    throw new Error('Unexpected RPC method');
  } };
}
const now = 1700000000000;
function fixture() {
  const sizing = sizePosition({ accountEquity: 1000, availableMargin: 1000, entry: 100, stop: 95, riskPercent: 0.5, leverage: 2, maxNotional: 100, szDecimals: 3 });
  return { proposal: { id: 'proposal', symbol: 'ETH', side: 'LONG', orderType: 'market', entry: 100, stop: 95, target: 110, leverage: 2, expiresAt: now + 30000, ...sizing }, account: { address: account, equity: 1000, availableMargin: 1000, positions: [], orders: [], receivedAt: now }, market: { name: 'ETH', markPx: '100', maxLeverage: 10, szDecimals: 3, receivedAt: now }, access: { granted: true, account, verifiedAt: now }, walletConnected: true, hyperliquidAvailable: true, agentAuthorized: true, dailyLossPercent: 0, settings: { ...DEFAULT_RISK }, now };
}

test('one whole token uses contract decimals, never one raw unit', async () => {
  assert.equal((await verifyHolder(wallet(999999), account, config)).granted, false);
  assert.equal((await verifyHolder(wallet(1000000), account, config)).granted, true);
  assert.equal((await verifyHolder(wallet(1), account, config)).granted, false);
  assert.equal((await verifyHolder(wallet(10n ** 18n, 18), account, config)).granted, true);
});
test('missing token config fails closed', async () => { assert.equal((await verifyHolder(wallet(100), account, {})).granted, false); });
test('wrong chain and disconnected wallet fail closed', async () => {
  assert.equal((await verifyHolder(wallet(1000000, 6, '0x1'), account, config)).status, 'WRONG_NETWORK');
  assert.equal((await verifyHolder(null, account, config)).granted, false);
});
test('wallet network changes during verification revoke result', async () => {
  let reads = 0; const provider = wallet(1000000); const request = provider.request;
  provider.request = args => args.method === 'eth_chainId' ? Promise.resolve(++reads === 1 ? '0x1237' : '0x1') : request(args);
  assert.equal((await verifyHolder(provider, account, config)).granted, false);
});
test('bad token response and invalid decimal precision reject', async () => {
  await assert.rejects(verifyHolder(wallet(1, 99), account, config));
  assert.throws(() => units('0.001', 2));
  const provider = wallet(1); const request = provider.request; provider.request = args => args.method === 'eth_call' ? Promise.resolve('0x') : request(args);
  await assert.rejects(verifyHolder(provider, account, config));
});
test('risk sizing respects 0.5 percent, rounding, fees and margin', () => {
  const p = fixture().proposal;
  assert.ok(p.maxLoss <= 5); assert.ok(p.positionNotional <= 100); assert.ok(p.size > 0);
  const clamped = sizePosition({ accountEquity: 10000, availableMargin: 10, entry: 100, stop: 90, riskPercent: 0.5, leverage: 2, maxNotional: 1000, szDecimals: 3 });
  assert.ok(clamped.positionNotional <= 20);
});
test('zero/NaN/infinite values, zero stop distance and dust sizes reject', () => {
  for (const entry of [0, NaN, Infinity, 95]) assert.throws(() => sizePosition({ accountEquity: 1000, availableMargin: 100, entry, stop: 95, riskPercent: 0.5, leverage: 2, maxNotional: 100, szDecimals: 3 }));
  assert.throws(() => sizePosition({ accountEquity: 1, availableMargin: 1, entry: 100000, stop: 95000, riskPercent: 0.5, leverage: 1, maxNotional: 1, szDecimals: 1 }));
});
test('valid deterministic proposal is allowed', () => { assert.equal(evaluateRisk(fixture()).decision, 'ALLOW'); });
for (const [name, mutate] of [
  ['holder gate', f => { f.access.granted = false; }],
  ['holder address mismatch', f => { f.access.account = '0x2222222222222222222222222222222222222222'; }],
  ['expired holder verification', f => { f.access.verifiedAt -= 31000; }],
  ['wallet disconnected', f => { f.walletConnected = false; }],
  ['Hyperliquid offline', f => { f.hyperliquidAvailable = false; }],
  ['agent unauthorized', f => { f.agentAuthorized = false; }],
  ['insufficient margin', f => { f.account.availableMargin = 1; }],
  ['leverage maximum', f => { f.proposal.leverage = 100; }],
  ['missing stop', f => { f.proposal.stop = null; }],
  ['invalid stop direction', f => { f.proposal.stop = 101; }],
  ['invalid target direction', f => { f.proposal.target = 90; }],
  ['symbol allowlist', f => { f.settings.allowedMarkets = ['BTC']; }],
  ['daily loss', f => { f.dailyLossPercent = 2; }],
  ['unknown daily loss', f => { f.dailyLossPercent = null; }],
  ['concurrent positions', f => { f.account.positions = [{}]; }],
  ['pending entry order', f => { f.account.orders = [{ reduceOnly: false }]; }],
  ['stale price', f => { f.market.receivedAt -= 11000; }],
  ['future price timestamp', f => { f.market.receivedAt += 1; }],
  ['stale account', f => { f.account.receivedAt -= 11000; }],
  ['invalid size', f => { f.proposal.size = -1; }],
  ['inconsistent max loss', f => { f.proposal.maxLoss = 0.01; }],
  ['notional limit', f => { f.settings.maxPositionNotional = 10; }],
  ['expired proposal', f => { f.proposal.expiresAt = now; }],
  ['price moved', f => { f.market.markPx = '120'; }],
  ['risk settings invalid', f => { f.settings.maxLeverage = NaN; }],
]) test(`risk rejects ${name}`, () => { const f = fixture(); mutate(f); assert.equal(evaluateRisk(f).decision, 'REJECT'); });
test('state machine requires explicit approval path and cannot jump from LOCKED to EXECUTING', () => {
  assert.throws(() => transitionState('LOCKED', 'EXECUTING'));
  let state = 'LOCKED'; for (const next of ['DISCONNECTED', 'OBSERVING', 'ANALYZING', 'PROPOSAL_READY', 'AWAITING_APPROVAL', 'EXECUTING', 'POSITION_OPEN', 'MANAGING', 'EXITED']) state = transitionState(state, next);
  assert.equal(state, 'EXITED');
});
test('HTTP success without recognized exchange status is not a fill', () => {
  assert.equal(parseExecutionResponse({ status: 'ok' }).status, 'FAILED');
  assert.equal(parseExecutionResponse({ status: 'err', response: 'rejected' }).status, 'REJECTED');
  assert.equal(parseExecutionResponse({ status: 'ok', response: { data: { statuses: [{ error: 'margin' }] } } }).status, 'FAILED');
});
test('parse real exchange response shapes: resting, filled, partial, canceled and waiting', () => {
  const wrap = statuses => ({ status: 'ok', response: { data: { statuses } } });
  assert.equal(parseExecutionResponse(wrap([{ resting: { oid: 123 } }])).status, 'RESTING');
  assert.equal(parseExecutionResponse(wrap([{ filled: { oid: 123, totalSz: '1', avgPx: '100' } }])).status, 'FILLED');
  assert.equal(parseExecutionResponse(wrap(['waitingForFill'])).status, 'SUBMITTED');
  assert.equal(parseExecutionResponse(wrap(['success'])).status, 'CANCELED');
  assert.equal(parseOrderStatus({ status: 'order', order: { status: 'open', order: { oid: 123, sz: '0.5' } } }, 1).status, 'PARTIAL');
  assert.equal(parseOrderStatus({ status: 'unknownOid' }, 1).status, 'FAILED');
});
test('approval, duplicate click, parallel submission and ambiguous timeout are guarded', async () => {
  const guard = new ExecutionGuard(); let sends = 0;
  await assert.rejects(guard.run('a', false, async () => { sends++; }));
  let release; const running = guard.run('a', true, () => new Promise(resolve => { sends++; release = resolve; }));
  await assert.rejects(guard.run('a', true, async () => { sends++; }));
  await assert.rejects(guard.run('b', true, async () => { sends++; }));
  release(); await running;
  await assert.rejects(guard.run('a', true, async () => { sends++; }));
  await assert.rejects(guard.run('timeout', true, async () => { throw new Error('timeout'); }));
  await assert.rejects(guard.run('timeout', true, async () => { sends++; }));
  assert.equal(sends, 1);
});
test('read client uses testnet only and rejects inconsistent metadata', async () => {
  let url; const client = new HyperliquidInfoClient({ fetchImpl: async (requestUrl) => { url = requestUrl; return { ok: true, json: async () => [{ universe: [{ name: 'ETH' }] }, []] }; } });
  await assert.rejects(client.markets()); assert.equal(url, 'https://api.hyperliquid-testnet.xyz/info');
});
test('proposal is immutable, bounded, unique, and uses actual market/account inputs', () => {
  const f = fixture(), snap = { markets: [{ ...f.market, asset: 1 }], account: f.account };
  const input = { symbol: 'ETH', side: 'LONG', orderType: 'limit', entry: 100, stop: 95, target: 110, leverage: 2 };
  const first = makeProposal(input, snap, f.settings, account, now), second = makeProposal(input, snap, f.settings, account, now);
  assert.ok(Object.isFrozen(first)); assert.notEqual(first.id, second.id); assert.notEqual(first.cloid, second.cloid); assert.equal(first.expiresAt, now + 30000);
});
test('daily loss requires a sufficiently complete and fresh rolling-24h series', () => {
  assert.equal(dailyLossFromPortfolio([], now), null);
  assert.equal(dailyLossFromPortfolio([['perpDay', { accountValueHistory: [[now - 86400000, '1000'], [now, '970']], pnlHistory: [[now - 86400000, '0'], [now, '-30']] }]], now), 3);
});
