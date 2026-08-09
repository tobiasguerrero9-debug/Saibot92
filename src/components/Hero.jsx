import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Terminal } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden bg-[#fcfcfd]">
      
      {/* Subtle Soft Lavender Aura Behind Mascot */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-200/40 blur-[140px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute top-10 left-10 w-[350px] h-[350px] bg-indigo-100/40 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-8 text-left z-10">
            
            {/* System Microcopy Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-[#7c3aed] text-xs font-mono font-semibold uppercase tracking-wider shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>SAIBOT92 / AGENT CORE ● DATA LAYER: ACTIVE</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-slate-950 tracking-tight leading-[0.98]">
              Decode <br />
              Market Data <br />
              <span className="text-[#7c3aed]">
                Before the Move
              </span>
            </h1>

            {/* Supporting text */}
            <p className="text-lg sm:text-xl text-slate-600 font-normal max-w-xl leading-relaxed">
              SAIBOT92 is an agentic intelligence layer for crypto futures. We analyze order flow, open interest, liquidations, and market signals—before the market moves.
            </p>

            {/* Terminal Microcopy Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 font-mono text-xs text-slate-600 space-y-1 max-w-lg shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between text-[#7c3aed]">
                <span className="flex items-center gap-1.5 font-bold">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>INTELLIGENCE PIPELINE</span>
                </span>
                <span className="text-emerald-600 font-bold">REAL-TIME</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                QUANTIFIABLE DATA → MARKET BEHAVIOR → AGENT INTERPRETATION → MARKET STATE
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/app"
                className="px-8 py-4 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base transition-all duration-300 shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_25px_rgba(124,58,237,0.5)] flex items-center gap-2 hover:scale-[1.02]"
              >
                <span>Launch App</span>
                <ArrowUpRight className="w-5 h-5" />
              </Link>

              <a
                href="#reads"
                className="px-8 py-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-base transition-all border border-slate-200/80"
              >
                Explore Intelligence
              </a>
            </div>

          </div>

          {/* Right Hero: Exact Official 3D Purple Mascot Floating Cleanly */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <Link to="/app" className="animate-float cursor-pointer relative group">
              <img 
                src="/mascot_transparent.png" 
                alt="SAIBOT92 Official 3D Mascot Asset" 
                className="relative w-[360px] sm:w-[460px] lg:w-[500px] h-auto object-contain group-hover:scale-105 transition-transform duration-500"
              />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
