export const SESSION_LIMITS = Object.freeze({ symbol: 'ETH', maxPositionUsd: 100, maxLeverage: 3, maxLossUsd: 5, maxLossPercent: 0.5, maxTrades: 1, priceAgeMs: 10000, contextAgeMs: 15000, heartbeatMs: 30000, slippage: 0.001, costRate: 0.002 });

export function validateEnvelope(input) {
  const config = { symbol: input.symbol || 'ETH', direction: input.direction, maxPositionUsd: Number(input.maxPositionUsd), maxLeverage: Number(input.maxLeverage), lossUnit: input.lossUnit, maxLoss: Number(input.maxLoss), stopLoss: Number(input.stopLoss), takeProfit: input.takeProfit === '' || input.takeProfit == null ? null : Number(input.takeProfit), durationMinutes: Number(input.durationMinutes), maxTrades: input.maxTrades == null ? 1 : Number(input.maxTrades) };
  if (config.symbol !== 'ETH') throw new Error('V1 is ETH-PERP only.');
  if (!['LONG_ONLY', 'SHORT_ONLY', 'BOTH'].includes(config.direction)) throw new Error('Choose a valid direction.');
  if (!Number.isFinite(config.maxPositionUsd) || config.maxPositionUsd < 10 || config.maxPositionUsd > SESSION_LIMITS.maxPositionUsd) throw new Error('Max size must be $10–$100.');
  if (!Number.isInteger(config.maxLeverage) || config.maxLeverage < 1 || config.maxLeverage > SESSION_LIMITS.maxLeverage) throw new Error('Leverage ceiling is 3x.');
  const cap = config.lossUnit === 'USD' ? SESSION_LIMITS.maxLossUsd : config.lossUnit === 'PERCENT' ? SESSION_LIMITS.maxLossPercent : NaN;
  if (!Number.isFinite(config.maxLoss) || config.maxLoss <= 0 || config.maxLoss > cap || !Number.isFinite(cap)) throw new Error('Loss ceiling is $5 or 0.5%, whichever is lower at ARM.');
  if (!Number.isFinite(config.stopLoss) || config.stopLoss <= 0) throw new Error('A positive protective stop is mandatory.');
  if (config.takeProfit !== null && (!Number.isFinite(config.takeProfit) || config.takeProfit <= 0)) throw new Error('Take profit must be positive or blank.');
  if (![30, 60, 120].includes(config.durationMinutes)) throw new Error('Session duration must be 30m, 1h or 2h.');
  if (config.maxTrades !== 1) throw new Error('V1 permits exactly one trade attempt per armed session.');
  return Object.freeze(config);
}

// An explicit eligibility policy over existing deterministic SAIBOT92 outputs.
// The score is the existing context score, never a fabricated confidence value.
export function decideEligibility(context, config, now = Date.now()) {
  if (!context || context.symbol !== 'ETH' || !Number.isFinite(context.timestamp) || now - context.timestamp > SESSION_LIMITS.contextAgeMs || context.timestamp > now) return { decision: 'WAIT', reason: 'Fresh ETH research context unavailable.' };
  if (!context.whatChanged?.hasHistory) return { decision: 'WAIT', reason: 'Collecting real What Changed observations.' };
  if (!Number.isFinite(context.contextScore) || !Number.isFinite(context.orderFlow?.buyRatio)) return { decision: 'WAIT', reason: 'Research inputs are incomplete.' };
  const long = ['LOCKED IN', 'SQUEEZE MODE'].includes(context.agentState) && context.contextScore >= 70 && context.orderFlow.buyRatio >= 0.58;
  const short = context.agentState === 'RISK OFF' && context.contextScore >= 70 && context.orderFlow.buyRatio <= 0.42;
  const side = long ? 'LONG' : short ? 'SHORT' : null;
  if (!side) return { decision: 'WAIT', reason: `No eligible directional state: ${context.agentState}; derived buy share ${(context.orderFlow.buyRatio * 100).toFixed(1)}%.` };
  if ((side === 'LONG' && config.direction === 'SHORT_ONLY') || (side === 'SHORT' && config.direction === 'LONG_ONLY')) return { decision: 'NOT_ELIGIBLE', reason: `${side} context is outside the armed direction.` };
  return { decision: 'ENTRY_ELIGIBLE', side, reason: `${context.agentState}; context score ${context.contextScore}; candle-derived buy share ${(context.orderFlow.buyRatio * 100).toFixed(1)}%. Explicit deterministic policy met; exchange risk checks still required.` };
}

export function entryRejections(session, snapshot, ws, now) {
  const reasons = [], cfg = session.config, account = snapshot?.account, market = snapshot?.markets?.find(m => m.name === 'ETH');
  if (!session.armed || session.stopRequested) reasons.push('Agent is disarmed.');
  if (session.auditFault) reasons.push('Durable audit unavailable.');
  if (now >= session.expiresAt || now - session.heartbeatAt > SESSION_LIMITS.heartbeatMs) reasons.push('Session expired or controlling browser disconnected.');
  if (session.trades >= cfg.maxTrades) reasons.push('Session trade count exhausted.');
  if (!snapshot?.executionEnabled || !snapshot?.agentAuthorized) reasons.push('TESTNET signer/agent authorization unavailable.');
  if (!snapshot?.access?.granted || snapshot.access.account?.toLowerCase() !== session.owner.toLowerCase() || now - snapshot.access.verifiedAt > 30000) reasons.push('Fresh holder access required.');
  if (!account || account.address?.toLowerCase() !== session.owner.toLowerCase() || !Number.isFinite(account.equity) || account.equity <= 0 || !Number.isFinite(account.availableMargin) || account.availableMargin <= 0 || !Array.isArray(account.positions) || !Array.isArray(account.orders) || !Number.isFinite(account.receivedAt) || now - account.receivedAt > SESSION_LIMITS.priceAgeMs || account.receivedAt > now) reasons.push('Account state unknown, stale or unfunded.');
  if (!market || !Number.isFinite(Number(market.markPx)) || Number(market.markPx) <= 0 || !Number.isFinite(market.receivedAt) || now - market.receivedAt > SESSION_LIMITS.priceAgeMs || market.receivedAt > now) reasons.push('ETH market data stale or inconsistent.');
  if (!ws?.connected || !Number.isFinite(ws.lastSeen) || now - ws.lastSeen > SESSION_LIMITS.priceAgeMs || ws.lastSeen > now) reasons.push('Live ETH WebSocket not healthy.');
  if (account?.positions?.length || account?.orders?.length) reasons.push('Conflicting position or order exists.');
  if (!Number.isFinite(session.lossBudgetUsd) || session.lossBudgetUsd <= 0 || session.startEquity - (account?.equity ?? 0) >= session.lossBudgetUsd) reasons.push('Session max loss reached or unavailable.');
  if (snapshot?.uncertain) reasons.push('Unreconciled prior execution.');
  return reasons;
}
