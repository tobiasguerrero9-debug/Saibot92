import { recoverTypedSignature, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { assertTypedApproval } from './authorizationFlow.js';

// MetaMask V4 supports Hyperliquid's colon-containing primary type. Do not rename
// it: doing so would change the signed digest and invalidate the authorization.
export function recoverApprovalSigner(typedData, plan, chainId, signature) {
  assertTypedApproval(typedData, plan, chainId);
  if (!/^0x[0-9a-f]{130}$/i.test(signature || '')) throw Error('Invalid signature format: expected 65-byte hexadecimal signature.');
  return recoverTypedSignature({ data: typedData, signature, version: SignTypedDataVersion.V4 });
}

export function safeAuthorizationError(error) {
  // Return only short technical messages. Never serialize errors, causes, stacks,
  // SDK request bodies, typed payloads or signatures.
  const message = String(error?.shortMessage || error?.message || 'Unknown authorization error').split('\n')[0]
    .replace(/0x[0-9a-f]{64,}/gi, '[redacted cryptographic data]')
    .replace(/(private.?key|seed.?phrase|mnemonic)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 300);
  return { name: String(error?.name || 'Error').replace(/[^a-z0-9_]/gi, '').slice(0, 60), message };
}
