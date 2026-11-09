import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http as rpcTransport, parseAbi, verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { DEFAULT_RISK, TOKEN_CONTRACT_ADDRESS, TOKEN_CHAIN_ID, TOKEN_RPC_URL, MIN_HOLDER_BALANCE } from '../../src/augustus/config.js';
import { holderConfigurationErrors, isAddress, units } from '../../src/augustus/services/holderAccessService.js';
import { HyperliquidInfoClient } from '../../src/augustus/services/hyperliquidInfoClient.js';
import { dailyLossFromPortfolio } from './domain.js';
import { ResearchFeed } from './researchFeed.js';
import { SessionGateway } from './sessionGateway.js';
import { SessionAudit } from './sessionAudit.js';
import { ExecutionSessionController } from './sessionController.js';
import { SESSION_LIMITS } from './sessionPolicy.js';

// Loopback-only development service. No mainnet exchange URL is configurable.
const env = process.env;
if (env.HYPERLIQUID_NETWORK && env.HYPERLIQUID_NETWORK !== 'testnet') throw new Error('Only Hyperliquid TESTNET is enabled.');
const origin = env.AUGUSTUS_UI_ORIGIN || 'http://127.0.0.1:5175';
const tokenConfig = { TOKEN_CHAIN_ID: Number(env.TOKEN_CHAIN_ID || TOKEN_CHAIN_ID), TOKEN_CONTRACT_ADDRESS: env.TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS, MIN_HOLDER_BALANCE: env.MIN_HOLDER_BALANCE || MIN_HOLDER_BALANCE };
const rpcUrl = env.TOKEN_RPC_URL || TOKEN_RPC_URL;
const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']);
const rpc = createPublicClient({ transport: rpcTransport(rpcUrl, { timeout: 8000, retryCount: 0 }) });
const transport = new HttpTransport({ isTestnet: true, timeout: 10000 });
const sdkInfo = new InfoClient({ transport });
const info = new HyperliquidInfoClient();
const master = env.HYPERLIQUID_TESTNET_MASTER_ADDRESS || '';
let agent = null;
try { agent = env.HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY ? privateKeyToAccount(env.HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY) : null; }
catch { throw new Error('Invalid TESTNET agent key configuration. Value withheld.'); }
if (agent && master.toLowerCase() === agent.address.toLowerCase()) throw new Error('Master and agent addresses must differ. Never configure the main private key.');
const exchange = agent ? new ExchangeClient({ transport, wallet: agent, defaultExpiresAfter: () => Date.now() + 10000 }) : null;
const executionEnabled = env.AUGUSTUS_ENABLE_TESTNET_EXECUTION === 'true' && !!exchange && isAddress(master);
const sessions = new Map(), challenges = new Map();
const journalDir = fileURLToPath(new URL('../../work/augustus/', import.meta.url));
mkdirSync(journalDir, { recursive: true });
const journalPath = `${journalDir}execution-journal.local`;
// On restart, any unresolved submission locks new entries. No automated retries.
const journalStates = new Map();
let corruptJournal = false;
if (existsSync(journalPath)) for (const line of readFileSync(journalPath, 'utf8').split('\n').filter(Boolean)) {
  try { const entry = JSON.parse(line); if (entry.proposalId) journalStates.set(entry.proposalId, entry); } catch { corruptJournal = true; }
}
let uncertain = corruptJournal || [...journalStates.values()].some(entry => entry.status === 'SUBMITTED' || entry.uncertain === true);
const safe = message => Object.assign(new Error(message), { publicMessage: message });

async function holder(address) {
  const errors = holderConfigurationErrors(tokenConfig);
  if (errors.length) throw safe(errors.join('; '));
  if (await rpc.getChainId() !== tokenConfig.TOKEN_CHAIN_ID) throw safe('Token RPC network mismatch.');
  const [decimals, balance] = await Promise.all([
    rpc.readContract({ address: tokenConfig.TOKEN_CONTRACT_ADDRESS, abi, functionName: 'decimals' }),
    rpc.readContract({ address: tokenConfig.TOKEN_CONTRACT_ADDRESS, abi, functionName: 'balanceOf', args: [address] }),
  ]);
  if (balance < units(tokenConfig.MIN_HOLDER_BALANCE, decimals)) throw safe('Holder access denied.');
  return { granted: true, account: address, verifiedAt: Date.now(), chainId: tokenConfig.TOKEN_CHAIN_ID };
}

async function snapshot(address) {
  const [access, account, markets, agents, portfolio] = await Promise.all([
    holder(address), info.account(address), info.markets(),
    agent ? sdkInfo.extraAgents({ user: address }) : Promise.resolve([]),
    info.request({ type: 'portfolio', user: address }),
  ]);
  return { access, account, markets, dailyLossPercent: dailyLossFromPortfolio(portfolio), agentAuthorized: !!agent && address.toLowerCase() === master.toLowerCase() && agents.some(a => a.address.toLowerCase() === agent.address.toLowerCase() && (a.validUntil === null || a.validUntil > Date.now())), executionEnabled, uncertain };
}

