import { AlertsStore, ALERT_COOLDOWN } from '../../src/services/alertsService.js';
import { classifyAgentState } from '../../src/services/agentStateClassifier.js';
import { analyzeMarketContext } from '../../src/services/marketContextEngine.js';
export function scanSnapshot(previous, markets, now = Date.now(), context = null) {
  if (!Array.isArray(markets) || !markets.length || markets.length > 2000 || markets.some(m => !m.symbol || !Number.isFinite(m.price) || m.price <= 0 || !Number.isFinite(m.priceChange24h) || !Number.isFinite(m.quoteVolume24h) || !Number.isFinite(m.fundingRate))) throw Error('Incomplete batch');
  const engine = new AlertsStore({ clock: () => now, historyLimit: 1000, baselineLimit: 6000 });
  engine.previous = new Map(previous?.baseline || []);
  engine.cooldowns = new Map((previous?.cooldowns || []).filter(([,t]) => now - t < ALERT_COOLDOWN));
  const classified = markets.map(m => ({ ...m, agentInfo: classifyAgentState(m) }));
  engine.observeUniverse(classified);
  // Same existing cascade classifier, using the batch fields it requires.
  classified.forEach(m => engine.observe({ symbol: m.symbol, source: 'Batch liquidation context', agent: m.agentInfo, analysis: analyzeMarketContext(m), deferConditions: true }));
  // Reuse existing fresh hosted ETH What Changed output if available. Never
  // invent per-symbol history or add klines/OI requests for the universe.
  if (context?.symbol === 'ETH' && now >= context.timestamp && now - context.timestamp <= 10000) engine.observe({ symbol: 'ETHUSDT', source: 'SAIBOT92 ETH context', agent: { state: context.agentState, marketBias: context.marketBias }, whatChanged: context.whatChanged, deferConditions: true });
  engine.publishConditions();
  const events = engine.events.map(event => { const e = { ...event }; delete e.acknowledged; return { ...e, dedupeKey: engine.key(e) }; });
  return { baseline: [...engine.previous], cooldowns: [...engine.cooldowns], conditions: engine.conditions, markets: classified, status: { state: 'ONLINE', lastScan: now, marketsEvaluated: classified.length, lastEvent: events[0] || previous?.status?.lastEvent || null }, newEvents: events };
}
export function publicSnapshot(record, events = [], now = Date.now()) {
  const live = record?.status?.lastScan && now - record.status.lastScan <= 65000;
  return { events, conditions: live ? record.conditions : [], markets: record?.markets || [], status: { state: live ? record.status.state : 'OFFLINE', lastScan: record?.status?.lastScan || null, marketsEvaluated: record?.status?.marketsEvaluated || 0, lastEvent: record?.status?.lastEvent ? { symbol: record.status.lastEvent.symbol, title: record.status.lastEvent.title, timestamp: record.status.lastEvent.timestamp } : null }, serverTime: now };
}
