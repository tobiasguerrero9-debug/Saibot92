import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#D4D8E2] py-12 text-[#4E5666] text-xs font-mono">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-8">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 p-1 flex items-center justify-center group-hover:border-purple-400 transition-colors">
              <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-xl text-[#10131A] tracking-tight font-mono">
              SAIBOT<span className="text-[#6D28D9]">92</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold uppercase tracking-wider text-xs">
            <a href="#reads" className="hover:text-[#6D28D9] transition-colors">What it Reads</a>
            <a href="#context" className="hover:text-[#6D28D9] transition-colors">Methodology</a>
            <Link to="/app" className="hover:text-[#6D28D9] transition-colors">Mini App</Link>
            <Link to="/privacy" className="hover:text-[#6D28D9] transition-colors">Privacy Policy</Link>
          </div>
        </div>

        <div className="pt-6 border-t border-[#D4D8E2] flex flex-col sm:flex-row items-center justify-between gap-4 text-[#7C8494] text-xs font-medium">
          <p>© {new Date().getFullYear()} SAIBOT92 Intelligence Labs. Agentic market context & futures telemetry layer.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              ALL SYSTEMS OPERATIONAL
            </span>
            <span className="text-[#6D28D9] font-bold">$SAI // SAIBOT92 PROTOCOL</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
