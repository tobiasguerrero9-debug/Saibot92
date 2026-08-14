import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity, BarChart2, Target, ArrowRight } from 'lucide-react';
import WhatChangedBlock from './WhatChangedBlock';

export default function Hero() {
  return (
    <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden bg-[#fafafa]">
      
      {/* Subtle Purple Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-purple-200/30 blur-[150px] rounded-full pointer-events-none -z-10"></div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-16">
        
        {/* 1. Main Reference Title & Subtitle */}
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          
          {/* Top Brand Mascot Icon Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-100/80 border border-purple-200 text-[#7c3aed] text-xs font-mono font-bold uppercase tracking-wider shadow-sm">
            <div className="w-5 h-5 rounded-lg bg-[#7c3aed] p-0.5 flex items-center justify-center text-white">
              <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain filter brightness-200" />
            </div>
            <span>SAIBOT92 FUTURES INTELLIGENCE LAYER</span>
          </div>

          {/* Huge Reference Headline */}
          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black text-slate-950 tracking-tight leading-none uppercase">
            WHAT CHANGED
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl font-bold text-slate-800">
            <span className="text-[#7c3aed]">SAIBOT92</span> compares the current market with recent behavior.
          </p>
        </div>

        {/* 2. Hero Centerpiece: Floating Mascot (Left) + What Changed Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center max-w-5xl mx-auto">
          
          {/* Left: Mascot Asset Floating Cleanly */}
          <div className="lg:col-span-5 flex justify-center">
            <Link to="/app" className="animate-float cursor-pointer relative group">
              <img 
                src="/mascot_transparent.png" 
                alt="SAIBOT92 3D Mascot Asset" 
                className="w-[280px] sm:w-[360px] h-auto object-contain filter drop-shadow-[0_20px_35px_rgba(124,58,237,0.25)] group-hover:scale-105 transition-transform duration-500"
              />
            </Link>
          </div>

          {/* Right: What Changed Reference Card */}
          <div className="lg:col-span-7 flex justify-center">
            <WhatChangedBlock isDemo={true} />
          </div>

        </div>

        {/* 3. Product Context Banner (Matching Reference) */}
        <div className="max-w-4xl mx-auto rounded-2xl bg-white border border-purple-100 shadow-[0_4px_25px_rgba(124,58,237,0.05)] p-6 sm:p-8 border-l-4 border-l-[#7c3aed]">
          <p className="text-base sm:text-lg text-slate-800 font-medium leading-relaxed">
            Instead of only showing a static snapshot, <strong className="text-[#7c3aed] font-extrabold">SAIBOT92</strong> highlights what is actually shifting beneath price — order flow, open interest, volume, price response and liquidation pressure.
          </p>
        </div>

        {/* 4. Educational 3-Step Flow (Matching Reference) */}
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-4 text-center relative">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#7c3aed] font-mono font-bold text-xs flex items-center justify-center mx-auto">
                1
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 text-[#7c3aed] w-fit mx-auto border border-purple-100">
                <Activity className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">
                Reads order flow
              </h4>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-4 text-center relative">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#7c3aed] font-mono font-bold text-xs flex items-center justify-center mx-auto">
                2
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 text-[#7c3aed] w-fit mx-auto border border-purple-100">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">
                Compares recent behavior
              </h4>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-4 text-center relative">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#7c3aed] font-mono font-bold text-xs flex items-center justify-center mx-auto">
                3
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 text-[#7c3aed] w-fit mx-auto border border-purple-100">
                <Target className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-base">
                Returns market context
              </h4>
            </div>

          </div>

          {/* Launch App CTA Button */}
          <div className="text-center pt-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-base transition-all shadow-[0_6px_25px_rgba(124,58,237,0.4)] hover:shadow-[0_8px_35px_rgba(124,58,237,0.6)] hover:scale-105"
            >
              <span>Launch Intelligence App</span>
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
