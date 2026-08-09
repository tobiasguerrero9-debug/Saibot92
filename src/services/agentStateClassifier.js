/**
 * agentStateClassifier.js
 * SAIBOT92 Deterministic Agent State Classifier.
 * Classifies the active market into an explicit AGENT STATE based strictly on real market data.
 * States: OBSERVING, LOCKED IN, ABSORPTION, SQUEEZE MODE, OVERHEATED, CHAOS, DEAD MARKET, RESETTING, RISK OFF
 */

export function classifyAgentState(marketData) {
  if (!marketData || !marketData.price) {
    return {
      state: 'OBSERVING',
      contextScore: 50,
      confidence: 'LOW',
      marketBias: 'NEUTRAL',
      transition: 'INITIALIZING',
      description: 'Telemetry streams initializing. Agent monitoring base order book feeds.',
    };
  }

  const { price, priceChange24h, quoteVolume24h, openInterestUsd, fundingRate, liquidations = [], klines = [] } = marketData;

  const absPriceChange = Math.abs(priceChange24h);
  const fundingBp = fundingRate * 10000;

  // Estimate taker buy/sell volume from recent klines if available
  let takerBuyVol = 0;
  let takerSellVol = 0;

  if (klines.length > 0) {
    klines.slice(-10).forEach((k) => {
      if (k.close >= k.open) {
        takerBuyVol += k.volume;
      } else {
        takerSellVol += k.volume;
      }
    });
  }

  const totalTakerVol = takerBuyVol + takerSellVol;
  const buyRatio = totalTakerVol > 0 ? takerBuyVol / totalTakerVol : 0.5;

  let state = 'OBSERVING';
  let contextScore = 50;
  let confidence = 'MEDIUM';
  let marketBias = 'NEUTRAL';
  let transition = 'MODERATE';
  let description = '';

  // 1. OVERHEATED: Extreme funding rate or extreme volume spike
  if (Math.abs(fundingRate) >= 0.0003 || quoteVolume24h > 15000000000) {
    state = 'OVERHEATED';
    contextScore = 88;
    confidence = 'HIGH';
    marketBias = fundingRate > 0 ? 'LONG OVERHEAT' : 'SHORT OVERHEAT';
    transition = 'HIGH SKEW';
    description = 'Extreme funding rate divergence and leverage concentration detected. Heightened volatility sensitivity.';
  }
  // 2. CHAOS: Heavy liquidations + high price dispersion
  else if (liquidations.length >= 4 || absPriceChange > 5.0) {
    state = 'CHAOS';
    contextScore = 85;
    confidence = 'HIGH';
    marketBias = priceChange24h > 0 ? 'BULLISH VOLATILITY' : 'BEARISH VOLATILITY';
    transition = 'ELEVATED';
    description = 'Active liquidation cascade and rapid order flow displacement across derivative venues.';
  }
  // 3. SQUEEZE MODE: Price up sharply with negative funding or short unwinding
  else if (priceChange24h >= 2.0 && fundingRate < 0) {
    state = 'SQUEEZE MODE';
    contextScore = 82;
    confidence = 'HIGH';
    marketBias = 'SHORT SQUEEZE';
    transition = 'RISING';
    description = 'Forced short position unwinding driving price expansion against negative carry friction.';
  }
  // 4. LOCKED IN: Price up + high volume + buy aggression
  else if (priceChange24h >= 1.5 && buyRatio >= 0.58) {
    state = 'LOCKED IN';
    contextScore = 78;
    confidence = 'HIGH';
    marketBias = 'LONG';
    transition = 'MODERATE';
    description = 'Strong taker buy order flow driving clean directional price expansion.';
  }
  // 5. RISK OFF: Sharp price drop with heavy selling
  else if (priceChange24h <= -2.5) {
    state = 'RISK OFF';
    contextScore = 76;
    confidence = 'HIGH';
    marketBias = 'BEARISH';
    transition = 'ELEVATED';
    description = 'Aggressive taker selling pressure forcing position de-risking across futures contracts.';
  }
  // 6. ABSORPTION: Heavy taker buy/sell volume but price change is compressed (< 0.5%)
  else if (totalTakerVol > 0 && absPriceChange < 0.6 && Math.abs(buyRatio - 0.5) > 0.12) {
    state = 'ABSORPTION';
    contextScore = 72;
    confidence = 'MEDIUM';
    marketBias = buyRatio > 0.5 ? 'SELLER ABSORPTION' : 'BUYER ABSORPTION';
    transition = 'BUILDING';
    description = 'Aggressive market orders absorbed by opposing limit book liquidity with muted price response.';
  }
  // 7. DEAD MARKET: Very low volume or flat activity
  else if (quoteVolume24h < 50000000 || absPriceChange < 0.2) {
    state = 'DEAD MARKET';
    contextScore = 30;
    confidence = 'LOW';
    marketBias = 'NEUTRAL';
    transition = 'STABLE';
    description = 'Subdued derivatives volume and compressed price dispersion across the 24h window.';
  }
  // 8. RESETTING: Funding rate near zero baseline after move
  else if (Math.abs(fundingRate) < 0.00005 && absPriceChange < 1.0) {
    state = 'RESETTING';
    contextScore = 45;
    confidence = 'MEDIUM';
    marketBias = 'NEUTRAL';
    transition = 'REBALANCING';
    description = 'Derivatives carry costs resting near neutral reference baseline as position skew rebalances.';
  }
  // 9. Default: OBSERVING
  else {
    state = 'OBSERVING';
    contextScore = Math.min(70, Math.max(35, Math.round(50 + priceChange24h * 3)));
    confidence = 'MEDIUM';
    marketBias = priceChange24h >= 0 ? 'MILD BULLISH' : 'MILD BEARISH';
    transition = 'STABLE';
    description = 'Order flow and leverage telemetry balanced within normal operational parameters.';
  }

  return {
    state,
    contextScore,
    confidence,
    marketBias,
    transition,
    description,
  };
}
