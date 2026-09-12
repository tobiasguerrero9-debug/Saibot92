import React from 'react';
import { Globe, Eye, Cpu } from 'lucide-react';

export default function SectionChromeCompanion() {
  return (
    <section className="bg-[#F5F1FF] py-24 border-t border-purple-200/60">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        <div 
          className="rounded-3xl p-8 sm:p-14 relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-10 items-center font-mono"
          style={{
            background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
            border: '1px solid rgba(139, 92, 246, 0.32)',
            boxShadow: '0 12px 32px rgba(20, 15, 35, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          
          {/* Left Description */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-purple-950/40 border border-purple-500/30 text-[#C084FC] text-xs font-bold uppercase tracking-widest">
              <Globe className="w-4 h-4 text-[#C084FC]" />
              <span>CHROME COMPANION</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-[#F8F8FC] tracking-tight leading-tight">
              Real-Time Overlay Directly On Your Exchange
            </h2>

            <p className="text-sm sm:text-base text-[#AEB5C3] font-sans leading-relaxed">
              Never miss a market regime shift. The SAIBOT92 Chrome Companion injects real-time order flow telemetry, liquidation cliffs, and agent context scores directly into your Binance and TradingView trading interface.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
              <div 
                className="p-4 rounded-xl border space-y-1"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.035)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="flex items-center gap-2 text-[#C084FC] font-bold">
                  <Eye className="w-4 h-4 text-[#C084FC]" />
                  <span>Exchange Native Overlay</span>
                </div>
                <p className="text-[11px] text-[#AEB5C3] font-sans">Appears as a clean side panel right next to order entry.</p>
              </div>

              <div 
                className="p-4 rounded-xl border space-y-1"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.035)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="flex items-center gap-2 text-[#22D3EE] font-bold">
                  <Cpu className="w-4 h-4 text-[#22D3EE]" />
                  <span>Sub-Second Telemetry</span>
                </div>
                <p className="text-[11px] text-[#AEB5C3] font-sans">Direct WebSocket connection with zero intermediate latency.</p>
              </div>
            </div>

          </div>

          {/* Right Side Panel Preview Graphic */}
          <div className="lg:col-span-5 flex justify-center">
            <div 
              className="w-full max-w-[340px] rounded-2xl p-5 space-y-4 font-mono shadow-[0_8px_24px_rgba(0,0,0,0.35)] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.035)',
                borderColor: 'rgba(255, 255, 255, 0.10)'
              }}
            >
              
              <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                <span className="font-bold text-[#F8F8FC] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse"></span>
                  SAIBOT92 SIDE PANEL
                </span>
                <span className="text-[#C084FC] text-[10px] font-bold">v2.4 ACTIVE</span>
              </div>

              <div 
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">ACTIVE PAIR</span>
                  <span className="font-bold text-[#F8F8FC]">BTCUSDT-PERP</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">CONTEXT SCORE</span>
                  <span className="font-bold text-[#C084FC]">84 / 100</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CA3AF]">AGENT STATE</span>
                  <span className="font-bold text-[#A78BFA]">ABSORPTION_BULLISH</span>
                </div>
              </div>

              <div 
                className="p-3.5 rounded-xl border space-y-1.5 text-[11px]"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <span className="text-[#9CA3AF] block font-bold">5M DELTA SHIFT</span>
                <div className="text-[#34D399] font-bold">+$14.2M TAKER BUY ACCELERATION</div>
                <p className="text-[10px] text-[#AEB5C3] font-sans">Institutional limit bids absorbing sell market orders.</p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
