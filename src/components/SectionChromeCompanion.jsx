import React from 'react';
import { Globe, Eye, Cpu } from 'lucide-react';

export default function SectionChromeCompanion() {
  return (
    <section className="bg-[#F5F1FF] py-24 border-t border-purple-200/60">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        <div className="rounded-3xl bg-gradient-to-br from-white via-[#FAF8FF] to-[#F4F0FF] border border-[rgba(124,58,237,0.28)] p-8 sm:p-14 shadow-[0_6px_24px_rgba(124,58,237,0.08)] relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Description */}
          <div className="lg:col-span-7 space-y-6 font-mono">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-[#6D28D9] text-xs font-bold uppercase tracking-widest">
              <Globe className="w-4 h-4 text-[#6D28D9]" />
              <span>CHROME COMPANION</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-[#10131A] tracking-tight leading-tight">
              Real-Time Overlay Directly On Your Exchange
            </h2>

            <p className="text-sm sm:text-base text-[#4E5666] font-sans leading-relaxed">
              Never miss a market regime shift. The SAIBOT92 Chrome Companion injects real-time order flow telemetry, liquidation cliffs, and agent context scores directly into your Binance and TradingView trading interface.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-[#10131A]">
              <div className="p-4 rounded-xl bg-white border border-[#D4D8E2] shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-[#6D28D9] font-bold">
                  <Eye className="w-4 h-4" />
                  <span>Exchange Native Overlay</span>
                </div>
                <p className="text-[11px] text-[#4E5666] font-sans">Appears as a clean side panel right next to order entry.</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D4D8E2] shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-[#0891B2] font-bold">
                  <Cpu className="w-4 h-4" />
                  <span>Sub-Second Telemetry</span>
                </div>
                <p className="text-[11px] text-[#4E5666] font-sans">Direct WebSocket connection with zero intermediate latency.</p>
              </div>
            </div>

          </div>

          {/* Right Side Panel Preview Graphic */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[340px] rounded-2xl bg-[#FAFAFC] border border-[#D4D8E2] p-5 space-y-4 font-mono shadow-[0_4px_18px_rgba(20,24,40,0.06)]">
              
              <div className="flex items-center justify-between border-b border-[#D4D8E2] pb-3 text-xs">
                <span className="font-bold text-[#10131A] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                  SAIBOT92 SIDE PANEL
                </span>
                <span className="text-[#6D28D9] text-[10px] font-bold">v2.4 ACTIVE</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#D4D8E2] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#4E5666]">ACTIVE PAIR</span>
                  <span className="font-bold text-[#10131A]">BTCUSDT-PERP</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#4E5666]">CONTEXT SCORE</span>
                  <span className="font-bold text-[#6D28D9]">84 / 100</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#4E5666]">AGENT STATE</span>
                  <span className="font-bold text-[#5B21B6]">ABSORPTION_BULLISH</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#D4D8E2] space-y-1.5 text-[11px]">
                <span className="text-[#4E5666] block font-bold">5M DELTA SHIFT</span>
                <div className="text-[#10B981] font-bold">+$14.2M TAKER BUY ACCELERATION</div>
                <p className="text-[10px] text-[#7C8494] font-sans">Institutional limit bids absorbing sell market orders.</p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
