/**
 * marketPollingService.js
 * Controls interval polling for 24h ticker stats, open interest, and funding rates.
 * Ensures clean setup and tear down when switching active symbols.
 */

import { fetchTickers24h, fetchOpenInterest, fetchPremiumIndex, fetchKlines } from './binanceRestClient';

export class MarketPollingService {
  constructor() {
    this.tickerInterval = null;
    this.oiInterval = null;
    this.fundingInterval = null;
    this.activeSymbol = null;
    this.activeTimeframe = '15m';
  }

  startPolling(symbol, timeframe, { onTickerUpdate, onOiUpdate, onFundingUpdate, onError }) {
    this.stopPolling();

    this.activeSymbol = symbol.toUpperCase();
    this.activeTimeframe = timeframe;

    // 1. 24h Ticker & Kline Refresh (every 30 seconds)
    this.tickerInterval = setInterval(async () => {
      try {
        if (!this.activeSymbol) return;
        const [ticker, klines] = await Promise.all([
          fetchTickers24h(this.activeSymbol),
          fetchKlines(this.activeSymbol, this.activeTimeframe, 30),
        ]);
        if (onTickerUpdate) onTickerUpdate({ ticker, klines });
      } catch (err) {
        if (onError) onError('24h Ticker Polling Error', err);
      }
    }, 30000);

    // 2. Open Interest Refresh (every 20 seconds)
    this.oiInterval = setInterval(async () => {
      try {
        if (!this.activeSymbol) return;
        const oi = await fetchOpenInterest(this.activeSymbol);
        if (onOiUpdate) onOiUpdate(oi);
      } catch (err) {
        if (onError) onError('Open Interest Polling Error', err);
      }
    }, 20000);

    // 3. Funding & Mark Price Refresh (every 45 seconds)
    this.fundingInterval = setInterval(async () => {
      try {
        if (!this.activeSymbol) return;
        const premium = await fetchPremiumIndex(this.activeSymbol);
        if (onFundingUpdate) onFundingUpdate(premium);
      } catch (err) {
        if (onError) onError('Funding Polling Error', err);
      }
    }, 45000);
  }

  stopPolling() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
    if (this.oiInterval) {
      clearInterval(this.oiInterval);
      this.oiInterval = null;
    }
    if (this.fundingInterval) {
      clearInterval(this.fundingInterval);
      this.fundingInterval = null;
    }
    this.activeSymbol = null;
  }
}

export const marketPollingService = new MarketPollingService();
