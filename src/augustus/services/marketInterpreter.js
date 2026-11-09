// Deterministic description of TESTNET telemetry, never an order instruction.
export function interpretMarket(market) {
  const mark = Number(market?.markPx), prior = Number(market?.prevDayPx), funding = Number(market?.funding);
  if (![mark, prior, funding].every(Number.isFinite) || mark <= 0 || prior <= 0) return { state: 'UNAVAILABLE', bias: 'UNAVAILABLE' };
  const change = (mark / prior - 1) * 100;
  return { state: Math.abs(change) >= 3 ? 'EXPANSION' : Math.abs(change) <= 0.5 ? 'COMPRESSED' : 'OBSERVING', bias: change > 0.5 ? 'UPWARD PRICE DRIFT' : change < -0.5 ? 'DOWNWARD PRICE DRIFT' : 'NEUTRAL', changePercent: change, note: 'Rule-based mark-versus-prior-day comparison, not a trade signal.' };
}
