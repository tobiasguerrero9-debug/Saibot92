import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const previewData = [
  { time: '00:00', longs: 14.2, shorts: -6.1, price: 67600 },
  { time: '04:00', longs: 22.8, shorts: -8.4, price: 67840 },
  { time: '08:00', longs: 11.5, shorts: -18.2, price: 67720 },
  { time: '12:00', longs: 31.4, shorts: -12.6, price: 68100 },
  { time: '16:00', longs: 18.2, shorts: -24.1, price: 67950 },
  { time: '20:00', longs: 26.5, shorts: -10.8, price: 68320 },
];

export default function SectionMiniAppPreview() {
  return (
    <section id="preview" className="py-24 bg-[#FAFAFC] border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 font-mono">
        
        {/* Large Dark Agent Terminal Container */}
        <div 
          className="rounded-3xl p-8 sm:p-12 space-y-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0E0F14 0%, #14111C 55%, #191321 100%)',
            border: '1px solid rgba(139, 92, 246, 0.34)',
            boxShadow: '0 14px 36px rgba(20, 15, 35, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Section Header inside Terminal */}
          <div className="max-w-3xl space-y-3 border-b border-white/10 pb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded bg-purple-950/40 border border-purple-500/30 text-[#C084FC] text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse"></span>
              <span>PRODUCT PREVIEW</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-[#F8F8FC] tracking-tight">
              SAIBOT92 AGENT MODE
            </h2>
            <p className="text-base sm:text-lg text-[#AEB5C3] font-sans">
              A clean, distilled intelligence terminal engineered for fast market clarity.
            </p>
          </div>

          {/* Top Interface Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-[#F8F8FC]">BTC-PERP</span>
              <span className="px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[#34D399] text-xs font-bold">
                $67,842.11 (+2.34%)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#AEB5C3]">
              <span>Open Interest: <strong className="text-[#C084FC]">$16.2B</strong></span>
              <span className="text-white/20">|</span>
              <span>24h Vol: <strong className="text-[#F8F8FC]">$38.6B</strong></span>
              <span className="text-white/20">|</span>
              <span>Funding: <strong className="text-[#34D399]">+0.0100%</strong></span>
            </div>
          </div>

          {/* Chart View */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold text-[#F8F8FC]">
                Order Flow & Liquidations Context
              </h3>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                <span className="text-[#C084FC] font-bold">● Long Liquidations</span>
                <span className="text-[#FBBF24] font-bold">● Short Liquidations</span>
                <span className="text-[#A78BFA] font-bold">― Index Price</span>
              </div>
            </div>

            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={previewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(val) => `$${Math.abs(val)}M`} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#14111C', 
                      borderColor: 'rgba(139, 92, 246, 0.30)', 
                      borderRadius: '12px', 
                      color: '#F8F8FC',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }} 
                    itemStyle={{ color: '#F8F8FC' }}
                  />
                  <Bar dataKey="longs" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="shorts" fill="#F59E0B" radius={[0, 0, 4, 4]} barSize={14} />
                  <Line type="monotone" dataKey="price" stroke="#C084FC" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-[#AEB5C3] font-sans">
              Evolving agent market scenarios updated in real time.
            </p>

            <Link 
              to="/app"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_6px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_25px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 shrink-0"
            >
              <span>Launch App</span>
              <ArrowUpRight className="w-4 h-4 text-[#F2C94C]" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
