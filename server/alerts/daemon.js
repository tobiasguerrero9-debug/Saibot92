import { safePersistenceError } from './reliability.js';

// A stuck cycle must end the process, never overlap a still-running transaction.
export async function guardedCycle(worker, { deadlineMs = 45000, onFrozen = () => process.exit(1) } = {}) {
  let timer;
  try {
    return await Promise.race([worker.cycle(), new Promise((_, reject) => {
      timer = setTimeout(() => { onFrozen(); reject(Object.assign(Error('Alerts cycle watchdog expired'), { code: 'WATCHDOG' })); }, deadlineMs);
    })]);
  } finally { clearTimeout(timer); }
}

export async function runAlertsDaemon({ worker, stopping = () => false, log = record => console.log(JSON.stringify(record)),
  clock = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), cycle = () => guardedCycle(worker) }) {
  let state = 'RECOVERING', lastSuccess = null;
  do {
    const started = clock(); let retryMs = 30000;
    log({ event: 'ALERTS_HEARTBEAT', state, phase: 'STARTING_SCAN', timestamp: started, lastSuccess });
    try {
      const result = await cycle();
      state = result.state || (result.committed ? 'ONLINE' : 'RECOVERING');
      if (result.committed && state === 'ONLINE') lastSuccess = clock();
      log({ event: 'ALERTS_SCAN', state, committed: result.committed === true, skipped: result.skipped === true,
        events: result.events || 0, durationMs: clock() - started, lastSuccess,
        rssBytes: process.memoryUsage().rss, cpuMicros: process.cpuUsage() });
    } catch (error) {
      if (error.code === 'WATCHDOG') throw error;
      state = 'OFFLINE'; const safe = safePersistenceError(error);
      retryMs = Math.max(30000, Math.min(300000, (error.retryAfterSeconds || 30) * 1000));
      log({ event: 'ALERTS_PERSISTENCE_UNAVAILABLE', state, code: safe.code, retryAfterMs: retryMs, lastSuccess });
    }
    const until = Math.max(started + 30000, clock() + (state === 'OFFLINE' ? retryMs : 0));
    while (!stopping() && clock() < until) {
      await sleep(Math.min(1000, until - clock()));
      if (clock() - started >= 30000 && state === 'OFFLINE' && clock() % 30000 < 1000)
        log({ event: 'ALERTS_HEARTBEAT', state: 'RECOVERING', phase: 'BACKOFF', retryAt: until, lastSuccess });
    }
    if (state === 'OFFLINE') state = 'RECOVERING';
  } while (!stopping());
}
