/**
 * Binance USD-M Futures Public Market Data Service
 * Public REST API endpoints - Requires zero API keys or authentication.
 */

const BASE_URL = 'https://fapi.binance.com/fapi/v1';

export async function fetchFuturesMarketData(symbol, interval = '15m') {
  const upperSymbol = symbol.toUpperCase();

  try {
    const [tickerRes, oiRes, premiumRes, klinesRes] = await Promise.all([
      fetch(`${BASE_URL}/ticker/24hr?symbol=${upperSymbol}`),
      fetch(`${BASE_URL}/openInterest?symbol=${upperSymbol}`),
      fetch(`${BASE_URL}/premiumIndex?symbol=${upperSymbol}`),
      fetch(`${BASE_URL}/klines?symbol=${upperSymbol}&interval=${interval}&limit=30`),
    ]);

    if (!tickerRes.ok || !oiRes.ok || !premiumRes.ok || !klinesRes.ok) {
      throw new Error(`Binance API returned error status: ${tickerRes.status}`);
    }

    const ticker = await tickerRes.json();
    const oi = await oiRes.json();
    const premium = await premiumRes.json();
    const klinesRaw = await klinesRes.json();

    // Try fetching recent liquidations if endpoint allows, gracefully handle fallback if restricted
    let liquidations = [];
    try {
      const liqRes = await fetch(`${BASE_URL}/allForceOrders?symbol=${upperSymbol}&limit=10`);
      if (liqRes.ok) {
        liquidations = await liqRes.json();
      }
    } catch {
      liquidations = [];
    }

    // Process klines into candle object
    const klines = klinesRaw.map((k) => ({
      time: new Date(k[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      quoteVolume: parseFloat(k[7]),
    }));

    // Process price & volume
    const price = parseFloat(ticker.lastPrice);
    const priceChange = parseFloat(ticker.priceChangePercent);
    const volume24h = parseFloat(ticker.quoteVolume);
    const openInterestCoins = parseFloat(oi.openInterest);
    const openInterestUsd = openInterestCoins * price;
    const fundingRate = parseFloat(premium.lastFundingRate);

    return {
      symbol: upperSymbol,
      price,
      priceChange,
      volume24h,
      openInterestUsd,
      openInterestCoins,
      fundingRate,
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice),
      klines,
      liquidations,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    };
  } catch (error) {
    console.error('Binance API Fetch Error:', error);
    throw error;
  }
}
