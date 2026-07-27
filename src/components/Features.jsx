import React from 'react';

const primaryFeatures = [
  {
    num: '01',
    title: 'Real-Time Intelligence',
    description: 'Track order flow, open interest, and liquidations as they happen with millisecond precision and zero lagging indicators.',
  },
  {
    num: '02',
    title: 'Signal Detection',
    description: 'AI agents scan order book depth, delta imbalances, and high-probability market shift setups automatically.',
  },
  {
    num: '03',
    title: 'Risk-Aware Execution',
    description: 'Transform complex futures market data into decisive action with institutional-grade risk awareness.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Section Headline */}
      <div className="mb-16 space-y-3">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
          CORE CAPABILITIES
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Built for Smarter Decisions
        </h2>
      </div>

      {/* Editorial Large Block Layout (Inspired by Reference Image 2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {primaryFeatures.map((feat, idx) => (
          <div 
            key={idx} 
            className="rounded-[32px] bg-[#0c0618] border border-purple-500/20 p-8 sm:p-10 flex flex-col justify-between min-h-[320px] hover:border-purple-400/40 transition-all duration-300 group"
          >
            {/* Index badge */}
            <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-300 font-mono font-bold text-sm group-hover:scale-110 transition-transform">
              {feat.num}
            </div>

            {/* Title & Description */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {feat.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {feat.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Large Featured Editorial Banner Block */}
      <div className="mt-8 rounded-[32px] bg-gradient-to-r from-[#14082e] to-[#0a0418] border border-purple-500/25 p-8 sm:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
            CONTEXT ENGINE
          </span>
          <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Order Flow & Liquidation Analysis Engine
          </h3>
          <p className="text-slate-300 text-base max-w-2xl font-normal leading-relaxed">
            SAIBOT92 monitors leverage accumulation, funding rate skew, and liquidation clusters in real time so traders can navigate high volatility with total confidence.
          </p>
        </div>
        <div className="lg:col-span-4 flex justify-start lg:justify-end">
          <div className="w-24 h-24 rounded-full bg-purple-900/30 border border-purple-500/30 flex items-center justify-center">
            <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-16 h-16 object-contain" />
          </div>
        </div>
      </div>

    </section>
  );
}
