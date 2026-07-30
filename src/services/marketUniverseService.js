/**
 * marketUniverseService.js
 * Discovers, filters, sorts, and maintains the universe of active Binance USD-M Futures contracts.
 */

import { fetchExchangeInfo, fetchTickers24h, fetchPremiumIndex } from './binanceRestClient';

export const FEATURED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

/**
 * Fetch and construct the active market universe list sorted by quote volume.
 */
export async function getMarketUniverse() {
  try {
    const [exchangeSymbols, tickers, premiumIndices] = await Promise.all([
      fetchExchangeInfo(),
      fetchTickers24h(),
      fetchPremiumIndex(),
    ]);

    // Create lookup maps for fast matching
    const tickerMap = new Map();
    if (Array.isArray(tickers)) {
      tickers.forEach((t) => tickerMap.set(t.symbol, t));
    }

    const premiumMap = new Map();
    if (Array.isArray(premiumIndices)) {
      premiumIndices.forEach((p) => premiumMap.set(p.symbol, p));
    }

    const universe = exchangeSymbols
      .map((s) => {
        const symbol = s.symbol;
        const ticker = tickerMap.get(symbol);
        const premium = premiumMap.get(symbol);

        const price = ticker ? parseFloat(ticker.lastPrice) : 0;
        const priceChange24h = ticker ? parseFloat(ticker.priceChangePercent) : 0;
        const quoteVolume24h = ticker ? parseFloat(ticker.quoteVolume) : 0;
        const fundingRate = premium ? parseFloat(premium.lastFundingRate) : 0;
        const markPrice = premium ? parseFloat(premium.markPrice) : price;

        return {
          symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          price,
          priceChange24h,
          quoteVolume24h,
          fundingRate,
          markPrice,
          isFeatured: FEATURED_SYMBOLS.includes(symbol),
          status: 'TRADING',
        };
      })
      .filter((item) => item.price > 0 && item.quoteVolume24h > 1000); // Filter out zero/illiquid items

    // Sort by 24h Quote Volume descending
    universe.sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);

    return universe;
  } catch (error) {
    console.error('Failed to build market universe:', error);
    throw error;
  }
}
