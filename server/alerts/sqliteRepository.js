// Durable local validation only. Production always requires Neon Postgres.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { publicSnapshot } from './engine.js';
export class SqliteAlertsRepository {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true }); this.db = new DatabaseSync(path); this.busy = false;
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=100; CREATE TABLE IF NOT EXISTS monitor(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT); CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,payload TEXT NOT NULL);');
  }
  async cycle(scan) {
    if (this.busy) return { skipped: true }; this.busy = true;
    let begun = false;
    try {
      try { this.db.exec('BEGIN IMMEDIATE'); begun = true; } catch { return { skipped: true }; }
      const row = this.db.prepare('SELECT payload FROM monitor WHERE id=1').get();
      const next = await scan(row ? JSON.parse(row.payload) : null, null);
      if (next) {
        for (const e of next.newEvents || []) this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?)').run(e.id,e.timestamp,JSON.stringify(e));
        const payload = { ...next }; delete payload.newEvents;
        this.db.prepare('INSERT INTO monitor VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(payload));
        this.db.exec('DELETE FROM events WHERE id IN(SELECT id FROM events ORDER BY timestamp DESC,id DESC LIMIT -1 OFFSET 1000)');
      }
      this.db.exec('COMMIT'); begun = false; return { committed: true, events: next?.newEvents?.length || 0 };
    } finally { if (begun) this.db.exec('ROLLBACK'); this.busy = false; }
  }
  async read() {
    if (this.busy) throw Error('Scan transaction active');
    this.db.exec('BEGIN');
    try {
      const row = this.db.prepare('SELECT payload FROM monitor WHERE id=1').get();
      const result = publicSnapshot(row ? JSON.parse(row.payload) : null, this.db.prepare('SELECT payload FROM events ORDER BY timestamp DESC,id DESC LIMIT 100').all().map(r => JSON.parse(r.payload)));
      this.db.exec('COMMIT'); return result;
    } catch { this.db.exec('ROLLBACK'); throw Error('Alerts read unavailable'); }
  }
  async close() { this.db.close(); }
}
