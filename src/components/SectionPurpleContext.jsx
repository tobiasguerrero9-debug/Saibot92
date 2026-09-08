import React from 'react';

const steps = [
  {
    step: '01',
    title: 'Market Data Ingestion',
    text: 'Raw order flow, open interest velocity, funding skews, and liquidation prints are gathered continuously across top liquid futures venues.',
    accent: 'text-[#6D28D9]'
  },
  {
    step: '02',
    title: 'Human Trading Logic',
    text: 'Proven market structural rules and context relationships interpret order book absorption, liquidity traps, and positioning bias.',
    accent: 'text-[#0891B2]'
  },
  {
    step: '03',
    title: 'Evolving Scenarios',
    text: 'The SAIBOT92 agent synthesizes inputs into clean, actionable market scenarios before significant volatility materializes.',
    accent: 'text-[#5B21B6]'
  },
];

export default function SectionPurpleContext() {
  return (
    <section id="context" className="py-24 bg-white border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        {/* Soft Purple Container Card */}
        <div className="rounded-[32px] bg-purple-50/70 border border-purple-200 p-8 sm:p-14 space-y-12 shadow-xs">
          
          {/* Editorial Section Header */}
          <div className="max-w-3xl space-y-3 font-mono">
            <span className="text-xs font-bold uppercase tracking-widest text-[#6D28D9] px-3.5 py-1 rounded bg-white border border-purple-200">
              METHODOLOGY & ARCHITECTURE
            </span>
            <h2 className="text-4xl sm:text-6xl font-black text-[#10131A] tracking-tight pt-2">
              FROM RAW DATA TO CONTEXT
            </h2>
            <p className="text-[#4E5666] text-base sm:text-lg font-sans leading-relaxed">
              Transforming complex exchange order book noise into structured, deterministic market context.
            </p>
          </div>

          {/* 3 Step Editorial Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
            {steps.map((s, idx) => (
              <div 
                key={idx}
                className="rounded-2xl bg-gradient-to-br from-white to-[#FAF8FF] border border-[#D4D8E2] border-t-2 border-t-[#7C3AED] p-8 space-y-6 shadow-[0_4px_18px_rgba(20,24,40,0.06)] hover:border-[#7C3AED] transition-all duration-200 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 ${s.accent} font-black text-base flex items-center justify-center`}>
                    {s.step}
                  </div>
                  <span className="text-[10px] text-[#C58A00] font-bold uppercase tracking-widest">PHASE {s.step}</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-[#10131A] tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4E5666] font-sans leading-relaxed">
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
