import React from 'react';
import { Activity, BarChart2, Zap, DollarSign, Layers } from 'lucide-react';

const readsData = [
  {
    icon: Activity,
    title: 'Order Flow & Taker Imbalance',
    detail: 'Aggressive taker buying and selling pressure across aggregate order books to detect hidden market direction.',
  },
  {
    icon: BarChart2,
    title: 'Open Interest Velocity',
    detail: 'Real-time tracking of fresh capital entering or exiting derivative positions across key perpetual contracts.',
  },
  {
    icon: Zap,
    title: 'Liquidation Pressure',
    detail: 'Identification of forced leverage closures and cascading stop-run events before structural support breaks.',
  },
  {
    icon: DollarSign,
    title: 'Funding Carry Rates',
    detail: 'Derivatives carry costs and positioning skews that highlight overleveraged market conditions.',
  },
  {
    icon: Layers,
    title: 'Market Transitions',
    detail: 'Structural shifts in order book liquidity that signal transition from consolidation to aggressive momentum.',
  },
];

export default function SectionReads() {
  return (
    <section id="reads" className="bg-[#fafafa] py-20 border-t border-purple-100">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#7c3aed]">
            TELEMETRY & INPUTS
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
            What SAIBOT92 Reads
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Continuous real-time ingestion of critical crypto futures telemetry.
          </p>
        </div>

        {/* 5 Clean Editorial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {readsData.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div 
                key={idx}
                className="p-7 rounded-3xl bg-white border border-purple-100/80 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-4 hover:border-purple-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-purple-50 text-[#7c3aed] border border-purple-100">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    0{idx + 1}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
