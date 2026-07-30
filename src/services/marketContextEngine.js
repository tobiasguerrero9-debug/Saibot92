/**
 * marketContextEngine.js
 * Evaluates real-time Binance USD-M Futures metrics with deterministic rule-based analysis.
 * Produces market condition, data score, transition pressure, key observations, and scenarios.
 * Does NOT offer financial advice, trade signals, or profit guarantees.
 */

export function analyzeMarketContext(marketData) {
  if (!marketData || !marketData.price) {
    return {
      condition: 'Initializing Telemetry',
      score: 50,
      transitionPressure: 'Pending Data',
      observations: ['Waiting for live REST and WebSocket feeds...'],
      continuationScenario: 'Data stream establishing...',
      transitionScenario: 'Data stream establishing...',
      invalidationScenario: 'Data stream establishing...',
      agentSummary: 'Initializing connection to Binance USD-M Futures public data streams...',
    };
  }

  const { symbol, price, priceChange24h, quoteVolume24h, openInterestUsd, fundingRate, liquidations = [] } = marketData;

  const absPriceChange = Math.abs(priceChange24h);
  const fundingBp = fundingRate * 10000; // basis points

  // 1. Data Score Calculation (20 - 98)
  let score = 50;
  score += Math.min(25, absPriceChange * 3);
  if (Math.abs(fundingBp) > 5) score += 12;
  if (quoteVolume24h > 1000000000) score += 10;
  if (liquidations.length > 0) score += 5;
  score = Math.min(98, Math.max(22, Math.round(score)));

  // 2. Condition & Transition Pressure Classification
  let condition = 'Neutral Consolidation';
  let transitionPressure = 'Low Delta Skew';

  if (priceChange24h >= 3.0 && fundingRate > 0.00015) {
    condition = 'Aggressive Bullish Expansion';
    transitionPressure = 'Elevated Long Overheat';
  } else if (priceChange24h >= 1.0 && fundingRate >= 0) {
    condition = 'Moderate Upward Momentum';
    transitionPressure = 'Moderate Long Bias';
  } else if (priceChange24h <= -3.0 && fundingRate < 0) {
    condition = 'Bearish Liquidation Cascade';
    transitionPressure = 'Elevated Short Squeeze Risk';
  } else if (priceChange24h <= -1.0) {
    condition = 'Downward Unwinding';
    transitionPressure = 'Moderate Short Bias';
  } else if (Math.abs(fundingRate) > 0.0002) {
    condition = 'Funding Rate Divergence';
    transitionPressure = 'High Squeeze Sensitivity';
  }

  // 3. Observations
  const formattedVol = (quoteVolume24h / 1e9).toFixed(2);
  const formattedOI = (openInterestUsd / 1e9).toFixed(2);
  const formattedFunding = (fundingRate * 100).toFixed(4);

  const observations = [
    `24h price change for ${symbol} is ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}% on $${formattedVol}B quote volume.`,
    `Open interest stands at ~$${formattedOI}B USD with a current 8h funding rate of ${formattedFunding}%.`,
    fundingRate > 0.00015
      ? `Elevated positive funding indicates long traders are paying carry costs to hold leverage.`
      : fundingRate < -0.00015
      ? `Negative funding reflects aggressive short positioning, increasing vulnerability to squeeze shocks.`
      : `Funding rate remains near neutral baseline (0.0100%), signaling balanced position distribution.`,
    liquidations.length > 0
      ? `Recent force order telemetry detected ${liquidations.length} active liquidation events.`
      : `No major forced liquidation spikes detected in the immediate window.`,
  ];

  // 4. Scenarios
  const continuationScenario = priceChange24h >= 0
    ? `If buy volume maintains momentum above local VWAP, ${symbol} may extend towards upper resistance clusters.`
    : `Sustained taker sell pressure may test lower support levels if open interest remains heavy.`;

  const transitionScenario = priceChange24h >= 0
    ? `A sharp reduction in open interest with aggressive sell market orders could trigger momentum unwinding.`
    : `Forced closures of overextended short positions could trigger a swift upward short squeeze.`;

  const invalidationScenario = `Scenario invalidates if 24h price trajectory crosses ${priceChange24h >= 0 ? (price * 0.985).toFixed(2) : (price * 1.015).toFixed(2)} on high volume.`;

  // 5. Agent Natural Language Summary
  const agentSummary = `SAIBOT92 telemetry scan for ${symbol}: Market condition is classified as "${condition}" with a data score of ${score}/100. Open interest stands at $${formattedOI}B USD while 24h quote volume is $${formattedVol}B. Current funding rate is ${formattedFunding}%. Context suggests ${continuationScenario.toLowerCase()}`;

  return {
    condition,
    score,
    transitionPressure,
    observations,
    continuationScenario,
    transitionScenario,
    invalidationScenario,
    agentSummary,
  };
}
