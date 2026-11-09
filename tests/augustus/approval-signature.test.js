import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { privateKeyToAccount } from 'viem/accounts';
import { hashTypedData } from 'viem';
import { approveAgent, ApproveAgentRequest } from '@nktkas/hyperliquid/api/exchange';
import * as v from 'valibot';
import { authorizationPlan, approvalOnlyTransport, AUTH_AGENT } from '../../server/augustus/authorizationFlow.js';
import { recoverApprovalSigner, safeAuthorizationError } from '../../server/augustus/approvalSignature.js';

test('SDK → MetaMask V4 → local recovery → SDK envelope works without network or real wallet credentials', async () => {
  // Ephemeral test signer, never persisted or printed. Production still pins AUTH_MASTER.
  const key = randomBytes(32), account = privateKeyToAccount('0x' + key.toString('hex'));
  const plan = authorizationPlan(); let sends = 0;
  const transport = approvalOnlyTransport({ isTestnet: true, request: async (endpoint, payload) => {
    assert.equal(endpoint, 'exchange'); v.parse(ApproveAgentRequest, payload);
    assert.equal(payload.action.hyperliquidChain, 'Testnet');
    assert.equal(payload.nonce, payload.action.nonce); sends++;
    return { status: 'ok', response: { type: 'default' } };
  } }, plan);
  try {
    await approveAgent({ transport, signatureChainId: '0x1237', wallet: { address: account.address, signTypedData: async data => {
      // Reproduce the previous local HTTP 400 precisely.
      assert.throws(() => hashTypedData(data), /Struct type.*invalid/);
      const browserData = JSON.parse(JSON.stringify(data));
      const signature = signTypedData({ privateKey: key, data: browserData, version: SignTypedDataVersion.V4 });
      assert.equal(recoverApprovalSigner(browserData, plan, '0x1237', signature).toLowerCase(), account.address.toLowerCase());
      assert.throws(() => recoverApprovalSigner({ ...browserData, domain: { ...browserData.domain, name: 'Wrong' } }, plan, '0x1237', signature), /domain/);
      return signature;
    } } }, { agentAddress: AUTH_AGENT, agentName: plan.agentName });
    assert.equal(sends, 1);
  } finally { key.fill(0); }
});
test('safe technical error strips cryptographic material and does not serialize error payloads', () => {
  const safe = safeAuthorizationError({ name: 'ValidationError', message: 'Invalid signature 0x' + 'a'.repeat(130), request: { signature: 'secret' } });
  assert.equal(safe.name, 'ValidationError'); assert.match(safe.message, /redacted/);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
});
