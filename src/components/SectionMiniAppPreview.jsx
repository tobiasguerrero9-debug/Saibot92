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
    <section id="preview" className="py-24 bg-[#fcfcfd] border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#7c3aed]">
            PRODUCT PREVIEW
          </span>
          <h2 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight">
            SAIBOT92 Agent Mode
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            A clean, distilled intelligence terminal engineered for fast market clarity.
          </p>
        </div>

        {/* Product Preview Container */}
        <div className="rounded-[36px] bg-white border border-slate-200/80 p-8 sm:p-14 shadow-[0_4px_25px_rgba(0,0,0,0.03)] space-y-8">
          
          {/* Top Interface Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 font-mono">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-950">BTC-PERP</span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                $67,842.11 (+2.34%)
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-500">
              <span>Open Interest: <strong className="text-slate-900">$16.2B</strong></span>
              <span>24h Vol: <strong className="text-slate-900">$38.6B</strong></span>
              <span>Funding: <strong className="text-emerald-600">+0.0100%</strong></span>
            </div>
          </div>

          {/* Light Chart View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950">
                Order Flow & Liquidations Context
              </h3>
              <div className="flex items-center space-x-6 text-xs font-mono">
                <span className="text-emerald-600 font-bold">● Long Liquidations</span>
                <span className="text-rose-600 font-bold">● Short Liquidations</span>
                <span className="text-[#7c3aed] font-bold">― Index Price</span>
              </div>
            </div>

            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={previewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `$${Math.abs(val)}M`} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a' }} />
                  <Bar dataKey="longs" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="shorts" fill="#f43f5e" radius={[0, 0, 4, 4]} barSize={14} />
                  <Line type="monotone" dataKey="price" stroke="#7c3aed" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600 font-medium">
              Evolving agent market scenarios updated in real time.
            </p>

            <Link 
              to="/app"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-sm transition-all shadow-[0_4px_14px_rgba(124,58,237,0.3)] flex items-center justify-center gap-2"
            >
              <span>Launch App</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
