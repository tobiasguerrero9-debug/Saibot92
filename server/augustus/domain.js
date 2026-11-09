import { randomBytes, randomUUID } from 'node:crypto';
import { formatPrice } from '@nktkas/hyperliquid/utils';
import { sizePosition } from '../../src/augustus/risk/positionSizer.js';
import { evaluateRisk, validateRiskSettings } from '../../src/augustus/risk/riskEngine.js';

export function dailyLossFromPortfolio(portfolio, now = Date.now()) {
  const history = portfolio?.find?.(row => row[0] === 'perpDay')?.[1];
  const equity = history?.accountValueHistory, pnl = history?.pnlHistory;
  if (!Array.isArray(equity) || !Array.isArray(pnl) || equity.length < 2 || pnl.length < 2) return null;
  const first = pnl[0], last = pnl.at(-1), baseline = Number(equity[0]?.[1]);
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(Number(first[1])) || !Number.isFinite(Number(last[1])) || last[0] < now - 600000 || last[0] > now || first[0] > now - 23 * 3600000) return null;
  return Math.max(0, (Number(first[1]) - Number(last[1])) / baseline * 100);
}

export function makeProposal(input, snapshot, settings, address, now = Date.now()) {
  if (!validateRiskSettings(settings)) throw new Error('Invalid risk limits.');
  const market = snapshot.markets.find(m => m.name === input.symbol);
  if (!market || !settings.allowedMarkets.includes(input.symbol)) throw new Error('Market not allowed.');
  if (!['LONG', 'SHORT'].includes(input.side) || !['market', 'limit'].includes(input.orderType)) throw new Error('Invalid side/order type.');
  const leverage = Number(input.leverage);
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > settings.maxLeverage) throw new Error('Invalid leverage.');
  const entryRaw = input.orderType === 'market' ? Number(market.markPx) * (1 + (input.side === 'LONG' ? 1 : -1) * settings.maxSlippagePercent / 100) : Number(input.entry);
  const entry = Number(formatPrice(entryRaw, market.szDecimals));
  const stop = Number(formatPrice(Number(input.stop), market.szDecimals));
  const target = Number(formatPrice(Number(input.target), market.szDecimals));
  const sizing = sizePosition({ accountEquity: snapshot.account.equity, availableMargin: snapshot.account.availableMargin, entry, stop, riskPercent: settings.maxRiskPerTradePercent, leverage, maxNotional: settings.maxPositionNotional, szDecimals: market.szDecimals, costBufferPercent: settings.costBufferPercent });
  return Object.freeze({ id: randomUUID(), cloid: `0x${randomBytes(16).toString('hex')}`, address, symbol: market.name, asset: market.asset, side: input.side, orderType: input.orderType, entry, stop, target, leverage, ...sizing, createdAt: now, expiresAt: now + 30000, thesis: 'User-defined entry, protective stop and target; deterministic risk-based sizing. No AI inference.', context: input.context || null });
}

export class ExecutionGuard {
  constructor() { this.used = new Set(); this.busy = false; }
  async run(id, approved, execute) {
    if (approved !== true) throw new Error('Explicit approval required.');
    if (this.busy || this.used.has(id)) throw new Error('Duplicate or concurrent execution blocked.');
    this.used.add(id); this.busy = true;
    try { return await execute(); } finally { this.busy = false; }
  }
}

export function checkProposal(proposal, snapshot, settings, now) {
  return evaluateRisk({ proposal, account: snapshot.account, market: snapshot.markets.find(m => m.name === proposal.symbol), access: snapshot.access, walletConnected: true, hyperliquidAvailable: true, agentAuthorized: snapshot.agentAuthorized, dailyLossPercent: snapshot.dailyLossPercent, settings, now });
}
