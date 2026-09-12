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
 * Custom Rich Terminal Tooltip Component
 */
const CustomChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    const priceChangePct = data.open ? (((data.close - data.open) / data.open) * 100).toFixed(2) : '0.00';

    return (
      <div 
        className="rounded-xl p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] text-xs font-mono space-y-2 min-w-[200px] border"
        style={{
          backgroundColor: '#14111C',
          borderColor: 'rgba(139, 92, 246, 0.30)',
          color: '#F8F8FC'
        }}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-[#9CA3AF] font-bold">{data.time}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-950/40 border border-emerald-500/30 text-[#34D399]' : 'bg-rose-950/40 border border-rose-500/30 text-rose-500'}`}>
            {isUp ? '+' : ''}{priceChangePct}%
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[#9CA3AF]">Close Price:</span>
            <span className="font-extrabold text-[#F8F8FC]">
              ${data.close > 10 ? data.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.close.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#9CA3AF]">High / Low:</span>
            <span className="text-[#F8F8FC]">
              ${data.high > 10 ? data.high.toFixed(1) : data.high.toFixed(4)} / ${data.low > 10 ? data.low.toFixed(1) : data.low.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-[#9CA3AF]">Taker Volume:</span>
            <span className="font-bold text-[#C084FC]">
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
      <div 
        className="rounded-2xl p-8 text-center py-16 font-mono border"
        style={{
          background: 'linear-gradient(135deg, #0F1015 0%, #14111C 60%, #191321 100%)',
          borderColor: 'rgba(139, 92, 246, 0.30)'
        }}
      >
        <p className="text-[#9CA3AF] text-xs">Loading price & volume trajectory stream...</p>
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
    <div 
      className="rounded-2xl p-6 sm:p-8 space-y-6 font-mono shadow-[0_10px_28px_rgba(20,15,35,0.12)] border"
      style={{
        background: 'linear-gradient(135deg, #0F1015 0%, #14111C 60%, #191321 100%)',
        borderColor: 'rgba(139, 92, 246, 0.30)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 28px rgba(20, 15, 35, 0.12)'
      }}
    >
      
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-purple-950/50 text-[#C084FC] border border-purple-500/30">
            <BarChart2 className="w-5 h-5 text-[#C084FC]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-[#F8F8FC] tracking-tight font-mono">
                {marketData.symbol} Trajectory
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-purple-950/40 border border-purple-500/30 text-[#C084FC] text-xs font-mono font-bold">
                {selectedTimeframe} Candle Feed
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">
              Live Binance USD-M Futures Telemetry
            </p>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-[#13111A] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setChartMode('price-vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price-vol' ? 'bg-[#7C3AED] text-white shadow-xs' : 'text-[#9CA3AF] hover:text-[#F8F8FC]'
            }`}
          >
            Price & Volume
          </button>

          <button
            onClick={() => setChartMode('price')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price' ? 'bg-[#7C3AED] text-white shadow-xs' : 'text-[#9CA3AF] hover:text-[#F8F8FC]'
            }`}
          >
            Price Only
          </button>

          <button
            onClick={() => setChartMode('vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'vol' ? 'bg-[#7C3AED] text-white shadow-xs' : 'text-[#9CA3AF] hover:text-[#F8F8FC]'
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
            <span className="w-3 h-0.5 bg-[#C084FC] rounded-full"></span>
            <span className="font-bold text-[#F8F8FC]">Close Price ($)</span>
          </div>

          {(chartMode === 'price-vol' || chartMode === 'vol') && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6]"></span>
                <span className="text-[#AEB5C3]">Bullish Taker Vol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]"></span>
                <span className="text-[#AEB5C3]">Bearish Taker Vol</span>
              </div>
            </>
          )}
        </div>

        <div className="text-[11px] text-[#9CA3AF]">
          Last Price: <strong className="text-[#F8F8FC] font-bold">${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}</strong>
        </div>
      </div>

      {/* Recharts Plotting Container */}
      <div className="h-[360px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={processedKlines} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradientDarkTheme" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C084FC" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C084FC" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#8F96A5"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.10)' }}
              dy={5}
            />

            {(chartMode === 'price-vol' || chartMode === 'price') && (
              <YAxis
                yAxisId="priceAxis"
                orientation="left"
                stroke="#8F96A5"
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
                stroke="#8F96A5"
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
                fill="#8B5CF6"
                opacity={0.8}
                radius={[2, 2, 0, 0]}
                barSize={7}
                name="Bullish Taker Vol"
              />
            )}
            {(chartMode === 'price-vol' || chartMode === 'vol') && (
              <Bar
                yAxisId="volumeAxis"
                dataKey="sellVolume"
                fill="#F59E0B"
                opacity={0.8}
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
                stroke="#C084FC"
                strokeWidth={2.5}
                fill="url(#priceGradientDarkTheme)"
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
