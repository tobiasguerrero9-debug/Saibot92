/**
 * whatChangedTracker.js
 * Rolling 5-minute market observation memory buffer for SAIBOT92.
 * Calculates REAL short-term deltas between the present market state and historical snapshots.
 * Does NOT invent fake historical observations or simulated change percentages.
 */

export class WhatChangedTracker {
  constructor() {
    // Map of symbol -> Array of { timestamp, price, openInterestUsd, quoteVolume24h, buyRatio, fundingRate }
    this.historyMap = new Map();
    this.maxHistoryLength = 20; // Keep up to 20 snapshots (~10-15 mins)
  }

  /**
   * Record a snapshot of live telemetry for a symbol.
   */
  recordSnapshot(marketData) {
    if (!marketData || !marketData.symbol || !marketData.price) return;

    const symbol = marketData.symbol.toUpperCase();
    const now = Date.now();

    // Calculate buy ratio from klines
    let buyVol = 0;
    let sellVol = 0;
    if (marketData.klines && marketData.klines.length > 0) {
      marketData.klines.slice(-5).forEach((k) => {
        if (k.close >= k.open) buyVol += k.volume;
        else sellVol += k.volume;
      });
    }

    const totalVol = buyVol + sellVol;
    const buyRatio = totalVol > 0 ? buyVol / totalVol : 0.5;

    const snapshot = {
      timestamp: now,
      price: marketData.price,
      openInterestUsd: marketData.openInterestUsd || 0,
      quoteVolume24h: marketData.quoteVolume24h || 0,
      buyRatio,
      fundingRate: marketData.fundingRate || 0,
      liquidationCount: (marketData.liquidations || []).length,
    };

    if (!this.historyMap.has(symbol)) {
      this.historyMap.set(symbol, []);
    }

    const history = this.historyMap.get(symbol);

    // Throttle recording to max 1 snapshot every 15 seconds to avoid duplicate ticks
    const lastSnap = history[history.length - 1];
    if (!lastSnap || now - lastSnap.timestamp >= 14000) {
      history.push(snapshot);
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }
    }
  }

  /**
   * Calculate deltas comparing the current snapshot with an observation ~5 minutes ago (3-6 mins).
   */
  get5mChange(symbol) {
    const sym = symbol ? symbol.toUpperCase() : '';
    const history = this.historyMap.get(sym);

    if (!history || history.length < 2) {
      return {
        hasHistory: false,
        statusMessage: 'COLLECTING MARKET HISTORY...',
        detail: 'Not enough recent observations to calculate short-term change.',
      };
    }

    const current = history[history.length - 1];
    const now = current.timestamp;

    // Find snapshot closest to 5 minutes ago (between 2.5 and 7 minutes ago)
    let prior = null;
    for (let i = history.length - 2; i >= 0; i--) {
      const ageMs = now - history[i].timestamp;
      if (ageMs >= 120000) { // at least 2 minutes old
        prior = history[i];
        break;
      }
    }

    // Fallback to earliest snapshot if under 5 minutes
    if (!prior) {
      prior = history[0];
    }

    const timeDiffSec = Math.round((now - prior.timestamp) / 1000);
    const windowLabel = timeDiffSec < 60 ? `${timeDiffSec}s` : `${Math.round(timeDiffSec / 60)}m`;

    // 1. Buy Aggression Delta
    const buyAggressionDeltaPct = ((current.buyRatio - prior.buyRatio) * 100).toFixed(1);

    // 2. Open Interest Delta %
    const oiDeltaPct = prior.openInterestUsd > 0
      ? (((current.openInterestUsd - prior.openInterestUsd) / prior.openInterestUsd) * 100).toFixed(2)
      : '0.00';

    // 3. Volume Delta %
    const volumeDeltaPct = prior.quoteVolume24h > 0
      ? (((current.quoteVolume24h - prior.quoteVolume24h) / prior.quoteVolume24h) * 100).toFixed(2)
      : '0.00';

    // 4. Price Response
    const priceDiffPct = prior.price > 0 ? ((current.price - prior.price) / prior.price) * 100 : 0;
    let priceResponse = 'STABLE';
    if (priceDiffPct >= 0.5) priceResponse = 'RALLYING';
    else if (priceDiffPct <= -0.5) priceResponse = 'DROPPING';
    else if (Math.abs(parseFloat(buyAggressionDeltaPct)) > 10 && Math.abs(priceDiffPct) < 0.2) priceResponse = 'WEAKENING (ABSORPTION)';
    else if (Math.abs(priceDiffPct) > 0.2) priceResponse = 'STRENGTHENING';

    // 5. Liquidation Pressure
    let liquidationPressure = 'CONTAINED';
    if (current.liquidationCount > prior.liquidationCount || current.liquidationCount >= 3) {
      liquidationPressure = 'RISING';
    }

    return {
      hasHistory: true,
      windowLabel,
      buyAggressionDeltaPct: parseFloat(buyAggressionDeltaPct) >= 0 ? `+${buyAggressionDeltaPct}%` : `${buyAggressionDeltaPct}%`,
      oiDeltaPct: parseFloat(oiDeltaPct) >= 0 ? `+${oiDeltaPct}%` : `${oiDeltaPct}%`,
      volumeDeltaPct: parseFloat(volumeDeltaPct) >= 0 ? `+${volumeDeltaPct}%` : `${volumeDeltaPct}%`,
      priceResponse,
      liquidationPressure,
      sampleCount: history.length,
    };
  }

  clearHistory(symbol) {
    if (symbol) {
      this.historyMap.delete(symbol.toUpperCase());
    } else {
      this.historyMap.clear();
    }
  }
}

export const whatChangedTracker = new WhatChangedTracker();
