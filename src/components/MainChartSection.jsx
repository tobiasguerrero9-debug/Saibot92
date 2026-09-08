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
      <div className="bg-white border border-[#E4E6EC] rounded-xl p-3.5 shadow-md text-xs font-mono space-y-2 min-w-[200px] text-[#12141A]">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#E4E6EC]">
          <span className="text-[#5E6675] font-bold">{data.time}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-rose-600'}`}>
            {isUp ? '+' : ''}{priceChangePct}%
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[#5E6675]">Close Price:</span>
            <span className="font-extrabold text-[#12141A]">
              ${data.close > 10 ? data.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : data.close.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#5E6675]">High / Low:</span>
            <span className="text-[#12141A]">
              ${data.high > 10 ? data.high.toFixed(1) : data.high.toFixed(4)} / ${data.low > 10 ? data.low.toFixed(1) : data.low.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#E4E6EC]">
            <span className="text-[#5E6675]">Taker Volume:</span>
            <span className="font-bold text-[#7C3AED]">
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
      <div className="bg-white rounded-2xl p-8 border border-[#E4E6EC] shadow-xs text-center py-16">
        <p className="text-[#8C94A3] font-mono text-xs">Loading price & volume trajectory stream...</p>
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
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E4E6EC] shadow-xs space-y-6">
      
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E6EC]">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-200">
            <BarChart2 className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-[#12141A] tracking-tight font-mono">
                {marketData.symbol} Trajectory
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-[#F2F3F7] border border-[#E4E6EC] text-[#12141A] text-xs font-mono font-bold">
                {selectedTimeframe} Candle Feed
              </span>
            </div>
            <p className="text-xs text-[#5E6675] font-medium mt-0.5">
              Live Binance USD-M Futures Telemetry
            </p>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 bg-[#F2F3F7] p-1 rounded-xl border border-[#E4E6EC]">
          <button
            onClick={() => setChartMode('price-vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price-vol' ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]' : 'text-[#5E6675] hover:text-[#12141A]'
            }`}
          >
            Price & Volume
          </button>

          <button
            onClick={() => setChartMode('price')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'price' ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]' : 'text-[#5E6675] hover:text-[#12141A]'
            }`}
          >
            Price Only
          </button>

          <button
            onClick={() => setChartMode('vol')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
              chartMode === 'vol' ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]' : 'text-[#5E6675] hover:text-[#12141A]'
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
            <span className="w-3 h-0.5 bg-[#7C3AED] rounded-full"></span>
            <span className="font-bold text-[#12141A]">Close Price ($)</span>
          </div>

          {(chartMode === 'price-vol' || chartMode === 'vol') && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6]"></span>
                <span className="text-[#5E6675]">Bullish Taker Vol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#F2C94C]"></span>
                <span className="text-[#5E6675]">Bearish Taker Vol</span>
              </div>
            </>
          )}
        </div>

        <div className="text-[11px] text-[#8C94A3]">
          Last Price: <strong className="text-[#12141A] font-bold">${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}</strong>
        </div>
      </div>

      {/* Recharts Plotting Container */}
      <div className="h-[360px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={processedKlines} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradientWhiteTheme" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#8C94A3"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#E4E6EC' }}
              dy={5}
            />

            {(chartMode === 'price-vol' || chartMode === 'price') && (
              <YAxis
                yAxisId="priceAxis"
                orientation="left"
                stroke="#5E6675"
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
                stroke="#8C94A3"
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
                fill="#F2C94C"
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
                stroke="#7C3AED"
                strokeWidth={2.5}
                fill="url(#priceGradientWhiteTheme)"
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
