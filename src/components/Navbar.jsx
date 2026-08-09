import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-5 flex items-center justify-between">
        
        {/* SAIBOT92 Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 p-0.5 flex items-center justify-center group-hover:border-purple-400 transition-colors shadow-sm">
            <img 
              src="/mascot_transparent.png" 
              alt="SAIBOT92 Logo" 
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-950">
            SAIBOT<span className="text-[#7c3aed]">92</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-10 text-sm font-semibold text-slate-700">
          <a href="#reads" className="hover:text-[#7c3aed] transition-colors">What it Reads</a>
          <a href="#context" className="hover:text-[#7c3aed] transition-colors">Methodology</a>
          <Link to="/app" className="hover:text-[#7c3aed] transition-colors flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mini App (Live)
          </Link>
        </nav>

        {/* Action Button */}
        <div>
          <Link
            to="/app"
            className="px-6 py-2.5 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-sm transition-all shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] flex items-center gap-1.5"
          >
            <span>Launch App</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </header>
  );
}
