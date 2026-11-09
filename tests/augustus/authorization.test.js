import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { approveAgent } from '@nktkas/hyperliquid/api/exchange';
import { authorizationPlan, approvalOnlyTransport, assertTypedApproval, AUTH_MASTER, AUTH_AGENT } from '../../server/augustus/authorizationFlow.js';

test('authorization plan pins master, agent, TESTNET and a 24-hour expiry', () => {
  const plan = authorizationPlan(1800000000000);
  assert.equal(plan.masterAddress, AUTH_MASTER); assert.equal(plan.agentAddress, AUTH_AGENT);
  assert.equal(plan.hyperliquidChain, 'Testnet'); assert.equal(plan.expiresAt, 1800000000000 + 86400000);
  assert.equal(plan.orders, false); assert.equal(plan.transfers, false); assert.equal(plan.executionEnabled, false);
});
test('authorization transport rejects mainnet, trading and transfer requests', () => {
  const plan = authorizationPlan(); let sends = 0;
  assert.throws(() => approvalOnlyTransport({ isTestnet: false }, plan));
  const transport = approvalOnlyTransport({ isTestnet: true, request: () => { sends++; } }, plan);
  for (const type of ['order', 'cancel', 'usdSend', 'withdraw3', 'approveBuilderFee']) assert.throws(() => transport.request('exchange', { action: { type } }));
  assert.throws(() => transport.request('info', { type: 'allMids' })); assert.equal(sends, 0);
});
test('SDK generates only the pinned TESTNET EIP-712 approveAgent action (mocked transport)', async () => {
  const plan = authorizationPlan(); let signed = 0, sent = 0;
  const transport = approvalOnlyTransport({ isTestnet: true, request: async (endpoint, payload) => { sent++; assert.equal(endpoint, 'exchange'); assert.equal(payload.action.type, 'approveAgent'); assert.equal(payload.action.hyperliquidChain, 'Testnet'); assert.equal(payload.action.agentAddress.toLowerCase(), AUTH_AGENT.toLowerCase()); return { status: 'ok', response: { type: 'default' } }; } }, plan);
  const wallet = { address: AUTH_MASTER, signTypedData: async data => { assertTypedApproval(data, plan, '0x1237'); signed++; return '0x' + '1'.repeat(128) + '1b'; } };
  await approveAgent({ transport, wallet, signatureChainId: '0x1237' }, { agentAddress: AUTH_AGENT, agentName: plan.agentName });
  assert.equal(signed, 1); assert.equal(sent, 1);
});
test('wrong agent or mainnet typed requests are rejected before signing', () => {
  const plan = authorizationPlan();
  assert.throws(() => assertTypedApproval({ primaryType: 'HyperliquidTransaction:ApproveAgent', domain: { chainId: 4663 }, message: { hyperliquidChain: 'Mainnet', agentAddress: AUTH_AGENT, agentName: plan.agentName } }, plan, '0x1237'));
});
test('dry-run exits with a public manifest and no authorization', () => {
  const output = execFileSync(process.execPath, ['scripts/authorize-augustus-agent.mjs', '--dry-run'], { encoding: 'utf8' });
  const data = JSON.parse(output); assert.equal(data.mode, 'DRY_RUN'); assert.equal(data.authorizationSent, false); assert.equal(data.agentAddress, AUTH_AGENT);
});
