/**
 * orderFlowAnalyzer.js
 * Order Flow telemetry processor for SAIBOT92.
 * Distinguishes direct exchange telemetry from derived order-flow interpretations.
 * Does NOT claim full DOM / footprint depth unless available.
 */

export function analyzeOrderFlow(marketData) {
  if (!marketData || !marketData.klines || marketData.klines.length === 0) {
    return {
      // Direct Exchange Data
      directData: {
        takerBuyVol: 0,
        takerSellVol: 0,
        takerVolumeQuote: 0,
        tradeCount: 0,
        dataBasis: 'Binance Futures Kline Taker Sample',
      },
      // Derived Interpretations
      derivedData: {
        aggressiveBuyers: 'NEUTRAL',
        aggressiveSellers: 'NEUTRAL',
        takerImbalance: 'BALANCED',
        priceResponse: 'STABLE',
        orderFlowPressure: 'BALANCED',
      },
    };
  }

  const { klines, price, priceChange24h, quoteVolume24h } = marketData;

  // Compute taker volumes from recent klines (last 10 candles sample)
  const recentKlines = klines.slice(-10);
  let takerBuyVol = 0;
  let takerSellVol = 0;

  recentKlines.forEach((k) => {
    if (k.close >= k.open) {
      takerBuyVol += k.volume;
    } else {
      takerSellVol += k.volume;
    }
  });

  const totalVol = takerBuyVol + takerSellVol;
  const buyRatio = totalVol > 0 ? takerBuyVol / totalVol : 0.5;

  // Direct Exchange Data
  const directData = {
    takerBuyVol,
    takerSellVol,
    takerVolumeQuote: quoteVolume24h,
    sampleWindow: `${recentKlines.length} Candles`,
    dataBasis: 'Binance Futures Public Taker Volume',
  };

  // Derived Interpretations
  let aggressiveBuyers = 'NEUTRAL';
  let aggressiveSellers = 'NEUTRAL';
  let takerImbalance = 'BALANCED';
  let priceResponse = 'STABLE';
  let orderFlowPressure = 'BALANCED';

  if (buyRatio >= 0.65) {
    aggressiveBuyers = 'DOMINANT ↑';
    aggressiveSellers = 'SUBDUED ↓';
    takerImbalance = 'HEAVY BUY';
  } else if (buyRatio >= 0.55) {
    aggressiveBuyers = 'ACTIVE ↑';
    aggressiveSellers = 'MODERATE';
    takerImbalance = 'BUY BIAS';
  } else if (buyRatio <= 0.35) {
    aggressiveBuyers = 'SUBDUED ↓';
    aggressiveSellers = 'DOMINANT ↑';
    takerImbalance = 'HEAVY SELL';
  } else if (buyRatio <= 0.45) {
    aggressiveBuyers = 'MODERATE';
    aggressiveSellers = 'ACTIVE ↑';
    takerImbalance = 'SELL BIAS';
  }

  // Price Response Relationship
  const absChange = Math.abs(priceChange24h);
  if (totalVol > 0 && absChange < 0.5 && (buyRatio > 0.6 || buyRatio < 0.4)) {
    priceResponse = 'WEAKENING (ABSORPTION)';
    orderFlowPressure = buyRatio > 0.6 ? 'SELLER ABSORPTION' : 'BUYER ABSORPTION';
  } else if (priceChange24h > 1.5 && buyRatio > 0.55) {
    priceResponse = 'STRENGTHENING';
    orderFlowPressure = 'BULLISH DRIVE';
  } else if (priceChange24h < -1.5 && buyRatio < 0.45) {
    priceResponse = 'STRENGTHENING';
    orderFlowPressure = 'BEARISH DRIVE';
  } else {
    priceResponse = 'CONTAINED';
    orderFlowPressure = 'BALANCED';
  }

  return {
    directData,
    derivedData: {
      aggressiveBuyers,
      aggressiveSellers,
      takerImbalance,
      priceResponse,
      orderFlowPressure,
      buyRatioPct: (buyRatio * 100).toFixed(1) + '%',
    },
  };
}
