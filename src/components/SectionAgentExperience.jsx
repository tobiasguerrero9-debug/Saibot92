import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Activity, ArrowUpRight } from 'lucide-react';

export default function SectionAgentExperience() {
  return (
    <section className="bg-white py-24 border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 font-mono">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-purple-50/90 border border-[#7C3AED]/30 text-[#6D28D9] text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <span>AGENT OBSERVATION MATRIX</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-[#10131A] tracking-tight">
              LIVE MARKET INTELLIGENCE
            </h2>
            <p className="text-base sm:text-lg text-[#4E5666] font-sans leading-relaxed">
              Every second, the agent classifies market state, tracks delta shifts, and projects high-probability scenarios.
            </p>
          </div>

          <Link
            to="/app"
            className="px-6 py-3 rounded-xl bg-white hover:bg-purple-50 text-[#6D28D9] font-bold text-xs uppercase tracking-wider transition-all border border-[#D4D8E2] hover:border-[#7C3AED] flex items-center gap-2 shrink-0 self-start md:self-auto shadow-[0_2px_10px_rgba(20,24,40,0.04)]"
          >
            <span>Open Live Agent</span>
            <ArrowUpRight className="w-4 h-4 text-[#C58A00]" />
          </Link>
        </div>

        {/* Quant Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch font-mono">
          
          {/* Agent State Card (Left) */}
          <div className="lg:col-span-6 bg-gradient-to-br from-white via-[#FAF8FF] to-[#F4F0FF] rounded-2xl p-8 border border-[rgba(124,58,237,0.28)] border-t-4 border-t-[#7C3AED] space-y-6 flex flex-col justify-between shadow-[0_6px_24px_rgba(124,58,237,0.08)]">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-4">
                <div className="flex items-center gap-2 text-[#6D28D9]">
                  <Terminal className="w-4 h-4 text-[#6D28D9]" />
                  <span className="text-xs font-bold uppercase tracking-wider">LIVE AGENT CLASSIFIER</span>
                </div>
                <span className="text-[11px] text-[#7C8494]">EVALUATING REAL-TIME</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#10B981] animate-pulse"></span>
                  <h3 className="text-3xl sm:text-4xl font-black text-[#10131A] tracking-tight">
                    ABSORPTION_BULLISH
                  </h3>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span className="px-3 py-1 rounded-lg bg-purple-50 border border-purple-200 text-xs font-bold text-[#5B21B6]">
                    Context Score: 84/100
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#10B981]">
                    Market Bias: BULLISH
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#4E5666] font-sans leading-relaxed font-medium">
                Heavy limit order absorption observed at key support. Taker buy volume is accelerating while funding remains neutral, indicating hidden spot-driven accumulation.
              </p>

            </div>

            {/* Micro Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#D4D8E2] text-xs">
              <div className="p-3 rounded-xl bg-white border border-[#D4D8E2]">
                <span className="text-[10px] text-[#7C8494] uppercase block font-bold">CONFIDENCE</span>
                <span className="font-bold text-[#6D28D9]">HIGH (88%)</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#D4D8E2]">
                <span className="text-[10px] text-[#7C8494] uppercase block font-bold">TRANSITION</span>
                <span className="font-bold text-[#0891B2]">ACCELERATING</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#D4D8E2]">
                <span className="text-[10px] text-[#7C8494] uppercase block font-bold">TIMEFRAME</span>
                <span className="font-bold text-[#5B21B6]">15M / 1H</span>
              </div>
            </div>

          </div>

          {/* What Changed Telemetry Block (Right) */}
          <div className="lg:col-span-6 bg-gradient-to-br from-white to-[#F7F8FB] rounded-2xl p-8 border border-[rgba(8,145,178,0.28)] border-t-4 border-t-[#0891B2] space-y-6 flex flex-col justify-between shadow-[0_4px_18px_rgba(20,24,40,0.06)]">
            
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-4">
                <div className="flex items-center gap-2 text-[#0891B2]">
                  <Activity className="w-4 h-4 text-[#0891B2]" />
                  <span className="text-xs font-bold uppercase tracking-wider">5M DELTA MONITOR: WHAT CHANGED</span>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-[#10B981] border border-emerald-200 text-[10px] font-bold">
                  +14.2M TAKER BUY
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#FAFAFC] border border-[#D4D8E2] space-y-4 text-xs">
                
                <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-3">
                  <span className="text-[#4E5666]">5m Taker Buy Spike:</span>
                  <span className="font-bold text-[#10B981]">+$14,240,000 USDT</span>
                </div>

                <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-3">
                  <span className="text-[#4E5666]">Open Interest Expansion:</span>
                  <span className="font-bold text-[#6D28D9]">+$38.5M (Fresh Positions)</span>
                </div>

                <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-3">
                  <span className="text-[#4E5666]">Short Liquidation Sweep:</span>
                  <span className="font-bold text-rose-600">$4.12M Forced Closures</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#4E5666]">Agent Verdict:</span>
                  <span className="font-bold text-[#5B21B6]">Breakout Expansion Likely</span>
                </div>

              </div>

            </div>

            <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 flex items-center justify-between text-xs">
              <span className="text-[#4E5666]">Continuous 5-minute rolling evaluation</span>
              <span className="text-[#6D28D9] font-bold">NO DELAY</span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
