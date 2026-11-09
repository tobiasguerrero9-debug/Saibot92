import { randomUUID } from 'node:crypto';
import { hostedConfig } from '../server/augustus/hosted/config.js';
import { HostedStore } from '../server/augustus/hosted/store.js';
import { AgentVault } from '../server/augustus/hosted/agentVault.js';
import { HostedRuntime } from '../server/augustus/hosted/runtime.js';
import { ExecutionRepository } from '../server/augustus/hosted/executionRepository.js';
import { ExecutionRunner } from '../server/augustus/hosted/executionRunner.js';
let store, stopping = false;
const workerId = randomUUID(), zero = '0x0000000000000000000000000000000000000000';
try {
  const config = hostedConfig(); if (config.stage !== 'production') throw Error('Production worker required');
  store = new HostedStore(config); await store.health();
  const vault = new AgentVault(config), repository = new ExecutionRepository({ store, config }), runtime = new HostedRuntime({ store, vault, config });
  const runner = new ExecutionRunner({ repository, vault, context: () => store.transaction(zero, c => runtime.context(c)) });
  process.once('SIGTERM', () => { stopping = true; }); process.once('SIGINT', () => { stopping = true; });
  while (!stopping) {
    if (await repository.leader(workerId)) {
      let healthy = true, task;
      try {
        task = await repository.claim(workerId);
        if (task) {
          // Lease extension runs independently while external reads/submissions wait.
          const renew = setInterval(() => { void repository.mutate(task.wallet, task.execution_id, workerId, () => null).then(() => repository.leader(workerId)).catch(() => {}); }, 3000);
          try { const result = await runner.run(task.wallet, task.execution_id, workerId); healthy = result.healthy; await repository.release(task.wallet, task.execution_id, workerId, result.terminal, healthy); }
          finally { clearInterval(renew); }
        }
        // An unresolved managed incident keeps the global gate closed even when
        // this loop has no claimable task. Worker liveness alone is insufficient.
        const pending = await store.transaction(zero, async c => (await c.query("SELECT count(*) AS count FROM augustus_protection_queue WHERE active=true AND (fault=true OR last_checked_at<now()-interval '10 seconds')")).rows[0]);
        if (Number(pending.count) > 0) healthy = false;
      } catch { healthy = false; if (task) await repository.release(task.wallet, task.execution_id, workerId, false, false).catch(() => {}); console.error('Protection reconciliation unavailable; new entry gate closed.'); }
      await repository.heartbeat(workerId, healthy);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
} catch { console.error('Protection worker unavailable; execution remains fail-closed.'); process.exitCode = 1; }
finally { if (store) { const repository = new ExecutionRepository({ store, config: {} }); await repository.heartbeat(workerId, false).catch(() => {}); await store.pool.end(); } }
