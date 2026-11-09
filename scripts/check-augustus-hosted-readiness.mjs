import { hostedConfig } from '../server/augustus/hosted/config.js';
import { HostedStore } from '../server/augustus/hosted/store.js';
let store;
try {
  const config = hostedConfig();
  store = new HostedStore(config);
  await store.health();
  console.log(JSON.stringify({ configuration: true, persistence: true, executionEnabled: false, releaseReady: false, remaining: ['Hosted context collector validation', 'Hosted wallet isolation validation', 'Live protection recovery review'] }));
} catch (error) {
  const message = error.message.startsWith('Hosted configuration unavailable:') ? error.message : 'Persistence unavailable or unconfirmed; readiness blocked.';
  console.error(message); process.exitCode = 1;
} finally { await store?.pool.end(); }
