import { createHash } from 'node:crypto';
// PostgreSQL JSONB reorders object keys. Bind semantic content, never insertion
// order, so a persisted proposal retains its exact approval binding on restart.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(v => v === undefined ? null : canonical(v));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Non-finite binding input');
  return value;
}
export const stableHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
