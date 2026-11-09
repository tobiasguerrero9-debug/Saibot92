export const ALERT_TYPES = ['SQUEEZE_DETECTED', 'AGENT_STATE_SHIFT', 'WHAT_CHANGED_SPIKE', 'LIQUIDATION_RISK'];
export const ALERT_COOLDOWN = 10 * 60 * 1000;
const KEY = 'saibot92.alerts.v1';
export class AlertsStore {
  constructor({ storage, clock = Date.now, historyLimit = 100, baselineLimit = 2000 } = {}) {
    this.baselineLimit = baselineLimit; this.historyLimit = historyLimit; this.storage = storage; this.clock = clock; this.listeners = new Set(); this.previous = new Map(); this.cooldowns = new Map(); this.events = []; this.conditionSources = new Map(); this.conditions = [];
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || '[]');
      this.events = (Array.isArray(saved) ? saved : []).filter(e => ALERT_TYPES.includes(e.type) && typeof e.id === 'string' && typeof e.symbol === 'string' && typeof e.title === 'string' && typeof e.context === 'string' && Number.isFinite(e.timestamp) && ['HIGH','WATCH','INFO','RESOLVED'].includes(e.severity)).slice(0, this.historyLimit);
      for (const e of this.events) this.cooldowns.set(this.key(e), Math.max(this.cooldowns.get(this.key(e)) || 0, e.timestamp));
    } catch { /* Corrupt/unavailable local storage must not interrupt telemetry. */ }
  }
  key(e) { return `${e.symbol}:${e.type}:${e.stateAfter}`; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  snapshot = () => this.events;
  liveSnapshot = () => this.conditions;
  publishConditions() {
    const unique = new Map();
    for (const rows of this.conditionSources.values()) for (const row of rows) unique.set(`${row.symbol}:${row.type}`, row);
    const rank = { LIQUIDATION_RISK: 0, SQUEEZE_DETECTED: 1, WHAT_CHANGED_SPIKE: 2, AGENT_STATE_SHIFT: 3 };
    this.conditions = [...unique.values()].sort((a,b) => ({HIGH:0,WATCH:1,INFO:2}[a.severity] - {HIGH:0,WATCH:1,INFO:2}[b.severity]) || rank[a.type] - rank[b.type] || a.symbol.localeCompare(b.symbol));
    this.listeners.forEach(fn => fn());
  }
  clearConditions(source) { for (const key of this.conditionSources.keys()) if (key.startsWith(source + ':')) this.conditionSources.delete(key); this.publishConditions(); }
  observeUniverse(markets) {
    for (const key of this.conditionSources.keys()) if (key.startsWith('Market Scanner:')) this.conditionSources.delete(key);
    markets.forEach(m => this.observe({ symbol: m.symbol, agent: m.agentInfo, source: 'Market Scanner', deferConditions: true }));
    this.publishConditions();
  }
  commit() { try { this.storage?.setItem(KEY, JSON.stringify(this.events)); } catch { /* Session memory remains available. */ } for (const fn of this.listeners) fn(); }
  acknowledge(id) { this.events = this.events.map(e => !id || e.id === id ? { ...e, acknowledged: true } : e); this.commit(); }
  emit(event) {
    const timestamp = this.clock(), key = this.key(event), prior = this.cooldowns.get(key);
    if (prior != null && timestamp - prior < ALERT_COOLDOWN) return;
    this.cooldowns.set(key, timestamp);
    this.events = [{ ...event, id: globalThis.crypto?.randomUUID?.() || `${timestamp}-${Math.random().toString(36).slice(2)}`, timestamp, acknowledged: false }, ...this.events].slice(0, this.historyLimit);
    this.commit();
  }
  observe({ symbol, agent, whatChanged, analysis, source, valid = true, deferConditions = false }) {
    if (!valid || !symbol || !agent?.state || agent.transition === 'INITIALIZING') { this.conditionSources.delete(`${source}:${symbol}`); if (!deferConditions) this.publishConditions(); return; }
    // Independent baselines prevent the sparse scanner and full active-symbol
    // feed from resetting each other's richer observations.
    const key = `${source}:${symbol}`, before = this.previous.get(key);
    const current = { state: agent.state, squeeze: agent.state === 'SQUEEZE MODE' ? agent.marketBias : null, spike: whatChanged?.hasHistory && ['RALLYING','DROPPING'].includes(whatChanged.priceResponse) ? whatChanged.priceResponse : null, liq: analysis?.condition === 'Bearish Liquidation Cascade' };
    const rows = [], observedAt = this.clock();
    const add = (type,severity,title,context) => rows.push({ symbol,type,severity,title,context,observedAt });
    if (current.squeeze && ['SHORT SQUEEZE','LONG SQUEEZE'].includes(current.squeeze)) add('SQUEEZE_DETECTED','WATCH',current.squeeze,agent.description || '');
    if (['ABSORPTION','OVERHEATED'].includes(current.state)) add('AGENT_STATE_SHIFT',current.state === 'OVERHEATED' ? 'WATCH' : 'INFO',current.state,agent.description || '');
    if (current.spike) add('WHAT_CHANGED_SPIKE','WATCH',`WHAT CHANGED · ${current.spike}`,`${whatChanged.windowLabel} · OI ${whatChanged.oiDeltaPct}`);
    if (current.liq) add('LIQUIDATION_RISK','HIGH','LIQUIDATION RISK',analysis.condition);
    this.conditionSources.set(key, rows);
    if (!deferConditions) this.publishConditions();
    this.previous.set(key, current);
    if (this.previous.size > this.baselineLimit) this.previous.delete(this.previous.keys().next().value);
    if (!before) return;
    const push = (type, severity, title, context, stateBefore, stateAfter) => this.emit({ type, symbol, severity, title, context, source, stateBefore, stateAfter });
    if (current.squeeze && current.squeeze !== before.squeeze && ['SHORT SQUEEZE','LONG SQUEEZE'].includes(current.squeeze)) push('SQUEEZE_DETECTED','HIGH',`${current.squeeze} POSSIBILITY`, agent.description || '', before.squeeze, current.squeeze);
    if (before.state !== current.state) push('AGENT_STATE_SHIFT','INFO',`${before.state} → ${current.state}`,agent.description || '',before.state,current.state);
    if (current.spike && current.spike !== before.spike) push('WHAT_CHANGED_SPIKE','WATCH',`WHAT CHANGED · ${current.spike}`,`${whatChanged.windowLabel} · OI ${whatChanged.oiDeltaPct} · Volume ${whatChanged.volumeDeltaPct}`,before.spike,current.spike);
    if (current.liq && !before.liq) push('LIQUIDATION_RISK','HIGH','ELEVATED LIQUIDATION RISK',analysis.condition,before.liq,'Bearish Liquidation Cascade');
  }
}
let storage; try { storage = globalThis.localStorage; } catch { /* Browser policy may block storage. */ }
export const alertsStore = new AlertsStore({ storage });
