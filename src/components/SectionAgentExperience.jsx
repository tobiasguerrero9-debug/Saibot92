import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Activity, ArrowUpRight } from 'lucide-react';

export default function SectionAgentExperience() {
  return (
    <section className="bg-[#FAFAFC] py-24 border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        
        {/* Editorial Section Header (LIGHT) */}
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

        {/* Quant Preview Grid (TWO DARK MINI-TERMINAL PANELS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch font-mono">
          
          {/* Agent State Card (Left Panel — Purple Identity) */}
          <div 
            className="lg:col-span-6 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
              border: '1px solid rgba(139, 92, 246, 0.34)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 28px rgba(20, 15, 35, 0.12)'
            }}
          >
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-[#C084FC]">
                  <Terminal className="w-4 h-4 text-[#C084FC]" />
                  <span className="text-xs font-bold uppercase tracking-wider">LIVE AGENT CLASSIFIER</span>
                </div>
                <span className="text-[11px] text-[#9CA3AF]">EVALUATING REAL-TIME</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#34D399] animate-pulse"></span>
                  <h3 className="text-3xl sm:text-4xl font-black text-[#F8F8FC] tracking-tight">
                    ABSORPTION_BULLISH
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-[#C084FC]">
                    Context Score: 84/100
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs font-bold text-[#34D399]">
                    Market Bias: BULLISH
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#AEB5C3] font-sans leading-relaxed font-medium">
                Heavy limit order absorption observed at key support. Taker buy volume is accelerating while funding remains neutral, indicating hidden spot-driven accumulation.
              </p>

            </div>

            {/* Micro Metrics Readouts */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.035)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <span className="text-[10px] text-[#9CA3AF] uppercase block font-bold mb-0.5">CONFIDENCE</span>
                <span className="font-bold text-[#C084FC]">HIGH (88%)</span>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.035)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <span className="text-[10px] text-[#9CA3AF] uppercase block font-bold mb-0.5">TRANSITION</span>
                <span className="font-bold text-[#22D3EE]">ACCELERATING</span>
              </div>
              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.035)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <span className="text-[10px] text-[#9CA3AF] uppercase block font-bold mb-0.5">TIMEFRAME</span>
                <span className="font-bold text-[#F8F8FC]">15M / 1H</span>
              </div>
            </div>

          </div>

          {/* What Changed Telemetry Block (Right Panel — Cyan Identity) */}
          <div 
            className="lg:col-span-6 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
              border: '1px solid rgba(34, 211, 238, 0.35)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 28px rgba(20, 15, 35, 0.12)'
            }}
          >
            
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-[#22D3EE]">
                  <Activity className="w-4 h-4 text-[#22D3EE]" />
                  <span className="text-xs font-bold uppercase tracking-wider">5M DELTA MONITOR: WHAT CHANGED</span>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-[#34D399] text-[10px] font-bold">
                  +14.2M TAKER BUY
                </span>
              </div>

              <div 
                className="p-5 rounded-2xl border space-y-3.5 text-xs"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.035)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <span className="text-[#AEB5C3]">5m Taker Buy Spike:</span>
                  <span className="font-bold text-[#34D399]">+$14,240,000 USDT</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <span className="text-[#AEB5C3]">Open Interest Expansion:</span>
                  <span className="font-bold text-[#C084FC]">+$38.5M (Fresh Positions)</span>
                </div>

                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <span className="text-[#AEB5C3]">Short Liquidation Sweep:</span>
                  <span className="font-bold text-[#F87171]">$4.12M Forced Closures</span>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[#AEB5C3]">Agent Verdict:</span>
                  <span className="font-bold text-[#22D3EE]">Breakout Expansion Likely</span>
                </div>

              </div>

            </div>

            <div 
              className="p-4 rounded-xl border flex items-center justify-between text-xs"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.035)',
                borderColor: 'rgba(255, 255, 255, 0.08)'
              }}
            >
              <span className="text-[#AEB5C3]">Continuous 5-minute rolling evaluation</span>
              <span className="text-[#22D3EE] font-bold">NO DELAY</span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
