import { getMarketUniverse } from '../../src/services/marketUniverseService.js';
import { scanSnapshot } from './engine.js';
export class AlertsWorker {
  constructor({ repository, load = signal => getMarketUniverse({ signal, strict: true }), clock = Date.now }) { Object.assign(this, { repository, load, clock }); this.pending = null; }
  cycle() {
    if (this.pending) return this.pending;
    this.pending = this.repository.cycle(async (prior, context) => {
      if (prior?.status?.lastScan && this.clock() - prior.status.lastScan < 25000) return null;
      const attemptStarted = this.clock();
      try {
        const controller = new AbortController();
        let timer;
        try {
          const markets = await Promise.race([this.load(controller.signal), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Scan timeout')); }, 15000); })]);
          const next = scanSnapshot(prior, markets, this.clock(), context);
          next.status.lastAttempt = attemptStarted;
          next.status.lastProgress = this.clock();
          return next;
        } finally { clearTimeout(timer); controller.abort(); }
      } catch { return { ...prior, status: { ...prior?.status, state: 'DEGRADED', lastAttempt: attemptStarted, lastProgress: this.clock() }, newEvents: [] }; }
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
}
