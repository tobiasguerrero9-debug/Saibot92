import { openSync, writeSync, fsyncSync, closeSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export class SessionAudit {
  constructor(filename) {
    this.filename = filename; this.events = []; this.corrupt = false;
    mkdirSync(path.dirname(filename), { recursive: true });
    if (existsSync(filename)) for (const line of readFileSync(filename, 'utf8').split('\n').filter(Boolean)) {
      try { this.events.push(JSON.parse(line)); } catch { this.corrupt = true; }
    }
  }
  append(event) { const fd = openSync(this.filename, 'a', 0o600); try { writeSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); } this.events.push(event); }
  latest() { return this.events.findLast(event => event.action === 'CHECKPOINT')?.session || null; }
  list(id) { return this.events.filter(event => event.executionId === id); }
}
