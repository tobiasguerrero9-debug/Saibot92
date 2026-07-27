import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="w-full bg-white py-6 border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        
        {/* SAIBOT92 Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 p-0.5 flex items-center justify-center">
            <img 
              src="/mascot_transparent.png" 
              alt="SAIBOT92 Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-slate-950">
            SAIBOT<span className="text-[#7c3aed]">92</span>
          </span>
        </Link>

        {/* Minimal Navigation */}
        <nav className="hidden md:flex items-center space-x-10 text-sm font-semibold text-slate-700">
          <a href="#reads" className="hover:text-[#7c3aed] transition-colors">What it Reads</a>
          <a href="#context" className="hover:text-[#7c3aed] transition-colors">Methodology</a>
          <Link to="/app" className="hover:text-[#7c3aed] transition-colors flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mini App
          </Link>
        </nav>

        {/* Action Button */}
        <div>
          <Link
            to="/app"
            className="px-6 py-3 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg inline-flex items-center gap-1.5"
          >
            <span>Launch Mini App</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </header>
  );
}
