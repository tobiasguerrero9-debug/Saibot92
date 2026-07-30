/**
 * binanceRestClient.js
 * Public REST API client for Binance USD-M Futures.
 * Uses only public endpoints requiring zero authentication.
 */

const BASE_URL = 'https://fapi.binance.com/fapi/v1';

/**
 * Fetch exchange metadata to discover all trading USDT perpetual contracts.
 */
export async function fetchExchangeInfo() {
  const response = await fetch(`${BASE_URL}/exchangeInfo`);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} fetching exchangeInfo`);
  }
  const data = await response.json();
  return data.symbols.filter(
    (s) =>
      s.contractType === 'PERPETUAL' &&
      s.quoteAsset === 'USDT' &&
      s.status === 'TRADING'
  );
}

/**
 * Fetch 24h ticker statistics for all symbols or a single symbol.
 */
export async function fetchTickers24h(symbol = null) {
  const url = symbol
    ? `${BASE_URL}/ticker/24hr?symbol=${symbol.toUpperCase()}`
    : `${BASE_URL}/ticker/24hr`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} fetching 24hr tickers`);
  }
  return await response.json();
}

/**
 * Fetch funding rate and mark price for all symbols or a single symbol.
 */
export async function fetchPremiumIndex(symbol = null) {
  const url = symbol
    ? `${BASE_URL}/premiumIndex?symbol=${symbol.toUpperCase()}`
    : `${BASE_URL}/premiumIndex`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} fetching premiumIndex`);
  }
  return await response.json();
}

/**
 * Fetch open interest for a specific symbol.
 */
export async function fetchOpenInterest(symbol) {
  const url = `${BASE_URL}/openInterest?symbol=${symbol.toUpperCase()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} fetching openInterest for ${symbol}`);
  }
  return await response.json();
}

/**
 * Fetch kline candlestick OHLCV data for a specific symbol.
 */
export async function fetchKlines(symbol, interval = '15m', limit = 30) {
  const url = `${BASE_URL}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} fetching klines for ${symbol}`);
  }
  const rawData = await response.json();
  return rawData.map((k) => ({
    time: new Date(k[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    quoteVolume: parseFloat(k[7]),
  }));
}
