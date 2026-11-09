import { randomUUID } from 'node:crypto';
import { hostedConfig } from '../server/augustus/hosted/config.js';
import { HostedStore } from '../server/augustus/hosted/store.js';
import { MainnetContextFeed, validateLiveContext } from '../server/augustus/mainnetContext.js';
let store, stopFeed, stopping = false;
try {
  const config = hostedConfig();
  if (config.stage !== 'production') throw Error('Production daemon scope required');
  store = new HostedStore(config); await store.health();
  const feed = new MainnetContextFeed(), holder = randomUUID(), zero = '0x0000000000000000000000000000000000000000';
  const previous = await store.transaction(zero, async c => (await c.query('SELECT payload FROM augustus_context ORDER BY observed_at DESC LIMIT 1')).rows[0]?.payload);
  const history = previous?._history?.filter(s => Number.isFinite(s.timestamp) && s.timestamp <= Date.now() && Date.now() - s.timestamp < 420000);
  if (history?.length) feed.feed.memory.historyMap.set('ETHUSDT', history);
  stopFeed = feed.start();
  const halt = () => { stopping = true; stopFeed?.(); }; process.once('SIGTERM', halt); process.once('SIGINT', halt);
  while (!stopping) {
    let observed;
    try {
      const context = await feed.read();
      observed = { historyReady: context.whatChanged?.hasHistory === true, liquidationStreamReady: context.liquidationContext?.status === 'OBSERVING' };
      validateLiveContext(context);
      const payload = { ...context, _history: feed.feed.memory.historyMap.get('ETHUSDT') || [] };
      await store.transaction(zero, async c => {
        const lease = await c.query("INSERT INTO augustus_worker_leases(name,holder,expires_at) VALUES('eth-context',$1,now()+interval '15 seconds') ON CONFLICT(name) DO UPDATE SET holder=EXCLUDED.holder,expires_at=EXCLUDED.expires_at WHERE augustus_worker_leases.expires_at<now() OR augustus_worker_leases.holder=$1 RETURNING holder", [holder]);
        if (!lease.rows.length) return;
        await c.query('INSERT INTO augustus_context(observed_at,payload,worker_healthy) VALUES($1,$2,true)', [new Date(context.timestamp), JSON.stringify(payload)]);
        await c.query("DELETE FROM augustus_context WHERE observed_at<now()-interval '15 minutes'");
      });
    } catch (error) {
      // Emit only an allowlisted category/status, never arbitrary error objects
      // or messages (database errors may contain connection credentials).
      const message = String(error?.message || ''), http = message.match(/^HTTP error (\d{3}) fetching /);
      const reason = http ? 'PUBLIC_TELEMETRY_HTTP_' + http[1] : message.startsWith('SAIBOT92 context incomplete:') ? 'CONTEXT_OBSERVATIONS_INCOMPLETE' : message.startsWith('Persistence unavailable') ? 'PERSISTENCE_UNAVAILABLE' : 'CONTEXT_READ_UNAVAILABLE';
      console.error(JSON.stringify({ event: 'AUGUSTUS_CONTEXT_UNAVAILABLE', reason, ...observed }));
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
} catch { console.error('Hosted context daemon did not start; verify scoped environment and migrations.'); process.exitCode = 1; }
finally { stopFeed?.(); await store?.pool.end(); }
