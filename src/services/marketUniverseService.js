/**
 * marketUniverseService.js
 * Discovers, filters, sorts, and maintains the universe of active Binance USD-M Futures contracts.
 * Provides local search and symbol resolution across the full active USDT perpetual universe.
 */

import { fetchExchangeInfo, fetchTickers24h, fetchPremiumIndex } from './binanceRestClient';

export const FEATURED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

let cachedExchangeSymbols = null;

/**
 * Fetch and cache raw exchangeInfo symbols for fast local search.
 */
export async function fetchActivePerpetualSymbols() {
  if (cachedExchangeSymbols && cachedExchangeSymbols.length > 0) {
    return cachedExchangeSymbols;
  }
  try {
    cachedExchangeSymbols = await fetchExchangeInfo();
    return cachedExchangeSymbols;
  } catch (err) {
    console.warn('Failed to fetch exchangeInfo symbols:', err);
    return [];
  }
}

/**
 * Perform instant local search over the full active Binance USD-M perpetual universe.
 */
export async function searchActiveUniverse(query) {
  if (!query || !query.trim()) return [];
  
  const symbols = await fetchActivePerpetualSymbols();
  const rawQ = query.trim().toUpperCase();
  const cleanQ = rawQ.replace(/\s+/g, '');
  const baseQ = cleanQ.replace(/^1000/, '').replace(/USDT$/, '');

  return symbols
    .filter((s) => {
      const sym = s.symbol.toUpperCase();
      const base = s.baseAsset.toUpperCase();
      return (
        sym.includes(cleanQ) ||
        base.includes(cleanQ) ||
        base.includes(baseQ) ||
        sym.includes(baseQ)
      );
    })
    .map((s) => s.symbol)
    .slice(0, 10);
}

/**
 * Normalize and resolve any user search input into a valid active Binance USD-M perpetual symbol.
 * Example: 'eth' -> 'ETHUSDT', 'sol' -> 'SOLUSDT', 'pepe' -> '1000PEPEUSDT' or 'PEPEUSDT'
 */
export async function resolveSymbol(input) {
  if (!input || typeof input !== 'string') return 'BTCUSDT';
  
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');
  const symbols = await fetchActivePerpetualSymbols();
  
  if (symbols.length === 0) {
    return raw.endsWith('USDT') ? raw : `${raw}USDT`;
  }

  // 1. Direct match
  const exactMatch = symbols.find((s) => s.symbol === raw);
  if (exactMatch) return exactMatch.symbol;

  // 2. Append USDT if missing
  const usdtCandidate = raw.endsWith('USDT') ? raw : `${raw}USDT`;
  const usdtMatch = symbols.find((s) => s.symbol === usdtCandidate);
  if (usdtMatch) return usdtMatch.symbol;

  // 3. Try with 1000 prefix for meme coins (e.g. 'PEPE' -> '1000PEPEUSDT')
  const baseName = raw.replace(/USDT$/, '');
  const thousandMatch = symbols.find((s) => s.symbol === `1000${baseName}USDT`);
  if (thousandMatch) return thousandMatch.symbol;

  // 4. Base asset match
  const baseMatch = symbols.find((s) => s.baseAsset.toUpperCase() === baseName);
  if (baseMatch) return baseMatch.symbol;

  return usdtCandidate;
}

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

    // Cache symbols for local search
    cachedExchangeSymbols = exchangeSymbols;

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
