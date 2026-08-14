/**
 * symbolSubscriptionManager.js
 * Coordinates switching active trading symbols smoothly.
 * Integrates rolling 5-minute memory snapshot tracking via whatChangedTracker.
 * Uses resolveSymbol to ensure valid Binance USD-M Futures tickers are passed.
 */

import { fetchTickers24h, fetchOpenInterest, fetchPremiumIndex, fetchKlines } from './binanceRestClient';
import { normalizeSymbolData, normalizeWsMiniTicker, normalizeWsAggTrade, normalizeWsForceOrder } from './marketNormalizer';
import { wsManager } from './binanceWebSocketManager';
import { marketPollingService } from './marketPollingService';
import { whatChangedTracker } from './whatChangedTracker';
import { resolveSymbol } from './marketUniverseService';

export class SymbolSubscriptionManager {
  constructor() {
    this.currentSymbol = null;
    this.currentTimeframe = '15m';
    this.dataState = null;
    this.listeners = new Set();
    this.connectionState = 'DISCONNECTED'; // CONNECTED | RECONNECTING | OFFLINE | LOADING
    this.staleTimer = null;
    this.isStale = false;
  }

  subscribeState(listener) {
    this.listeners.add(listener);
    if (this.dataState) listener(this.dataState, this.connectionState, this.isStale);
    return () => this.listeners.delete(listener);
  }

  notifyState() {
    if (this.dataState) {
      whatChangedTracker.recordSnapshot(this.dataState);
    }
    this.listeners.forEach((listener) => {
      listener(this.dataState, this.connectionState, this.isStale);
    });
  }

  resetStaleTimer() {
    this.isStale = false;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      this.isStale = true;
      this.notifyState();
    }, 18000);
  }

  async switchSymbol(symbol, timeframe = '15m') {
    let targetSymbol = symbol ? symbol.toUpperCase().trim() : 'BTCUSDT';

    // Auto-resolve user search input to valid active Binance USD-M contract ticker (e.g. 'sol' -> 'SOLUSDT', 'pepe' -> '1000PEPEUSDT')
    try {
      targetSymbol = await resolveSymbol(targetSymbol);
    } catch (e) {
      if (!targetSymbol.endsWith('USDT')) {
        targetSymbol = `${targetSymbol}USDT`;
      }
    }

    // Reset history when switching to a brand new symbol so 5m comparison doesn't cross symbols
    if (this.currentSymbol !== targetSymbol) {
      whatChangedTracker.clearHistory(this.currentSymbol);
    }

    this.unsubscribeCurrent();

    this.currentSymbol = targetSymbol;
    this.currentTimeframe = timeframe;
    this.connectionState = 'LOADING';
    this.dataState = null;
    this.notifyState();

    try {
      const [ticker, openInterest, premiumIndex, klines] = await Promise.all([
        fetchTickers24h(targetSymbol),
        fetchOpenInterest(targetSymbol),
        fetchPremiumIndex(targetSymbol),
        fetchKlines(targetSymbol, timeframe, 30),
      ]);

      this.dataState = normalizeSymbolData({
        symbol: targetSymbol,
        ticker,
        openInterest,
        premiumIndex,
        klines,
        liquidations: [],
      });

      this.connectionState = 'CONNECTED';
      this.resetStaleTimer();
      this.notifyState();

      // Start REST Polling
      marketPollingService.startPolling(targetSymbol, timeframe, {
        onTickerUpdate: ({ ticker: newTicker, klines: newKlines }) => {
          if (this.dataState && newTicker) {
            this.dataState.price = parseFloat(newTicker.lastPrice);
            this.dataState.priceChange24h = parseFloat(newTicker.priceChangePercent);
            this.dataState.quoteVolume24h = parseFloat(newTicker.quoteVolume);
            this.dataState.high24h = parseFloat(newTicker.highPrice);
            this.dataState.low24h = parseFloat(newTicker.lowPrice);
            if (newKlines) this.dataState.klines = newKlines;
            this.resetStaleTimer();
            this.notifyState();
          }
        },
        onOiUpdate: (newOi) => {
          if (this.dataState && newOi) {
            const coins = parseFloat(newOi.openInterest);
            this.dataState.openInterestCoins = coins;
            this.dataState.openInterestUsd = coins * this.dataState.price;
            this.resetStaleTimer();
            this.notifyState();
          }
        },
        onFundingUpdate: (newPremium) => {
          if (this.dataState && newPremium) {
            this.dataState.fundingRate = parseFloat(newPremium.lastFundingRate);
            this.dataState.markPrice = parseFloat(newPremium.markPrice);
            this.resetStaleTimer();
            this.notifyState();
          }
        },
        onError: (context, err) => {
          console.warn(`[${context}]`, err);
        },
      });

      // Start WebSocket Streams
      const streams = [
        `${targetSymbol.toLowerCase()}@miniTicker`,
        `${targetSymbol.toLowerCase()}@aggTrade`,
        `!forceOrder@arr`,
      ];

      wsManager.connect(
        streams,
        (streamName, data) => {
          if (!this.dataState) return;

          if (streamName.endsWith('@miniTicker')) {
            const mini = normalizeWsMiniTicker(data);
            if (mini && mini.symbol === targetSymbol) {
              this.dataState.price = mini.price;
              this.dataState.high24h = mini.high24h;
              this.dataState.low24h = mini.low24h;
              this.dataState.quoteVolume24h = mini.quoteVolume24h;
              this.resetStaleTimer();
              this.notifyState();
            }
          } else if (streamName.endsWith('@aggTrade')) {
            const trade = normalizeWsAggTrade(data);
            if (trade && trade.symbol === targetSymbol) {
              this.dataState.price = trade.price;
              this.resetStaleTimer();
              this.notifyState();
            }
          } else if (streamName.endsWith('@forceOrder') || streamName === '!forceOrder@arr') {
            const liq = normalizeWsForceOrder(data);
            if (liq && liq.symbol === targetSymbol) {
              this.dataState.liquidations = [liq, ...this.dataState.liquidations.slice(0, 19)];
              this.resetStaleTimer();
              this.notifyState();
            }
          }
        },
        (wsStatus) => {
          if (wsStatus === 'CONNECTED') {
            this.connectionState = 'CONNECTED';
          } else if (wsStatus === 'RECONNECTING') {
            this.connectionState = 'RECONNECTING';
          } else if (wsStatus === 'DISCONNECTED') {
            this.connectionState = 'OFFLINE';
          }
          this.notifyState();
        }
      );
    } catch (err) {
      console.error(`Error loading symbol data for ${targetSymbol}:`, err);
      this.connectionState = 'OFFLINE';
      this.notifyState();
    }
  }

  unsubscribeCurrent() {
    marketPollingService.stopPolling();
    wsManager.disconnect();
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
    this.currentSymbol = null;
  }
}

export const subscriptionManager = new SymbolSubscriptionManager();
