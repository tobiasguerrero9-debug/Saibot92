import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Hero() {
  return (
    <section className="bg-white py-16 sm:py-24 lg:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-6 space-y-8 text-left z-10">
            
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-[#7c3aed] text-xs font-mono font-bold uppercase tracking-widest">
              <span>AGENTIC INTELLIGENCE FOR CRYPTO FUTURES</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-slate-950 tracking-tight leading-[0.98]">
              Decode <br />
              Market Data <br />
              <span className="text-[#7c3aed]">Before the Move</span>
            </h1>

            {/* Supporting text */}
            <p className="text-lg sm:text-2xl text-slate-600 font-medium max-w-xl leading-relaxed">
              SAIBOT92 transforms crypto futures data into clear market context through order flow, open interest, liquidations and agentic analysis.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/app"
                className="px-8 py-4 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base transition-all shadow-lg hover:shadow-purple-200 inline-flex items-center gap-2"
              >
                <span>Launch Mini App</span>
                <ArrowUpRight className="w-5 h-5" />
              </Link>

              <a
                href="#reads"
                className="px-8 py-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base transition-all"
              >
                Explore Intelligence
              </a>
            </div>

          </div>

          {/* Right Hero: Exact Official Mascot Image Asset */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <Link to="/app" className="animate-float cursor-pointer">
              <img 
                src="/mascot_official.png" 
                alt="SAIBOT92 Official 3D Mascot Asset" 
                className="w-[450px] sm:w-[580px] lg:w-[680px] h-auto object-contain mix-blend-multiply"
              />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
