import { readFileSync, existsSync } from 'node:fs';
import { usdSend } from '@nktkas/hyperliquid/api/exchange';
import { AUTH_MASTER, AUTH_AGENT } from '../server/augustus/authorizationFlow.js';

// Deliberately has no execute mode, wallet connection, signature or key loading.
const endpoint = 'https://api.hyperliquid-testnet.xyz';
const amount = '10';
const args = process.argv.slice(2);
const senderIndex = args.indexOf('--sender');
const sender = senderIndex >= 0 ? args[senderIndex + 1] : null;
const allowed = new Set(['--check', '--dry-run', '--prepare', '--sender']);
if (args.some((arg, i) => !(senderIndex >= 0 && i === senderIndex + 1) && !allowed.has(arg)) || (senderIndex >= 0 && !/^0x[0-9a-f]{40}$/i.test(sender || '')) || (args.includes('--prepare') && !sender) || (args.includes('--dry-run') && args.includes('--prepare'))) {
  console.error('Use --check, --dry-run, or --prepare --sender <PUBLIC_TESTNET_MASTER_ADDRESS>. No execution mode exists.');
  process.exit(1);
}
const proposal = { network: 'Testnet', endpoint: endpoint + '/exchange', action: 'usdSend', target: AUTH_MASTER, amount, asset: 'mock USDC', sender, approvalRequired: true, signed: false, submitted: false, executionEnabled: false };
async function info(type, user) {
  if (!['clearinghouseState', 'spotClearinghouseState', 'userRole'].includes(type)) throw Error('Read-only info type rejected.');
  const response = await fetch(endpoint + '/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, user }), signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok) throw Error('TESTNET info request failed: HTTP ' + response.status);
  return response.json();
}
async function balance(address) {
  const [perp, spot, role] = await Promise.all([info('clearinghouseState', address), info('spotClearinghouseState', address), info('userRole', address)]);
  if (!perp.marginSummary || !Array.isArray(spot.balances) || typeof role.role !== 'string') throw Error('Unexpected TESTNET balance response.');
  return { address, role: role.role, perpEquity: perp.marginSummary.accountValue, withdrawable: perp.withdrawable, spotUSDC: spot.balances.find(b => b.coin === 'USDC')?.total || '0' };
}
async function unsignedPreview() {
  let typedData;
  const stop = Error('Unsigned preparation complete.');
  try {
    await usdSend({ signatureChainId: '0x66eee', transport: { isTestnet: true, request() { throw Error('Sending is forbidden in this preparation tool.'); } }, wallet: { address: sender || AUTH_MASTER, signTypedData: async data => {
      if (data.message.hyperliquidChain !== 'Testnet' || data.message.destination.toLowerCase() !== AUTH_MASTER.toLowerCase() || data.message.amount !== amount) throw Error('Unsafe transfer preview rejected.');
      typedData = data; throw stop;
    } } }, { destination: AUTH_MASTER, amount });
  } catch { if (!typedData) throw Error('SDK could not construct the TESTNET transfer preview.'); }
  return typedData;
}
try {
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ ...proposal, mode: 'OFFLINE_UNSIGNED_PREVIEW', typedData: await unsignedPreview(), note: 'Preview only. Nonce must be regenerated before any future approved signing.' }, null, 2));
  } else {
    const addresses = new Set([AUTH_MASTER.toLowerCase(), AUTH_AGENT.toLowerCase()]);
    // Extract only complete public-address values from wallet/account configuration
    // fields. Do not output environment contents or read/use private-key values.
    for (const path of ['server/augustus/.env.local', '.env.local', '.env']) {
      if (!existsSync(path)) continue;
      for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]*(?:MASTER|ACCOUNT|WALLET|SENDER)[A-Z0-9_]*)\s*=\s*["']?(0x[0-9a-f]{40})["']?\s*$/i);
        if (match && !/KEY|TOKEN|CONTRACT/i.test(match[1])) addresses.add(match[2].toLowerCase());
      }
    }
    if (sender) addresses.add(sender.toLowerCase());
    const accounts = await Promise.all([...addresses].map(balance));
    const candidates = accounts.filter(a => ![AUTH_MASTER.toLowerCase(), AUTH_AGENT.toLowerCase()].includes(a.address) && a.role === 'user' && Number(a.withdrawable) >= Number(amount) + 1);
    const selected = sender ? candidates.find(a => a.address === sender.toLowerCase()) : null;
    const result = { ...proposal, mode: 'READ_ONLY_CHECK', checkedAt: new Date().toISOString(), accounts, eligibleSenderCandidates: candidates, blocker: candidates.length ? 'Sender control and explicit transfer approval required.' : 'No separately configured TESTNET master has sufficient transferable mock USDC. No transfer prepared for execution.' };
    if (args.includes('--prepare')) {
      if (!selected) throw Error('Sender must be a separate funded TESTNET master with at least 11 withdrawable mock USDC. No transfer signed or sent.');
      result.mode = 'UNSIGNED_TRANSFER_PREPARED'; result.typedData = await unsignedPreview();
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ error: String(error.message).split('\n')[0].replace(/0x[0-9a-f]{64,}/gi, '[redacted]').slice(0, 250), submitted: false }));
  process.exitCode = 1;
}
