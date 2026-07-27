import React from 'react';

const steps = [
  {
    step: '01',
    title: 'Market Data Collection',
    text: 'Raw order flow, open interest velocity, funding skews, and liquidation prints are gathered continuously across top liquid futures venues.',
  },
  {
    step: '02',
    title: 'Human Trading Logic',
    text: 'Proven market structural rules and context relationships interpret order book absorption, liquidity traps, and positioning bias.',
  },
  {
    step: '03',
    title: 'Evolving Scenarios',
    text: 'The SAIBOT92 agent synthesizes inputs into clean, actionable market scenarios before significant volatility materializes.',
  },
];

export default function SectionPurpleContext() {
  return (
    <section id="context" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        {/* Massive Purple Container Section (Inspired by Editorial Reference Image) */}
        <div className="rounded-[36px] sm:rounded-[48px] bg-[#7c3aed] text-white p-8 sm:p-16 lg:p-20 shadow-2xl space-y-16">
          
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-200">
              METHODOLOGY & ARCHITECTURE
            </span>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
              From Raw Data to Context
            </h2>
            <p className="text-purple-100 text-lg sm:text-xl font-medium">
              Transforming complex noise into structured market intelligence.
            </p>
          </div>

          {/* 3 Step Editorial Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, idx) => (
              <div 
                key={idx}
                className="rounded-3xl bg-white/95 text-slate-900 p-8 sm:p-10 flex flex-col justify-between space-y-8 shadow-xl"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 text-[#7c3aed] font-mono font-black text-lg flex items-center justify-center">
                  {s.step}
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-base text-slate-600 font-medium leading-relaxed">
                    {s.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
