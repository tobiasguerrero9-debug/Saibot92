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
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12 font-mono">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded bg-purple-50/90 border border-[#7C3AED]/30 text-[#6D28D9] text-xs font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>PRODUCT PREVIEW</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-[#10131A] tracking-tight">
            SAIBOT92 AGENT MODE
          </h2>
          <p className="text-base sm:text-lg text-[#4E5666] font-sans">
            A clean, distilled intelligence terminal engineered for fast market clarity.
          </p>
        </div>

        {/* Product Preview Container */}
        <div className="rounded-3xl bg-gradient-to-br from-white to-[#F7F8FB] border border-[#D4D8E2] border-t-4 border-t-[#7C3AED] p-8 sm:p-12 shadow-[0_6px_24px_rgba(124,58,237,0.08)] space-y-8">
          
          {/* Top Interface Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#D4D8E2]">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-[#10131A]">BTC-PERP</span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#10B981] text-xs font-bold">
                $67,842.11 (+2.34%)
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#4E5666]">
              <span>Open Interest: <strong className="text-[#10131A]">$16.2B</strong></span>
              <span>24h Vol: <strong className="text-[#10131A]">$38.6B</strong></span>
              <span>Funding: <strong className="text-[#10B981]">+0.0100%</strong></span>
            </div>
          </div>

          {/* Chart View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#10131A]">
                Order Flow & Liquidations Context
              </h3>
              <div className="flex items-center space-x-6 text-xs">
                <span className="text-[#6D28D9] font-bold">● Long Liquidations</span>
                <span className="text-[#C58A00] font-bold">● Short Liquidations</span>
                <span className="text-[#5B21B6] font-bold">― Index Price</span>
              </div>
            </div>

            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={previewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="time" stroke="#7C8494" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7C8494" fontSize={12} tickFormatter={(val) => `$${Math.abs(val)}M`} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#D4D8E2', borderRadius: '12px', color: '#10131A' }} />
                  <Bar dataKey="longs" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="shorts" fill="#F2C94C" radius={[0, 0, 4, 4]} barSize={14} />
                  <Line type="monotone" dataKey="price" stroke="#7C3AED" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-6 border-t border-[#D4D8E2] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-[#4E5666] font-sans">
              Evolving agent market scenarios updated in real time.
            </p>

            <Link 
              to="/app"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_6px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_25px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2"
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
