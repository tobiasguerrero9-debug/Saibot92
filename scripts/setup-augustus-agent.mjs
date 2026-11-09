import { writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { isAddress } from '../src/augustus/services/holderAccessService.js';
import { TOKEN_CHAIN_ID, TOKEN_CONTRACT_ADDRESS, TOKEN_RPC_URL, MIN_HOLDER_BALANCE } from '../src/augustus/config.js';

const master = process.argv[2];
if (!isAddress(master)) throw new Error('Usage: node scripts/setup-augustus-agent.mjs <PUBLIC_FUNDED_TESTNET_MASTER_ADDRESS>');
const key = generatePrivateKey();
const agent = privateKeyToAccount(key);
const config = `TOKEN_CHAIN_ID=${TOKEN_CHAIN_ID}\nTOKEN_CONTRACT_ADDRESS=${TOKEN_CONTRACT_ADDRESS}\nTOKEN_RPC_URL=${TOKEN_RPC_URL}\nMIN_HOLDER_BALANCE=${MIN_HOLDER_BALANCE}\nAUGUSTUS_UI_ORIGIN=http://127.0.0.1:5175\nHYPERLIQUID_TESTNET_MASTER_ADDRESS=${master}\nHYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY=${key}\nAUGUSTUS_ENABLE_TESTNET_EXECUTION=false\nHYPERLIQUID_NETWORK=testnet\nAUGUSTUS_ALLOW_DEV_FORCE_ENTRY=false\n`;
// Exclusive creation: never overwrite an existing key/config. Never print the private key.
writeFileSync(new URL('../server/augustus/.env.local', import.meta.url), config, { flag: 'wx', mode: 0o600 });
console.log(`Created excluded local TESTNET agent configuration.\nAgent PUBLIC address: ${agent.address}\nAuthorize this named agent from your master wallet in https://app.hyperliquid-testnet.xyz/ before enabling execution.\nExecution remains disabled. Never paste or commit the private key.`);
