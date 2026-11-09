import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { AUTH_MASTER } from '../../server/augustus/authorizationFlow.js';
const run = args => spawnSync(process.execPath, ['scripts/prepare-augustus-testnet-funding.mjs', ...args], { encoding: 'utf8', timeout: 10000 });
test('funding preview is offline, TESTNET-only, unsigned and pinned to Augustus master and 10 mock USDC', () => {
  const result = run(['--dry-run']); assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.target, AUTH_MASTER); assert.equal(data.amount, '10');
  assert.equal(data.typedData.message.hyperliquidChain, 'Testnet');
  assert.equal(data.typedData.message.destination, AUTH_MASTER.toLowerCase());
  assert.equal(data.typedData.domain.chainId, 421614);
  assert.equal(data.signed, false); assert.equal(data.submitted, false);
  assert.equal(data.executionEnabled, false); assert.equal(data.approvalRequired, true);
});
test('funding utility rejects execution, mainnet, destination overrides and preparation without sender', () => {
  for (const args of [['--execute'], ['--mainnet'], ['--target', AUTH_MASTER], ['--prepare'], ['--sender'], ['--dry-run', '--amount', '1000']]) {
    const result = run(args); assert.equal(result.status, 1); assert.equal(result.stdout, '');
  }
});
