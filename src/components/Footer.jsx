import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-12 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-6">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-100 p-0.5 flex items-center justify-center">
              <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-xl text-slate-950 tracking-tight">
              SAIBOT<span className="text-[#7c3aed]">92</span>
            </span>
          </div>

          <div className="flex items-center space-x-8 font-semibold text-slate-700">
            <a href="#reads" className="hover:text-[#7c3aed] transition-colors">What it Reads</a>
            <a href="#context" className="hover:text-[#7c3aed] transition-colors">Methodology</a>
            <a href="#preview" className="hover:text-[#7c3aed] transition-colors">Mini App</a>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-xs font-medium">
          <p>© {new Date().getFullYear()} SAIBOT92 Intelligence Labs. Market context & data analytics layer.</p>
          <p className="font-mono text-[#7c3aed]">$SAI // SAIBOT92 PROTOCOL</p>
        </div>

      </div>
    </footer>
  );
}
