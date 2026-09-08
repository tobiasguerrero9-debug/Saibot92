import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Terminal } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-24 overflow-hidden bg-[#FAFAFC] text-[#10131A]">
      
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-8 text-left z-10">
            
            {/* System Microcopy Eyebrow */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-purple-50/90 border border-[#7C3AED]/30 text-[#6D28D9] text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <span>SAIBOT92 / AGENT CORE ● DATA LAYER: ACTIVE</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-[#10131A] tracking-tight leading-[0.98]">
              Decode <br />
              Market Data <br />
              <span className="text-[#6D28D9]">
                Before the Move
              </span>
            </h1>

            {/* Supporting text */}
            <p className="text-base sm:text-lg text-[#4E5666] font-normal max-w-xl leading-relaxed">
              SAIBOT92 is an agentic intelligence layer for crypto futures. We analyze order flow, open interest, liquidations, and market signals—before the market moves.
            </p>

            {/* Terminal Microcopy Bar — Dark Mini-Terminal */}
            <div 
              className="p-4 rounded-2xl font-mono text-xs space-y-2.5 max-w-xl"
              style={{
                background: 'linear-gradient(135deg, #111218 0%, #17141F 55%, #1C1528 100%)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 30px rgba(20, 15, 35, 0.12)'
              }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-[#C084FC]">
                  <Terminal className="w-4 h-4 text-[#C084FC]" />
                  <span className="tracking-wide">INTELLIGENCE PIPELINE</span>
                </span>
                <span className="text-[#34D399] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-ping"></span>
                  REAL-TIME FUTURES STREAM
                </span>
              </div>
              <div 
                className="text-[11px] font-mono leading-relaxed p-2.5 rounded-xl border flex items-center justify-between gap-2 overflow-x-auto"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.035)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <span className="text-[#C084FC] font-bold tracking-wider whitespace-nowrap">ORDER FLOW</span>
                <span className="text-[#6B7280]">→</span>
                <span className="text-[#22D3EE] font-bold tracking-wider whitespace-nowrap">OPEN INTEREST</span>
                <span className="text-[#6B7280]">→</span>
                <span className="text-[#FBBF24] font-bold tracking-wider whitespace-nowrap">LIQUIDATIONS</span>
                <span className="text-[#6B7280]">→</span>
                <span className="text-[#34D399] font-bold tracking-wider whitespace-nowrap">AGENT SCENARIO</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-4 font-mono">
              <Link
                to="/app"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold text-sm uppercase tracking-wider transition-all duration-200 shadow-[0_6px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_25px_rgba(124,58,237,0.4)] flex items-center gap-2 hover:scale-[1.01]"
              >
                <span>Launch App</span>
                <ArrowUpRight className="w-5 h-5 text-[#F2C94C]" />
              </Link>

              <a
                href="#reads"
                className="px-8 py-4 rounded-xl bg-white hover:bg-[#F7F8FB] text-[#10131A] font-bold text-sm uppercase tracking-wider transition-all border border-[#D4D8E2] shadow-[0_2px_10px_rgba(20,24,40,0.04)]"
              >
                Explore Telemetry
              </a>
            </div>

          </div>

          {/* Right Hero: Standalone 3D Mascot Floating Cleanly */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <Link to="/app" className="animate-float cursor-pointer relative group block">
              <img 
                src="/mascot_transparent.png" 
                alt="SAIBOT92 Official 3D Mascot Asset" 
                className="w-[360px] sm:w-[440px] lg:w-[480px] h-auto object-contain group-hover:scale-105 transition-transform duration-500"
              />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
