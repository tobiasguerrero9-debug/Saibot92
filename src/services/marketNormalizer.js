/**
 * marketNormalizer.js
 * Normalizes raw REST responses and WebSocket payloads into standardized market objects.
 */

export function normalizeSymbolData({ symbol, ticker, openInterest, premiumIndex, klines, liquidations = [] }) {
  const price = ticker ? parseFloat(ticker.lastPrice) : 0;
  const priceChange24h = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const quoteVolume24h = ticker ? parseFloat(ticker.quoteVolume) : 0;
  const high24h = ticker ? parseFloat(ticker.highPrice) : 0;
  const low24h = ticker ? parseFloat(ticker.lowPrice) : 0;

  const openInterestCoins = openInterest ? parseFloat(openInterest.openInterest) : 0;
  const openInterestUsd = openInterestCoins * price;

  const fundingRate = premiumIndex ? parseFloat(premiumIndex.lastFundingRate) : 0;
  const markPrice = premiumIndex ? parseFloat(premiumIndex.markPrice) : price;

  return {
    symbol: symbol.toUpperCase(),
    price,
    priceChange24h,
    quoteVolume24h,
    openInterestUsd,
    openInterestCoins,
    fundingRate,
    markPrice,
    high24h,
    low24h,
    klines: klines || [],
    liquidations: liquidations || [],
    lastUpdated: new Date().toLocaleTimeString([], { hour12: false }),
  };
}

export function normalizeWsMiniTicker(data) {
  // Payload format for <symbol>@miniTicker: { e: "24hrMiniTicker", s: "BTCUSDT", c: "67842.11", ... }
  if (!data) return null;
  return {
    symbol: data.s,
    price: parseFloat(data.c),
    high24h: parseFloat(data.h),
    low24h: parseFloat(data.l),
    quoteVolume24h: parseFloat(data.q),
  };
}

export function normalizeWsAggTrade(data) {
  // Payload format for <symbol>@aggTrade: { e: "aggTrade", s: "BTCUSDT", p: "67842.11", q: "0.15", m: true, ... }
  if (!data) return null;
  return {
    symbol: data.s,
    price: parseFloat(data.p),
    quantity: parseFloat(data.q),
    isSellerBuyerMaker: data.m, // true = seller was maker (buyer was taker)
    time: data.T,
  };
}

export function normalizeWsForceOrder(data) {
  // Payload format for !forceOrder@arr or <symbol>@forceOrder: { e: "forceOrder", o: { s: "BTCUSDT", S: "SELL", p: "67800.00", q: "1.5", ... } }
  if (!data || (!data.o && !data.s)) return null;
  const order = data.o || data;
  return {
    symbol: order.s,
    side: order.S, // "BUY" or "SELL"
    price: parseFloat(order.p),
    quantity: parseFloat(order.q),
    time: order.T || Date.now(),
    isLongLiquidation: order.S === 'SELL',
  };
}
