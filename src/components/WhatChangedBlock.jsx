import React from 'react';
import { TrendingUp, BarChart2, Layers, Activity, Zap, RefreshCw } from 'lucide-react';

/**
 * Reusable WHAT CHANGED // 5M Block component.
 * Renders the reference visual structure with either live memory data or demo fallback values.
 */
export default function WhatChangedBlock({ whatChanged, isDemo = false }) {
  // Use live data if available, or clean reference demo values
  const hasData = whatChanged && whatChanged.hasHistory;

  const buyAggression = hasData ? whatChanged.buyAggressionDeltaPct : '+18%';
  const openInterest = hasData ? whatChanged.oiDeltaPct : '+4.2%';
  const volume = hasData ? whatChanged.volumeDeltaPct : '+12%';
  const priceResponse = hasData ? whatChanged.priceResponse : 'weakening';
  const liquidationPressure = hasData ? whatChanged.liquidationPressure : 'rising';
  const windowLabel = hasData ? whatChanged.windowLabel : '5M';

  return (
    <div 
      className="rounded-2xl p-6 sm:p-7 space-y-4 max-w-md w-full font-mono shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      style={{
        background: 'linear-gradient(135deg, #101116 0%, #17131F 100%)',
        border: '1px solid rgba(34, 211, 238, 0.32)'
      }}
    >
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-xl bg-cyan-950/50 text-[#22D3EE] border border-cyan-500/30">
            <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
          </span>
          <h3 className="text-base font-extrabold text-[#F8F8FC] tracking-tight flex items-center gap-1.5">
            WHAT CHANGED <span className="text-[#22D3EE] font-mono">// {windowLabel}</span>
          </h3>
        </div>

        {isDemo ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-purple-950/40 text-[#C084FC] border border-purple-500/30 uppercase tracking-wider">
            LIVE PREVIEW
          </span>
        ) : !hasData ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-amber-950/40 text-[#FBBF24] border border-amber-500/30 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin text-[#FBBF24]" />
            <span>RECORDING</span>
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-cyan-950/40 text-[#22D3EE] border border-cyan-500/30 uppercase tracking-wider">
            MEMORY ACTIVE
          </span>
        )}
      </div>

      {/* Rows */}
      {!hasData && !isDemo ? (
        <div className="py-8 text-center space-y-2 font-mono">
          <RefreshCw className="w-5 h-5 text-[#22D3EE] animate-spin mx-auto" />
          <div className="text-xs font-bold text-[#F8F8FC]">{whatChanged?.statusMessage || 'COLLECTING MARKET HISTORY...'}</div>
          <p className="text-[11px] text-[#AEB5C3] max-w-xs mx-auto font-sans">
            {whatChanged?.detail || 'Not enough recent observations to calculate short-term change.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 font-mono text-sm">
          
          {/* Row 1: Buy aggression */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-lg bg-white/5 text-[#22D3EE] shrink-0 border border-white/10">
                <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
              </span>
              <span className="font-semibold text-[#F8F8FC] text-xs sm:text-sm">Buy aggression</span>
            </div>
            <span className="font-extrabold text-[#22D3EE] text-sm sm:text-base">
              {buyAggression}
            </span>
          </div>

          {/* Row 2: Open interest */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-lg bg-white/5 text-[#C084FC] shrink-0 border border-white/10">
                <BarChart2 className="w-4 h-4 text-[#C084FC]" />
              </span>
              <span className="font-semibold text-[#F8F8FC] text-xs sm:text-sm">Open interest</span>
            </div>
            <span className="font-extrabold text-[#C084FC] text-sm sm:text-base">
              {openInterest}
            </span>
          </div>

          {/* Row 3: Volume */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-lg bg-white/5 text-[#22D3EE] shrink-0 border border-white/10">
                <Layers className="w-4 h-4 text-[#22D3EE]" />
              </span>
              <span className="font-semibold text-[#F8F8FC] text-xs sm:text-sm">Volume</span>
            </div>
            <span className="font-extrabold text-[#22D3EE] text-sm sm:text-base">
              {volume}
            </span>
          </div>

          {/* Row 4: Price response */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-lg bg-white/5 text-[#22D3EE] shrink-0 border border-white/10">
                <Activity className="w-4 h-4 text-[#22D3EE]" />
              </span>
              <span className="font-semibold text-[#F8F8FC] text-xs sm:text-sm">Price response</span>
            </div>
            <span className="font-extrabold text-[#22D3EE] text-sm sm:text-base">
              {priceResponse}
            </span>
          </div>

          {/* Row 5: Liquidation pressure */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-lg bg-white/5 text-[#FBBF24] shrink-0 border border-white/10">
                <Zap className="w-4 h-4 text-[#FBBF24]" />
              </span>
              <span className="font-semibold text-[#F8F8FC] text-xs sm:text-sm">Liquidation pressure</span>
            </div>
            <span className="font-extrabold text-[#FBBF24] text-sm sm:text-base">
              {liquidationPressure}
            </span>
          </div>

        </div>
      )}

    </div>
  );
}
