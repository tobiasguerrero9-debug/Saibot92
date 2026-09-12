import React, { useState, useEffect } from 'react';
import { fetchTickers24h } from '../services/binanceRestClient';

const TARGET_SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'BNBUSDT', label: 'BNB' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'XRPUSDT', label: 'XRP' },
  { symbol: 'DOGEUSDT', label: 'DOGE' },
  { symbol: 'ADAUSDT', label: 'ADA' },
  { symbol: 'AVAXUSDT', label: 'AVAX' },
  { symbol: 'LINKUSDT', label: 'LINK' },
  { symbol: 'SUIUSDT', label: 'SUI' },
];

const INITIAL_FALLBACK = [
  { symbol: 'BTCUSDT', label: 'BTC', price: 67842.10, change: 1.24 },
  { symbol: 'ETHUSDT', label: 'ETH', price: 3410.50, change: -0.42 },
  { symbol: 'BNBUSDT', label: 'BNB', price: 588.20, change: 0.85 },
  { symbol: 'SOLUSDT', label: 'SOL', price: 182.40, change: 2.10 },
  { symbol: 'XRPUSDT', label: 'XRP', price: 0.584, change: -0.15 },
  { symbol: 'DOGEUSDT', label: 'DOGE', price: 0.142, change: 3.45 },
  { symbol: 'ADAUSDT', label: 'ADA', price: 0.385, change: -0.80 },
  { symbol: 'AVAXUSDT', label: 'AVAX', price: 28.90, change: 1.15 },
  { symbol: 'LINKUSDT', label: 'LINK', price: 14.60, change: -0.30 },
  { symbol: 'SUIUSDT', label: 'SUI', price: 1.85, change: 4.20 },
];

export default function TopMarketTickerStrip() {
  const [dataMap, setDataMap] = useState(() => {
    const map = {};
    INITIAL_FALLBACK.forEach((item) => {
      map[item.symbol] = item;
    });
    return map;
  });

  useEffect(() => {
    let isMounted = true;

    async function loadTickers() {
      try {
        const rawList = await fetchTickers24h();
        if (!isMounted || !Array.isArray(rawList)) return;

        const updated = {};
        rawList.forEach((t) => {
          const sym = t.symbol ? t.symbol.toUpperCase() : '';
          const targetConfig = TARGET_SYMBOLS.find((s) => s.symbol === sym);
          if (targetConfig) {
            updated[sym] = {
              symbol: sym,
              label: targetConfig.label,
              price: parseFloat(t.lastPrice) || 0,
              change: parseFloat(t.priceChangePercent) || 0,
            };
          }
        });

        if (Object.keys(updated).length > 0) {
          setDataMap((prev) => ({ ...prev, ...updated }));
        }
      } catch (err) {
        console.warn('[SAIBOT92] Ticker strip load error:', err);
      }
    }

    loadTickers();
    const interval = setInterval(loadTickers, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      className="w-full rounded-xl py-2.5 px-4 font-mono overflow-x-auto no-scrollbar"
      style={{
        background: 'linear-gradient(90deg, #0D0E13 0%, #14111C 50%, #0D0E13 100%)',
        border: '1px solid rgba(139, 92, 246, 0.22)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
      }}
    >
      <div className="flex items-center justify-between min-w-max gap-4 sm:gap-6 divide-x divide-white/10 text-xs">
        {TARGET_SYMBOLS.map((target, idx) => {
          const item = dataMap[target.symbol] || {
            label: target.label,
            price: 0,
            change: 0,
          };

          const isUp = item.change >= 0;
          const priceFormatted = item.price > 10
            ? `$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `$${item.price.toFixed(3)}`;

          return (
            <div key={target.symbol} className={`flex items-center gap-2 ${idx > 0 ? 'pl-4 sm:pl-6' : ''}`}>
              <span className="font-bold text-[#F8F8FC] tracking-wider">{item.label}</span>
              <span className="text-[#AEB5C3] font-medium">{priceFormatted}</span>
              <span className={`font-bold ${isUp ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                {isUp ? '+' : ''}{item.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
