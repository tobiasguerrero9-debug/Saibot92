import { getMarketUniverse } from './marketUniverseService.js';
import { classifyAgentState } from './agentStateClassifier.js';

// Foreground market data has no dependency on the durable Alerts inbox.
// One shared batch poller exists only while the scanner view is mounted.
export class ScannerUniverse {
  constructor({ load = signal => getMarketUniverse({ signal, strict: true }), clock = Date.now,
    interval = (fn, ms) => setInterval(fn, ms), cancel = id => clearInterval(id), timeoutMs = 15000 } = {}) {
    Object.assign(this, { load, clock, interval, cancel, timeoutMs });
    this.listeners = new Set(); this.users = 0; this.pending = null;
    this.value = { markets: [], loading: true, error: null, observedAt: null, status: { state: 'RECOVERING' } };
  }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  snapshot = () => this.value;
  publish(value) { this.value = value; this.listeners.forEach(fn => fn()); }
  refresh = () => {
    if (this.pending) return this.pending;
    const controller = new AbortController(); let timer;
    this.publish({ ...this.value, loading: true });
    this.pending = Promise.race([
      Promise.resolve().then(() => this.load(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Market request timed out')); }, this.timeoutMs); }),
    ]).then(rows => {
      if (!Array.isArray(rows) || !rows.length) throw Error('Incomplete market universe');
      const markets = rows.map(m => ({ ...m, agentInfo: classifyAgentState(m) }));
      this.publish({ markets, loading: false, error: null, observedAt: this.clock(), status: { state: 'ONLINE' } });
    }).catch(() => {
      const recent = this.value.observedAt !== null && this.clock() - this.value.observedAt <= 65000;
      this.publish({ ...this.value, loading: false,
        error: this.value.markets.length ? 'Public market data unavailable. Showing last observed contracts; retrying automatically.' : 'Public market data unavailable. Contract count is unknown; retrying automatically.',
        status: { state: recent ? 'DEGRADED' : 'OFFLINE' } });
    }).finally(() => { clearTimeout(timer); controller.abort(); this.pending = null; });
    return this.pending;
  };
  start = () => {
    if (++this.users === 1) { void this.refresh(); this.timer = this.interval(this.refresh, 30000); }
    let stopped = false;
    return () => { if (stopped) return; stopped = true; if (--this.users === 0) this.cancel(this.timer); };
  };
}
export const scannerUniverse = new ScannerUniverse();