const feed = new ResearchFeed();
const streamHealth = { connected: false, lastSeen: 0, status: 'DISCONNECTED' };
const stopMarketStream = info.watchMarket('ETH', ctx => { if (Number(ctx?.markPx) > 0) streamHealth.lastSeen = Date.now(); }, status => { streamHealth.status = status; streamHealth.connected = status === 'CONNECTED'; });
const stopResearchStream = feed.startLiquidations();
const sessionAudit = new SessionAudit(journalDir + 'session-events.local');
const execution = new ExecutionSessionController({
  gateway: new SessionGateway({ exchange, info, snapshot }), context: () => feed.read(), health: () => ({ ...streamHealth }), audit: sessionAudit,
  authActive: owner => [...sessions.values()].some(s => s.address.toLowerCase() === owner.toLowerCase() && s.expires > Date.now()),
  allowDevForce: env.NODE_ENV !== 'production' && env.AUGUSTUS_ALLOW_DEV_FORCE_ENTRY === 'true',
});
execution.start();

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
async function body(req) {
  let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 16384) throw safe('Request too large.'); }
  try { return JSON.parse(text || '{}'); } catch { throw safe('Invalid JSON.'); }
}

const pathlessMessage = error => error.publicMessage || (error.constructor === Error && !error.cause && /^[A-Za-z0-9 /.,:;()$%–→_-]{1,250}$/.test(error.message) ? error.message : 'Request failed safely. Reconcile TESTNET account before retrying.');
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Origin denied.' });
    if (!['127.0.0.1', 'localhost'].includes((req.headers.host || '').split(':')[0])) return json(res, 403, { error: 'Host denied.' });
    const path = new URL(req.url, origin).pathname.replace('/api/augustus', '');
    if (req.method === 'GET' && path === '/config') return json(res, 200, { ...tokenConfig, network: 'HYPERLIQUID TESTNET', executionEnabled, agentAddress: agent?.address || null, masterAddress: master || null, defaults: DEFAULT_RISK, sessionLimits: SESSION_LIMITS, devForceEnabled: execution.allowDevForce });
    const data = req.method === 'POST' ? await body(req) : {};
    // Prune expired authentication challenges and sessions.
    for (const [key, value] of challenges) if (value.expires < Date.now()) challenges.delete(key);
    for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
    if (req.method === 'POST' && path === '/challenge') {
      if (!isAddress(data.address) || challenges.size >= 100) throw safe('Valid wallet address required or challenge capacity reached.');
      const message = `AUGUSTUS92 local TESTNET session\nOrigin: ${origin}\nWallet: ${data.address.toLowerCase()}\nHolder chain: ${tokenConfig.TOKEN_CHAIN_ID}\nNonce: ${randomBytes(24).toString('hex')}\nExpires: ${Date.now() + 120000}\nAuthenticate only. This signature does not authorize an order.`;
      challenges.set(data.address.toLowerCase(), { message, expires: Date.now() + 120000 }); return json(res, 200, { message });
    }
    if (req.method === 'POST' && path === '/session') {
      const challenge = challenges.get(data.address?.toLowerCase()); challenges.delete(data.address?.toLowerCase());
      if (!challenge || challenge.expires < Date.now() || data.message !== challenge.message || !await verifyMessage({ address: data.address, message: challenge.message, signature: data.signature })) throw safe('Wallet authentication failed.');
      await holder(data.address);
      const token = randomBytes(32).toString('hex'); sessions.set(token, { address: data.address.toLowerCase(), expires: Date.now() + 15 * 60000 }); return json(res, 200, { token, expiresAt: Date.now() + 15 * 60000 });
    }
    const token = req.headers.authorization?.replace(/^Bearer /, ''), session = sessions.get(token);
    if (!session || session.expires <= Date.now()) return json(res, 401, { error: 'Authenticated wallet session required.' });
    if (req.method === 'POST' && path === '/logout') { if (execution.session.owner === session.address) await execution.stop(session.address).catch(() => {}); sessions.delete(token); return json(res, 200, { status: 'DISCONNECTED' }); }
    if (req.method === 'GET' && path === '/snapshot') return json(res, 200, await snapshot(session.address));
    if (['/proposal', '/approve', '/manage'].includes(path)) return json(res, 410, { error: 'Legacy execution disabled. Configure and ARM an ETH execution session.' });
    if (path === '/execution/status' && req.method === 'GET') {
      try { await holder(session.address); } catch { if (execution.session.owner === session.address) await execution.stop(session.address).catch(() => {}); throw safe('Holder access failed. Session stopped.'); }
      session.expires = Date.now() + 15 * 60000;
      execution.heartbeat(session.address);
      return json(res, 200, execution.status(session.address));
    }
    if (path === '/execution/configure' && req.method === 'POST') { await holder(session.address); return json(res, 200, await execution.configure(session.address, data)); }
    if (path === '/execution/arm' && req.method === 'POST') { await holder(session.address); return json(res, 200, await execution.arm(session.address, data.approved)); }
    if (path === '/execution/stop' && req.method === 'POST') return json(res, 200, await execution.stop(session.address));
    if (path === '/execution/close' && req.method === 'POST') return json(res, 200, await execution.closeNow(session.address, data.approved));
    if (path === '/execution/force' && req.method === 'POST') { await holder(session.address); execution.force(session.address, data.side); return json(res, 200, execution.status(session.address)); }
    return json(res, 404, { error: 'Unknown local service route.' });
  } catch (error) {
    // Never serialize SDK errors, stacks, signatures, secrets, or signed payloads.
    const domainError = pathlessMessage(error);
    return json(res, 400, { error: domainError });
  }
});
server.requestTimeout = 25000;
server.listen(8788, '127.0.0.1', () => console.log('AUGUSTUS92 local TESTNET service: http://127.0.0.1:8788 (execution ' + (executionEnabled ? 'enabled' : 'disabled') + ')'));

process.once('SIGINT', () => { execution.shutdown(); stopMarketStream(); stopResearchStream(); server.close(() => process.exit(0)); });
