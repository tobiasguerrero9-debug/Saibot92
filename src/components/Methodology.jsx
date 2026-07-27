import React from 'react';

const methodologySteps = [
  {
    step: '01',
    title: 'Live Data Ingestion',
    description: 'Continuously streams live order book depth, taker trades, open interest, and liquidation feeds across top perpetual exchanges.',
  },
  {
    step: '02',
    title: 'Order Flow Interpretation',
    description: 'Filters out market noise to compute delta skews, aggressive limit order placement, and leverage liquidation thresholds.',
  },
  {
    step: '03',
    title: 'Agentic Context Engine',
    description: 'Evaluates structural market dynamics against historic order flow setups to determine probability distribution.',
  },
  {
    step: '04',
    title: 'Actionable Intelligence',
    description: 'Delivers clean visual dashboards and real-time agent alerts designed for instant execution clarity.',
  },
];

export default function Methodology() {
  return (
    <section id="methodology" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* High-Contrast Vivid Purple Editorial Container (Inspired by Reference Image Section 3) */}
      <div className="rounded-[32px] sm:rounded-[40px] bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 p-8 sm:p-14 text-white shadow-[0_25px_90px_rgba(124,58,237,0.35)]">
        
        {/* Section Title */}
        <div className="max-w-3xl mb-14 space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-200">
            METHODOLOGY
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            How SAIBOT92 Operates
          </h2>
          <p className="text-purple-100 text-base sm:text-lg font-normal">
            SAIBOT92 transforms complex futures data into clear, actionable intelligence.
          </p>
        </div>

        {/* 4-Step Grid with Editorial White Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {methodologySteps.map((s, idx) => (
            <div 
              key={idx}
              className="rounded-2xl bg-white/95 text-slate-900 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl backdrop-blur-md"
            >
              <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-full bg-purple-100 text-purple-800 w-fit">
                {s.step}
              </span>

              <div className="space-y-2">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {s.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
