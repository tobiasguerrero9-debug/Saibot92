export const AUTH_MASTER = '0xB8e4D5f2Bb9ca611791b8f2655352A516630f07D';
export const AUTH_AGENT = '0x9b63Eb482641e24BCF6a54Ae8D33cc7FD4638E28';
export const AUTH_ENDPOINT = 'https://api.hyperliquid-testnet.xyz/exchange';

export function authorizationPlan(now = Date.now()) {
  const expiresAt = now + 24 * 60 * 60 * 1000;
  return { action: 'approveAgent', hyperliquidChain: 'Testnet', masterAddress: AUTH_MASTER, agentAddress: AUTH_AGENT, agentName: `AUGUSTUS92 valid_until ${expiresAt}`, expiresAt, expiresAtUtc: new Date(expiresAt).toISOString(), endpoint: AUTH_ENDPOINT, orders: false, transfers: false, executionEnabled: false, signing: 'Master wallet extension via local EIP-712 prompt; no master private key in application configuration.' };
}

export function assertApprovalAction(action, plan) {
  if (action?.type !== 'approveAgent' || action.hyperliquidChain !== 'Testnet' || action.agentAddress?.toLowerCase() !== AUTH_AGENT.toLowerCase() || action.agentName !== plan.agentName || !Number.isSafeInteger(action.nonce)) throw new Error('Authorization-only policy rejected action.');
  const allowed = ['type', 'hyperliquidChain', 'signatureChainId', 'agentAddress', 'agentName', 'nonce'];
  if (Object.keys(action).some(key => !allowed.includes(key))) throw new Error('Unexpected approval action fields.');
}

// Even an accidental SDK call cannot send an order or fund movement through this transport.
export function approvalOnlyTransport(base, plan) {
  if (base.isTestnet !== true) throw new Error('TESTNET transport required.');
  return { isTestnet: true, request(endpoint, payload, signal) {
    if (endpoint === 'exchange') {
      assertApprovalAction(payload?.action, plan);
      if (Object.keys(payload).some(key => !['action', 'nonce', 'signature'].includes(key)) || payload.nonce !== payload.action.nonce || !payload.signature) throw new Error('Unexpected authorization request envelope.');
    } else if (endpoint !== 'info' || payload?.type !== 'extraAgents' || payload.user?.toLowerCase() !== AUTH_MASTER.toLowerCase()) throw new Error('Only approval and read-only authorization verification are permitted.');
    return base.request(endpoint, payload, signal);
  } };
}

export function assertTypedApproval(typed, plan, chainId) {
  if (typed?.primaryType !== 'HyperliquidTransaction:ApproveAgent' || typed.message?.hyperliquidChain !== 'Testnet' || typed.message.agentAddress?.toLowerCase() !== AUTH_AGENT.toLowerCase() || typed.message.agentName !== plan.agentName || BigInt(typed.domain.chainId) !== BigInt(chainId)) throw new Error('Unexpected signing request.');
  if (typed.domain.name !== 'HyperliquidSignTransaction' || typed.domain.version !== '1' || typed.domain.verifyingContract !== '0x0000000000000000000000000000000000000000') throw new Error('Invalid approveAgent EIP-712 domain.');
  if (!Number.isSafeInteger(typed.message.nonce) || Math.abs(Date.now() - typed.message.nonce) > 180000) throw new Error('Invalid or stale approveAgent nonce.');
  const fields = [{ name: 'hyperliquidChain', type: 'string' }, { name: 'agentAddress', type: 'address' }, { name: 'agentName', type: 'string' }, { name: 'nonce', type: 'uint64' }];
  if (JSON.stringify(typed.types?.[typed.primaryType]) !== JSON.stringify(fields)) throw new Error('Invalid approveAgent typed-data field schema.');
}
