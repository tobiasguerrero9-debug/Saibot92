import React from 'react';

const readsData = [
  {
    title: 'Order Flow',
    detail: 'Aggressive taker buying and selling pressure across aggregate order books to detect hidden market direction.',
  },
  {
    title: 'Open Interest',
    detail: 'Real-time tracking of fresh capital entering or exiting derivative positions across key perpetual contracts.',
  },
  {
    title: 'Liquidations',
    detail: 'Identification of forced leverage closures and cascading stop-run events before structural support breaks.',
  },
  {
    title: 'Funding Rates',
    detail: 'Derivatives carry costs and positioning skews that highlight overleveraged market conditions.',
  },
  {
    title: 'Market Transitions',
    detail: 'Structural shifts in order book liquidity that signal transition from consolidation to aggressive momentum.',
  },
];

export default function SectionReads() {
  return (
    <section id="reads" className="bg-[#fcfcfd] py-24 border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#7c3aed]">
            TELEMETRY & INPUTS
          </span>
          <h2 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight">
            What SAIBOT92 Reads
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            Continuous real-time ingestion of critical crypto futures telemetry.
          </p>
        </div>

        {/* Large Editorial Layout */}
        <div className="space-y-6">
          {readsData.map((item, idx) => (
            <div 
              key={idx}
              className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-purple-300 transition-all duration-300"
            >
              <div className="flex items-center gap-6 md:w-1/3">
                <span className="text-xl font-mono font-extrabold text-[#7c3aed]">
                  0{idx + 1}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                  {item.title}
                </h3>
              </div>

              <div className="md:w-2/3">
                <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
