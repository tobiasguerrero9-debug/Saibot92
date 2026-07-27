import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function FinalCTA({ onLaunchApp }) {
  return (
    <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-[32px] sm:rounded-[40px] bg-gradient-to-b from-[#120729] to-[#070312] border border-purple-500/30 p-10 sm:p-16 text-center space-y-6 shadow-[0_20px_80px_rgba(124,58,237,0.25)]">
        
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
          SAIBOT92 FUTURES INTELLIGENCE
        </span>

        <h2 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto">
          See what the market is really saying.
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-normal">
          Launch SAIBOT92 and explore a cleaner way to read crypto futures data.
        </p>

        <div className="pt-4 flex justify-center">
          <button
            onClick={onLaunchApp}
            className="px-8 py-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-base transition-all shadow-[0_0_35px_rgba(124,58,237,0.6)] flex items-center gap-2 border border-purple-400/40"
          >
            <span>Launch App</span>
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </section>
  );
}
