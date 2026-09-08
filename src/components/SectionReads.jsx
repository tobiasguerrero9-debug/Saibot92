import React from 'react';

const readsData = [
  {
    number: '01',
    title: 'Order Flow Velocity',
    detail: 'Aggressive taker buy vs sell volume imbalance across Binance USD-M futures order books to detect institutional absorption.',
    badge: 'TAKER VOLUME',
  },
  {
    number: '02',
    title: 'Open Interest Drift',
    detail: 'Real-time monitoring of fresh capital entering or exiting derivative positions across liquid perpetual contracts.',
    badge: 'DERIVATIVES LEVERAGE',
  },
  {
    number: '03',
    title: 'Liquidation Cascades',
    detail: 'Identification of forced leverage closures and cascading stop-run events before key structural support breaks.',
    badge: 'STOP-RUN RISK',
  },
  {
    number: '04',
    title: 'Funding Carry Skews',
    detail: 'Derivatives carry costs and positioning skews that highlight overleveraged long/short market crowding.',
    badge: 'POSITIONING SKEW',
  },
  {
    number: '05',
    title: 'Market State Transitions',
    detail: 'Structural shifts in order book liquidity that signal transition from low-volatility consolidation to aggressive momentum.',
    badge: 'STATE CLASSIFIER',
  },
];

export default function SectionReads() {
  return (
    <section id="reads" className="bg-[#FAFAFC] py-24 border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-14">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl space-y-3 font-mono">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-purple-50/90 border border-[#7C3AED]/30 text-[#6D28D9] text-xs font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#6D28D9] animate-pulse"></span>
            <span>TELEMETRY & INPUTS</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-[#10131A] tracking-tight">
            WHAT SAIBOT92 READS
          </h2>
          <p className="text-base sm:text-lg text-[#4E5666] font-sans leading-relaxed">
            Continuous real-time ingestion of critical crypto futures telemetry straight from exchange order books.
          </p>
        </div>

        {/* Compact Dark Mini Terminal Cards Layout */}
        <div className="space-y-4 font-mono">
          {readsData.map((item, idx) => (
            <div 
              key={idx}
              className="p-5 sm:p-6 rounded-2xl transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[rgba(139,92,246,0.6)]"
              style={{
                background: 'linear-gradient(135deg, #111218 0%, #17141F 55%, #1C1528 100%)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderLeft: '4px solid #8B5CF6',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(20, 15, 35, 0.10)'
              }}
            >
              <div className="flex items-center gap-6 md:w-5/12">
                <span className="text-3xl sm:text-4xl font-black text-[#8B5CF6] shrink-0">
                  {item.number}
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F2C94C] block mb-0.5">
                    {item.badge}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#F8F8FC] tracking-tight">
                    {item.title}
                  </h3>
                </div>
              </div>

              <div className="md:w-7/12 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 font-sans">
                <p className="text-sm sm:text-base text-[#B8BECC] leading-relaxed">
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
