import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="w-full bg-white/90 backdrop-blur-md border-b border-[#E4E6EC] sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-3.5 flex items-center justify-between">
        
        {/* SAIBOT92 Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/80 p-1 flex items-center justify-center group-hover:border-purple-400 transition-colors shadow-xs">
            <img 
              src="/mascot_transparent.png" 
              alt="SAIBOT92 Logo" 
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#12141A] font-mono">
            SAIBOT<span className="text-[#7C3AED]">92</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-xs font-mono font-semibold uppercase tracking-wider text-[#5E6675]">
          <a href="#reads" className="hover:text-[#7C3AED] transition-colors">What it Reads</a>
          <a href="#context" className="hover:text-[#7C3AED] transition-colors">Methodology</a>
          <Link to="/app" className="hover:text-[#7C3AED] transition-colors flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>Mini App (Live)</span>
          </Link>
        </nav>

        {/* Action Button */}
        <div>
          <Link
            to="/app"
            className="px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
          >
            <span>Launch App</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </header>
  );
}
