export function safePersistenceError(error, retryAfterMs = 0) {
  return Object.assign(Error('Alerts persistence unavailable'), {
    code: /^[A-Z0-9]{5}$/.test(error?.code || '') ? error.code : 'UNKNOWN',
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  });
}

export class PersistenceBackoff {
  constructor({ clock = Date.now, baseMs = 1000, maxMs = 30000, quotaMs = 300000 } = {}) {
    Object.assign(this, { clock, baseMs, maxMs, quotaMs }); this.failures = 0; this.retryAt = 0;
  }
  check() { if (this.clock() < this.retryAt) throw safePersistenceError(this.lastError, this.retryAt - this.clock()); }
  fail(error) {
    this.lastError = safePersistenceError(error);
    const delay = error?.code === '53000' ? this.quotaMs : Math.min(this.maxMs, this.baseMs * 2 ** Math.min(this.failures, 10));
    this.failures++; this.retryAt = this.clock() + delay;
    return safePersistenceError(error, delay);
  }
  success() { this.failures = 0; this.retryAt = 0; }
}

// Cache is an optional, short-lived read optimization, never durable state.
export class SnapshotReads {
  constructor(read, { clock = Date.now, ttlMs = 5000 } = {}) { Object.assign(this, { read, clock, ttlMs }); this.views = new Map(); }
  get(view) {
    const current = this.views.get(view);
    if (current && (current.pending || this.clock() < current.until)) return current.promise;
    const item = { pending: true, until: 0 };
    item.promise = Promise.resolve().then(() => this.read({ view })).then(data => {
      item.pending = false; item.until = this.clock() + this.ttlMs; return data;
    }).catch(error => { if (this.views.get(view) === item) this.views.delete(view); throw error; });
    this.views.set(view, item); return item.promise;
  }
}
