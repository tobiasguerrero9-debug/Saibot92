export function sizePosition({ accountEquity, availableMargin, entry, stop, riskPercent, leverage, maxNotional, szDecimals, costBufferPercent = 0.2, minNotional = 10 }) {
  if (![accountEquity, availableMargin, entry, stop, riskPercent, leverage, maxNotional, costBufferPercent, minNotional].every(Number.isFinite) || Math.min(accountEquity, availableMargin, entry, stop, riskPercent, leverage, maxNotional, minNotional) <= 0 || entry === stop || costBufferPercent < 0 || !Number.isInteger(szDecimals) || szDecimals < 0 || szDecimals > 8) throw new Error('Invalid position sizing inputs.');
  const riskCapital = accountEquity * riskPercent / 100;
  const stopDistancePercent = Math.abs(entry - stop) / entry;
  const costRate = costBufferPercent / 100;
  const notional = Math.min(riskCapital / (stopDistancePercent + costRate), availableMargin * leverage, maxNotional);
  const scale = 10 ** szDecimals;
  const size = Math.floor(notional / entry * scale) / scale;
  const positionNotional = size * entry;
  if (size <= 0 || positionNotional < minNotional) throw new Error('Size falls below exchange minimum after rounding.');
  return { size, positionNotional, riskCapital, stopDistancePercent, maxLoss: size * Math.abs(entry - stop) + positionNotional * costRate, marginRequired: positionNotional / leverage };
}
