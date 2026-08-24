import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ShieldCheck, ArrowLeft, Globe, Lock } from 'lucide-react';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-purple-600 selection:text-white flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12 sm:py-16 space-y-8">
          
          {/* Back Link & Header */}
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#7c3aed] text-xs font-mono font-bold transition-all border border-purple-200/60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>

            <div className="flex items-center gap-2 text-[#7c3aed] font-mono text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>LEGAL / PRIVACY DOCUMENTATION</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
              Privacy Policy
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
              This Privacy Policy explains how SAIBOT92 Chrome Companion handles information when users interact with the extension.
            </p>

            <div className="pt-1">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/80 font-mono text-xs font-bold text-slate-500 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-[#7c3aed]" />
                <span>Effective date: August 24, 2026</span>
              </span>
            </div>
          </div>

          {/* Policy Document Body */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
            
            {/* Overview */}
            <div className="space-y-3 pb-6 border-b border-slate-100">
              <p>
                SAIBOT92 Chrome Companion is a browser extension designed to provide real-time crypto futures market context using publicly available market data.
              </p>
            </div>

            {/* Information We Collect */}
            <div className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Information We Collect
              </h2>
              <p>
                SAIBOT92 Chrome Companion does not collect personal information from users.
              </p>
              <p className="font-semibold text-slate-900">
                The extension does not request or collect:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 font-mono text-xs sm:text-sm text-slate-700">
                <li>names</li>
                <li>email addresses</li>
                <li>passwords</li>
                <li>exchange API keys</li>
                <li>wallet private keys</li>
                <li>payment information</li>
                <li>personal Binance account data</li>
                <li>trading account credentials</li>
                <li>browsing history for advertising purposes</li>
              </ul>
            </div>

            {/* Local Extension Data */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Local Extension Data
              </h2>
              <p>
                The extension may store limited preferences locally using Chrome storage, including:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 font-mono text-xs sm:text-sm text-slate-700">
                <li>selected markets</li>
                <li>recent markets</li>
                <li>favorite markets</li>
                <li>interface preferences</li>
              </ul>
              <p>
                This information is stored locally in the user's browser and is used only to improve the extension experience.
              </p>
            </div>

            {/* Market Data */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Market Data
              </h2>
              <p>
                SAIBOT92 retrieves publicly available crypto futures market data from external market data providers, including Binance public APIs and WebSocket services.
              </p>
              <p className="font-semibold text-slate-900">
                This may include:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 font-mono text-xs sm:text-sm text-slate-700">
                <li>market prices</li>
                <li>aggregate trades</li>
                <li>open interest</li>
                <li>funding rates</li>
                <li>volume</li>
                <li>liquidation activity</li>
                <li>market metadata</li>
              </ul>
              <p>
                These requests are used exclusively to provide market intelligence features inside the extension.
              </p>
            </div>

            {/* Remote Code */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Remote Code
              </h2>
              <p>
                SAIBOT92 Chrome Companion does not execute remotely hosted code.
              </p>
              <p>
                All executable JavaScript required by the extension is included within the extension package. External network connections are used only to retrieve market data.
              </p>
            </div>

            {/* Data Sharing */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Data Sharing
              </h2>
              <p>
                SAIBOT92 does not sell, rent, or share personal user information with advertisers or third parties.
              </p>
            </div>

            {/* Analytics and Tracking */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Analytics and Tracking
              </h2>
              <p>
                The extension does not currently use advertising trackers or third-party behavioral tracking systems.
              </p>
              <p>
                If analytics are introduced in the future, this Privacy Policy will be updated before those systems are deployed.
              </p>
            </div>

            {/* Trading and Financial Information */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Trading and Financial Information
              </h2>
              <p>
                SAIBOT92 does not execute trades, access private exchange accounts, or connect to user wallets.
              </p>
              <p>
                The extension provides informational market context only.
              </p>
            </div>

            {/* Security */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Security
              </h2>
              <p>
                SAIBOT92 follows a minimal-permission approach and requests only browser permissions required for its functionality.
              </p>
            </div>

            {/* Changes to This Policy */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Changes to This Policy
              </h2>
              <p>
                This Privacy Policy may be updated as SAIBOT92 evolves.
              </p>
              <p>
                Any material changes will be reflected on this page with an updated effective date.
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                Contact
              </h2>
              <p>
                For questions regarding this Privacy Policy or the SAIBOT92 Chrome Companion, users may contact the project through the official SAIBOT92 website or support channels.
              </p>
              <div className="pt-2">
                <a
                  href="https://saibot92.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-mono text-xs font-bold transition-all border border-purple-200/80"
                >
                  <Globe className="w-4 h-4" />
                  <span>https://saibot92.vercel.app/</span>
                </a>
              </div>
            </div>

          </div>

        </main>
      </div>

      <Footer />
    </div>
  );
}
