import React from 'react';

const steps = [
  {
    step: '01',
    title: 'Market Data Ingestion',
    text: 'Raw order flow, open interest velocity, funding skews, and liquidation prints are gathered continuously across top liquid futures venues.',
    accent: 'text-[#C084FC]',
    borderTop: 'border-t-[#C084FC]',
    badgeBg: 'bg-purple-950/50',
    badgeBorder: 'border-purple-500/30'
  },
  {
    step: '02',
    title: 'Human Trading Logic',
    text: 'Proven market structural rules and context relationships interpret order book absorption, liquidity traps, and positioning bias.',
    accent: 'text-[#22D3EE]',
    borderTop: 'border-t-[#22D3EE]',
    badgeBg: 'bg-cyan-950/50',
    badgeBorder: 'border-cyan-500/30'
  },
  {
    step: '03',
    title: 'Evolving Scenarios',
    text: 'The SAIBOT92 agent synthesizes inputs into clean, actionable market scenarios before significant volatility materializes.',
    accent: 'text-[#FBBF24]',
    borderTop: 'border-t-[#FBBF24]',
    badgeBg: 'bg-amber-950/50',
    badgeBorder: 'border-amber-500/30'
  },
];

export default function SectionPurpleContext() {
  return (
    <section id="context" className="py-24 bg-white border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        {/* Terminal Surface Container Card */}
        <div 
          className="rounded-[32px] p-8 sm:p-14 space-y-12 relative overflow-hidden font-mono"
          style={{
            background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
            border: '1px solid rgba(139, 92, 246, 0.30)',
            boxShadow: '0 12px 32px rgba(20, 15, 35, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          
          {/* Section Header */}
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-purple-950/40 border border-purple-500/30 text-[#C084FC] text-xs font-bold uppercase tracking-widest">
              <span>METHODOLOGY & ARCHITECTURE</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-[#F8F8FC] tracking-tight pt-2">
              FROM RAW DATA TO CONTEXT
            </h2>
            <p className="text-[#AEB5C3] text-base sm:text-lg font-sans leading-relaxed">
              Transforming complex exchange order book noise into structured, deterministic market context.
            </p>
          </div>

          {/* 3 Step Terminal Modules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, idx) => (
              <div 
                key={idx}
                className={`rounded-2xl border border-white/10 border-t-2 ${s.borderTop} p-6 sm:p-8 space-y-6 flex flex-col justify-between transition-all duration-200`}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.035)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${s.badgeBg} border ${s.badgeBorder} ${s.accent} font-black text-sm flex items-center justify-center`}>
                    {s.step}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest">
                    <span className={s.accent}>PHASE {s.step}</span>
                    {idx < 2 && <span className="text-[#9CA3AF] hidden md:inline ml-1 font-sans">→</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-[#F8F8FC] tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#AEB5C3] font-sans leading-relaxed">
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
