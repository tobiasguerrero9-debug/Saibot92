import { fetchTickers24h, fetchOpenInterest, fetchPremiumIndex, fetchKlines } from '../../src/services/binanceRestClient.js';
import { normalizeSymbolData } from '../../src/services/marketNormalizer.js';
import { classifyAgentState } from '../../src/services/agentStateClassifier.js';
import { analyzeMarketContext } from '../../src/services/marketContextEngine.js';
import { analyzeOrderFlow } from '../../src/services/orderFlowAnalyzer.js';
import { WhatChangedTracker } from '../../src/services/whatChangedTracker.js';

export class ResearchFeed {
  constructor() { this.memory = new WhatChangedTracker(); this.cache = null; this.lastRead = 0; this.liquidations = []; this.liquidationObservedSince = null; }
  startLiquidations(WebSocketImpl = globalThis.WebSocket) {
    let stopped = false, retry, socket;
    const connect = () => {
      socket = new WebSocketImpl('wss://fstream.binance.com/ws/ethusdt@forceOrder');
      socket.onopen = () => { this.liquidationObservedSince = Date.now(); this.liquidations = []; };
      socket.onmessage = event => { try { const data = JSON.parse(event.data); if (data.o?.s === 'ETHUSDT') this.liquidations = [{ symbol: 'ETHUSDT', side: data.o.S, time: data.o.T, quantity: Number(data.o.q), price: Number(data.o.p) }, ...this.liquidations].slice(0, 20); } catch { /* No inferred liquidation data. */ } };
      socket.onclose = () => { this.liquidationObservedSince = null; this.liquidations = []; if (!stopped) retry = setTimeout(connect, 4000); };
      socket.onerror = () => { this.liquidationObservedSince = null; };
    };
    connect(); return () => { stopped = true; clearTimeout(retry); if (socket) { socket.onclose = null; socket.close(); } };
  }
  async read() {
    if (this.cache && Date.now() - this.lastRead < 5000) return this.cache;
    const startedAt = Date.now();
    const [ticker, openInterest, premiumIndex, klines] = await Promise.all([fetchTickers24h('ETHUSDT'), fetchOpenInterest('ETHUSDT'), fetchPremiumIndex('ETHUSDT'), fetchKlines('ETHUSDT', '5m', 30)]);
    const recentLiquidations = this.liquidations.filter(item => Date.now() - item.time < 300000);
    const data = normalizeSymbolData({ symbol: 'ETHUSDT', ticker, openInterest, premiumIndex, klines, liquidations: recentLiquidations });
    if (![data.price, data.openInterestUsd, data.fundingRate].every(Number.isFinite) || !data.price || !klines.length) throw new Error('Research telemetry incomplete.');
    const agent = classifyAgentState(data), market = analyzeMarketContext(data), flow = analyzeOrderFlow(data);
    this.memory.recordSnapshot(data);
    this.cache = { symbol: 'ETH', timestamp: startedAt, source: 'SAIBOT92 deterministic interpretation of public USD-M research telemetry; execution prices come from Hyperliquid TESTNET.', agentState: agent.state, marketBias: agent.marketBias, contextScore: agent.contextScore, whatChanged: this.memory.get5mChange('ETHUSDT'), orderFlow: { ...flow.derivedData, buyRatio: Number.parseFloat(flow.derivedData.buyRatioPct) / 100, basis: 'Candle-direction participation proxy, not measured taker-side volume.' }, openInterest: data.openInterestUsd, funding: data.fundingRate, liquidationContext: { status: this.liquidationObservedSince ? 'OBSERVING' : 'UNAVAILABLE', observedSince: this.liquidationObservedSince, events: recentLiquidations }, squeezeState: agent.state === 'SQUEEZE MODE' ? agent.marketBias : 'NO_SQUEEZE_CLASSIFICATION', transitionPressure: market.transitionPressure };
    this.lastRead = startedAt; return this.cache;
  }
}
