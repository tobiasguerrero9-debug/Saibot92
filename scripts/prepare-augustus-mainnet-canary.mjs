import { writeFileSync, mkdirSync } from 'node:fs';
import { MAINNET } from '../server/augustus/mainnetCanary.js';
import { MainnetAdapter } from '../server/augustus/mainnetAdapter.js';
import { MainnetContextFeed } from '../server/augustus/mainnetContext.js';
import { authorizationReadiness, prepareCrossLeverageUpdate } from '../server/augustus/mainnetAccountState.js';
if (process.argv.length !== 2) { console.error('Read-only inspection accepts no execution flags.'); process.exit(1); }
try {
  const adapter = new MainnetAdapter();
  const [snapshot, masterRole, agentRole] = await Promise.all([adapter.read(), adapter.info('userRole', { user: MAINNET.master }), adapter.info('userRole', { user: MAINNET.agent })]);
  let context = null;
  try { const response = await fetch('http://127.0.0.1:8791/api/augustus-canary/snapshot', { signal: AbortSignal.timeout(15000) }); const data = await response.json(); if (response.ok) context = data.context; } catch { /* Missing context blocks readiness. */ }
  const readiness = authorizationReadiness(snapshot, context);
  const report = { checkedAt: new Date().toISOString(), mode: 'MAINNET_CANARY', executionEnabled: false, master: MAINNET.master, agent: MAINNET.agent, masterRole, agentRole, snapshot, readiness, leverageReview: prepareCrossLeverageUpdate(snapshot), collateralPreparation: { required: snapshot.accountMode === 'unifiedAccount' ? false : null, action: null, reason: snapshot.accountMode === 'unifiedAccount' ? 'Unified USDC already collateralizes ETH CROSS trading. Do not perform usdClassTransfer.' : 'No collateral action prepared; inspect this account mode separately.' }, authorization: { prepared: false, signed: false, submitted: false, reason: 'No agent authorization until leverage normalization and readiness are confirmed.' }, signedActions: 0, ordersSubmitted: 0 };
  mkdirSync('work', { recursive: true }); writeFileSync('work/mainnet-canary-preflight.local', JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} catch (error) { console.error(JSON.stringify({ error: String(error.message).split('\n')[0].slice(0, 250), signed: false, submitted: false })); process.exitCode = 1; }
