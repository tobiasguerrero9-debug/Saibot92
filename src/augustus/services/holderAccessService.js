export const isAddress = value => /^0x[\da-f]{40}$/i.test(value || '') && !/^0x0{40}$/i.test(value);

export function units(value, decimals) {
  if (!/^\d+(\.\d+)?$/.test(String(value)) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token units.');
  const [whole, fraction = ''] = String(value).split('.');
  if (fraction.length > decimals) throw new Error('Minimum balance exceeds token precision.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}

export function holderConfigurationErrors(config) {
  const errors = [];
  if (!Number.isSafeInteger(config?.TOKEN_CHAIN_ID) || config.TOKEN_CHAIN_ID <= 0) errors.push('TOKEN_CHAIN_ID required');
  if (!isAddress(config?.TOKEN_CONTRACT_ADDRESS)) errors.push('TOKEN_CONTRACT_ADDRESS required');
  try { if (units(config?.MIN_HOLDER_BALANCE, 36) <= 0n) throw new Error(); } catch { errors.push('Positive MIN_HOLDER_BALANCE required'); }
  return errors;
}

// EIP-1193 public eth_call; no signature, transaction, private key or fake balance.
export async function verifyHolder(provider, account, config) {
  const errors = holderConfigurationErrors(config);
  if (errors.length) return { granted: false, status: 'CONFIGURATION_REQUIRED', reasons: errors };
  if (!provider || !isAddress(account)) return { granted: false, status: 'DISCONNECTED' };
  const chain = await provider.request({ method: 'eth_chainId' });
  if (Number(BigInt(chain)) !== config.TOKEN_CHAIN_ID) return { granted: false, status: 'WRONG_NETWORK' };
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!accounts.some(a => a.toLowerCase() === account.toLowerCase())) return { granted: false, status: 'DISCONNECTED' };
  const call = data => provider.request({ method: 'eth_call', params: [{ to: config.TOKEN_CONTRACT_ADDRESS, data }, 'latest'] });
  const [decimalHex, balanceHex] = await Promise.all([call('0x313ce567'), call(`0x70a08231${account.slice(2).toLowerCase().padStart(64, '0')}`)]);
  if (!/^0x[\da-f]{64}$/i.test(decimalHex) || !/^0x[\da-f]{64}$/i.test(balanceHex)) throw new Error('Invalid on-chain token response.');
  const decimals = Number(BigInt(decimalHex));
  const balance = BigInt(balanceHex);
  const granted = balance >= units(config.MIN_HOLDER_BALANCE, decimals);
  // Confirm network/account again after asynchronous RPC calls.
  const [afterChain, afterAccounts] = await Promise.all([provider.request({ method: 'eth_chainId' }), provider.request({ method: 'eth_accounts' })]);
  if (afterChain !== chain || !afterAccounts.some(a => a.toLowerCase() === account.toLowerCase())) return { granted: false, status: 'WALLET_CHANGED' };
  return { granted, status: granted ? 'ACCESS_GRANTED' : 'ACCESS_DENIED', account, chainId: config.TOKEN_CHAIN_ID, verifiedAt: Date.now() };
}
