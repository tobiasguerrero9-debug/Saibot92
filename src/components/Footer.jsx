import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200/80 py-12 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-6">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 p-0.5 flex items-center justify-center">
              <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-xl text-slate-950 tracking-tight">
              SAIBOT<span className="text-[#7c3aed]">92</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold text-slate-700">
            <a href="#reads" className="hover:text-[#7c3aed] transition-colors">What it Reads</a>
            <a href="#context" className="hover:text-[#7c3aed] transition-colors">Methodology</a>
            <Link to="/app" className="hover:text-[#7c3aed] transition-colors">Mini App</Link>
            <Link to="/privacy" className="hover:text-[#7c3aed] transition-colors">Privacy Policy</Link>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-xs font-medium">
          <p>© {new Date().getFullYear()} SAIBOT92 Intelligence Labs. Agentic market context & futures telemetry layer.</p>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ALL SYSTEMS OPERATIONAL
            </span>
            <span className="text-[#7c3aed] font-bold">$SAI // SAIBOT92 PROTOCOL</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
