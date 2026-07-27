import React, { useState, useEffect } from 'react';

const initialMetrics = [
  { id: 'btc', label: 'BTC Price', value: 67842.11, prefix: '$', change: 2.34, isPositive: true, decimals: 2 },
  { id: 'vol', label: '24h Volume', value: 38.6, prefix: '$', suffix: 'B', change: 12.8, isPositive: true, decimals: 1 },
  { id: 'liq', label: 'Liquidations (24h)', value: 24.3, prefix: '$', suffix: 'M', change: -6.21, isPositive: false, decimals: 1 },
  { id: 'oi', label: 'Open Interest', value: 16.2, prefix: '$', suffix: 'B', change: 8.9, isPositive: true, decimals: 1 },
  { id: 'funding', label: 'Funding Rate', value: 0.010, suffix: '%', changeValue: '+0.003%', isPositive: true, decimals: 3 },
];

export default function LiveMetricsStrip() {
  const [metrics, setMetrics] = useState(initialMetrics);

  useEffect(() => {
    const interval = setInterval(() => {
      const targetIndex = Math.floor(Math.random() * metrics.length);
      setMetrics((prev) =>
        prev.map((m, idx) => {
          if (idx === targetIndex) {
            const delta = (Math.random() - 0.48) * 0.15;
            let updatedVal = m.value;
            if (m.id === 'btc') updatedVal = +(m.value + delta * 20).toFixed(2);
            else if (m.id === 'funding') updatedVal = +(m.value + delta * 0.0005).toFixed(3);
            else updatedVal = +(m.value + delta * 0.05).toFixed(1);
            return { ...m, value: updatedVal };
          }
          return m;
        })
      );
    }, 2800);

    return () => clearInterval(interval);
  }, [metrics]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="py-6 border-y border-purple-900/30">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-left">
          {metrics.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">
                {m.label}
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-mono font-extrabold text-white tracking-tight">
                  {m.prefix || ''}
                  {m.value.toLocaleString(undefined, { minimumFractionDigits: m.decimals })}
                  {m.suffix || ''}
                </span>
                <span className={`text-xs font-mono font-bold ${m.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.isPositive ? '+' : ''}
                  {m.changeValue || `${m.change}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
