import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { AUTH_MASTER, AUTH_AGENT } from '../../server/augustus/authorizationFlow.js';

const source = readFileSync(new URL('../../scripts/augustus-authorization-client.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function harness({ accounts = [AUTH_MASTER], walletError, injected = true } = {}) {
  const elements = new Map(['status', 'approve', 'diagnostics', 'debug', 'plan'].map(id => [id, { textContent: '', disabled: false, addEventListener(name, fn) { this[name] = fn; } }]));
  const methods = [], paths = []; let phase = 'READY';
  const typedData = { primaryType: 'HyperliquidTransaction:ApproveAgent', domain: { chainId: 4663 }, message: { hyperliquidChain: 'Testnet', agentAddress: AUTH_AGENT } };
  const provider = { isMetaMask: true, request: async ({ method }) => {
    methods.push(method);
    if (method === 'eth_accounts') return accounts;
    if (method === 'eth_requestAccounts') return [AUTH_MASTER];
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_signTypedData_v4') { if (walletError) throw walletError; return new Promise(() => {}); }
    throw Error('Unexpected method');
  } };
  const context = vm.createContext({ document: { getElementById: id => elements.get(id) }, window: { ...(injected ? { ethereum: provider } : {}), addEventListener() {}, dispatchEvent() {} }, Event: class {}, AbortSignal, Date, setTimeout: (fn, ms) => { if (ms === 500) return 0; return { unref() {} }; }, clearTimeout() {}, fetch: async (url, options) => {
    paths.push(url);
    if (url.endsWith('/start')) { assert.equal(JSON.parse(options.body).address, AUTH_MASTER); phase = 'SIGNATURE_REQUIRED'; }
    if (url.endsWith('/cancel')) phase = 'CANCELED';
    return { ok: true, json: async () => ({ phase, plan: { agentAddress: AUTH_AGENT, executionEnabled: false }, typedData }) };
  } });
  vm.runInContext('const csrf="test-only", master=' + JSON.stringify(AUTH_MASTER) + ';\n' + source, context);
  await flush(); return { elements, methods, paths };
}
test('page attaches click handler, enables READY without funding and reaches EIP712 only after click', async () => {
  const h = await harness(); const button = h.elements.get('approve');
  assert.equal(button.disabled, false); assert.equal(typeof button.click, 'function');
  assert.deepEqual(h.methods, ['eth_accounts']);
  void button.click(); await flush();
  assert.ok(h.methods.includes('eth_signTypedData_v4'));
  assert.ok(h.elements.get('debug').textContent.includes('CLICK RECEIVED'));
  assert.ok(h.elements.get('debug').textContent.includes('MASTER MATCHED'));
  assert.ok(h.elements.get('debug').textContent.includes('REQUESTING SIGNATURE'));
  assert.equal(h.paths.includes('/api/signature'), false);
});
test('wallet rejection is visible and no signature is submitted', async () => {
  const h = await harness({ walletError: { code: -32002, message: 'Request already pending' } });
  await h.elements.get('approve').click();
  assert.match(h.elements.get('debug').textContent, /-32002.*Request already pending/);
  assert.equal(h.paths.includes('/api/signature'), false);
});
test('missing injection produces visible error on click instead of a silent disabled button', async () => {
  const h = await harness({ injected: false });
  assert.equal(h.elements.get('approve').disabled, false);
  await h.elements.get('approve').click();
  assert.match(h.elements.get('status').textContent, /ERROR:.*provider unavailable/);
  assert.equal(h.paths.includes('/api/start'), false);
});
test('disconnected wallet requests connection before signing', async () => {
  const h = await harness({ accounts: [] });
  await h.elements.get('approve').click();
  assert.ok(h.methods.includes('eth_requestAccounts'));
  // Passive recheck correctly rejects an account that disappears before signing.
  assert.equal(h.paths.includes('/api/signature'), false);
});
