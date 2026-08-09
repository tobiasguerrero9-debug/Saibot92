import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

/**
 * Custom Rich Light Tooltip Component
 */
const CustomChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    const priceChangePct = data.open ? (((data.close - data.open) / data.open) * 100).toFixed(2) : '0.00';

    return (
      <div className="bg-white/95 backdrop-blur-md border border-purple-200/90 rounded-2xl p-4 shadow-xl text-xs font-mono space-y-2.5 min-w-[200px] text-slate-900">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-slate-500 font-bold">{data.time}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isUp ? '+' : ''}{priceChangePct}%
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Close Price:</span>
            <span className="font-extrabold text-slate-950">
              ${data.close > 10 ? data.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.close.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">High / Low:</span>
            <span className="text-slate-700">
              ${data.high > 10 ? data.high.toFixed(1) : data.high.toFixed(4)} / ${data.low > 10 ? data.low.toFixed(1) : data.low.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-slate-500">Taker Volume:</span>
            <span className={`font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(data.quoteVolume ? data.quoteVolume / 1e6 : data.volume).toFixed(2)}M USDT
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function MainChartSection({ marketData, selectedTimeframe }) {
  const [chartMode, setChartMode] = useState('price-vol'); // 'price-vol' | 'price' | 'vol'

  if (!marketData || !marketData.klines || marketData.klines.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center py-16">
        <p className="text-slate-400 font-mono text-xs">Loading price & volume trajectory stream...</p>
      </div>
    );
  }

  const processedKlines = marketData.klines.map((k) => {
    const isUp = k.close >= k.open;
    return {
      ...k,
      buyVolume: isUp ? k.volume : 0,
      sellVolume: !isUp ? k.volume : 0,
      isUp,
    };
  });

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-6">
      
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] border border-purple-200">
            <BarChart2 className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-950 tracking-tight">
                {marketData.symbol} Trajectory
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                {selectedTimeframe} Candle Feed
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live Binance USD-M Futures Telemetry
            </p>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
          <button
            onClick={() => setChartMode('price-vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price-vol' ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Price & Volume
          </button>

          <button
            onClick={() => setChartMode('price')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price' ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Price Only
          </button>

          <button
            onClick={() => setChartMode('vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'vol' ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Volume Only
          </button>
        </div>

      </div>

      {/* Indicator Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono px-1">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#7c3aed] rounded-full"></span>
            <span className="font-bold text-slate-800">Close Price ($)</span>
          </div>

          {(chartMode === 'price-vol' || chartMode === 'vol') && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span className="text-slate-600">Bullish Taker Vol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                <span className="text-slate-600">Bearish Taker Vol</span>
              </div>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Last Price: <strong className="text-slate-900 font-bold">${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}</strong>
        </div>
      </div>

      {/* Recharts Light Plotting Container */}
      <div className="h-[360px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={processedKlines} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradientLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              dy={5}
            />

            {(chartMode === 'price-vol' || chartMode === 'price') && (
              <YAxis
                yAxisId="priceAxis"
                orientation="left"
                stroke="#64748b"
                fontSize={11}
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val > 10 ? `$${val.toLocaleString()}` : `$${val.toFixed(3)}`)}
              />
            )}

            {(chartMode === 'price-vol' || chartMode === 'vol') && (
              <YAxis
                yAxisId="volumeAxis"
                orientation="right"
                stroke="#94a3b8"
                fontSize={10}
                domain={[0, 'auto']}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val > 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
            )}

            <Tooltip content={<CustomChartTooltip />} />

            {(chartMode === 'price-vol' || chartMode === 'vol') && (
              <Bar
                yAxisId="volumeAxis"
                dataKey="buyVolume"
                fill="#10b981"
                opacity={0.7}
                radius={[2, 2, 0, 0]}
                barSize={7}
                name="Bullish Taker Vol"
              />
            )}
            {(chartMode === 'price-vol' || chartMode === 'vol') && (
              <Bar
                yAxisId="volumeAxis"
                dataKey="sellVolume"
                fill="#f43f5e"
                opacity={0.7}
                radius={[2, 2, 0, 0]}
                barSize={7}
                name="Bearish Taker Vol"
              />
            )}

            {(chartMode === 'price-vol' || chartMode === 'price') && (
              <Area
                yAxisId="priceAxis"
                type="monotone"
                dataKey="close"
                stroke="#7c3aed"
                strokeWidth={3}
                fill="url(#priceGradientLight)"
                dot={false}
                name="Close Price ($)"
              />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
