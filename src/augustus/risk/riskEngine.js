export function validateRiskSettings(settings) {
  const keys = ['maxRiskPerTradePercent', 'maxLeverage', 'maxDailyLossPercent', 'maxConcurrentPositions', 'maxPositionNotional', 'maxPriceAgeMs'];
  return settings && keys.every(k => Number.isFinite(settings[k]) && settings[k] > 0) && settings.maxRiskPerTradePercent <= 100 && settings.maxDailyLossPercent <= 100 && Number.isInteger(settings.maxLeverage) && Number.isInteger(settings.maxConcurrentPositions) && settings.stopLossRequired === true && Array.isArray(settings.allowedMarkets) && settings.allowedMarkets.length > 0 && settings.allowedMarkets.every(m => /^[A-Z0-9]{1,15}$/.test(m)) && Number.isFinite(settings.costBufferPercent) && settings.costBufferPercent >= 0 && Number.isFinite(settings.maxSlippagePercent) && settings.maxSlippagePercent > 0 && settings.maxSlippagePercent <= 1;
}

export function evaluateRisk({ proposal: p, account: a, market: m, access, walletConnected, hyperliquidAvailable, agentAuthorized, dailyLossPercent, settings: s, now = Date.now() }) {
  const reasons = [];
  if (!validateRiskSettings(s)) return { decision: 'REJECT', reasons: ['Invalid risk settings.'] };
  if (!access?.granted || now - access.verifiedAt > 30000 || access.verifiedAt > now || access.account?.toLowerCase() !== a?.address?.toLowerCase()) reasons.push('Holder access missing, stale or mismatched.');
  if (!walletConnected) reasons.push('Wallet disconnected.');
  if (!hyperliquidAvailable) reasons.push('Hyperliquid unavailable.');
  if (!agentAuthorized) reasons.push('TESTNET agent wallet not authorized.');
  if (!a || ![a.equity, a.availableMargin, a.receivedAt].every(Number.isFinite) || a.equity <= 0 || a.availableMargin < 0 || !Array.isArray(a.positions) || !Array.isArray(a.orders) || now - a.receivedAt > s.maxPriceAgeMs || a.receivedAt > now) reasons.push('Account data invalid or stale.');
  if (!m || !Number.isFinite(Number(m.markPx)) || Number(m.markPx) <= 0 || !Number.isFinite(m.receivedAt) || now - m.receivedAt > s.maxPriceAgeMs || m.receivedAt > now) reasons.push('Price data invalid or stale.');
  if (!Number.isFinite(dailyLossPercent) || dailyLossPercent < 0) reasons.push('Verified daily-loss accounting unavailable.');
  else if (dailyLossPercent >= s.maxDailyLossPercent) reasons.push('Daily loss limit reached.');
  if (!p || ![p.entry, p.stop, p.target, p.size, p.leverage, p.maxLoss, p.positionNotional, p.expiresAt].every(Number.isFinite) || !p.id || p.expiresAt <= now || !['LONG', 'SHORT'].includes(p.side) || !['market', 'limit'].includes(p.orderType) || Math.min(p.entry, p.stop, p.target, p.size, p.leverage, p.maxLoss, p.positionNotional) <= 0) return { decision: 'REJECT', reasons: [...reasons, 'Invalid or expired proposal; positive size and stop are required.'] };
  if (!s.allowedMarkets.includes(p.symbol) || p.symbol !== m?.name) reasons.push('Market not in allowlist or mismatched.');
  if ((p.side === 'LONG' && (p.stop >= p.entry || p.target <= p.entry)) || (p.side === 'SHORT' && (p.stop <= p.entry || p.target >= p.entry))) reasons.push('Invalid stop or target direction.');
  if (!Number.isInteger(p.leverage) || p.leverage > s.maxLeverage || p.leverage > (m?.maxLeverage ?? 0)) reasons.push('Leverage exceeds maximum.');
  if (Math.abs(p.positionNotional - p.size * p.entry) > 0.000001) reasons.push('Inconsistent notional.');
  const loss = p.size * Math.abs(p.entry - p.stop) + p.positionNotional * s.costBufferPercent / 100;
  if (Math.abs(loss - p.maxLoss) > 0.000001 || loss > (a?.equity ?? 0) * s.maxRiskPerTradePercent / 100) reasons.push('Proposed loss exceeds risk limit or is inconsistent.');
  if (p.positionNotional > s.maxPositionNotional) reasons.push('Maximum notional exceeded.');
  if (p.positionNotional / p.leverage > (a?.availableMargin ?? 0)) reasons.push('Insufficient margin.');
  const exposure = (a?.positions?.length ?? 0) + (a?.orders?.filter(o => !o.reduceOnly).length ?? 0);
  if (exposure >= s.maxConcurrentPositions) reasons.push('Concurrent position/order limit reached.');
  if (m && Number.isInteger(m.szDecimals)) { const rounded = Math.round(p.size * 10 ** m.szDecimals); if (Math.abs(p.size * 10 ** m.szDecimals - rounded) > 1e-7 || p.positionNotional < 10) reasons.push('Invalid exchange size or minimum notional.'); }
  else reasons.push('Exchange constraints unavailable.');
  if (p.orderType === 'market' && Math.abs(p.entry / Number(m?.markPx) - 1) > s.maxSlippagePercent / 100 + 0.000001) reasons.push('Price moved beyond proposal tolerance.');
  return { decision: reasons.length ? 'REJECT' : 'ALLOW', reasons };
}
