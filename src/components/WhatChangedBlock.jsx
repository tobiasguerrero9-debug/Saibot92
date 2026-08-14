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
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-purple-200/80 shadow-[0_10px_40px_rgba(124,58,237,0.08)] space-y-4 max-w-md w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-purple-100 font-mono">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] border border-purple-200/60 shadow-sm">
            <TrendingUp className="w-4 h-4" />
          </span>
          <h3 className="text-base font-extrabold text-slate-950 tracking-tight flex items-center gap-1.5">
            WHAT CHANGED <span className="text-[#7c3aed] font-mono">// {windowLabel}</span>
          </h3>
        </div>

        {isDemo ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-[#7c3aed] border border-purple-200 uppercase tracking-wider">
            LIVE PREVIEW
          </span>
        ) : !hasData ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>RECORDING</span>
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-[#7c3aed] border border-purple-200 uppercase tracking-wider">
            MEMORY ACTIVE
          </span>
        )}
      </div>

      {/* Rows */}
      {!hasData && !isDemo ? (
        <div className="py-8 text-center space-y-2 font-mono">
          <RefreshCw className="w-5 h-5 text-[#7c3aed] animate-spin mx-auto" />
          <div className="text-xs font-bold text-slate-800">{whatChanged?.statusMessage || 'COLLECTING MARKET HISTORY...'}</div>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            {whatChanged?.detail || 'Not enough recent observations to calculate short-term change.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 font-mono text-sm">
          
          {/* Row 1: Buy aggression */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/40 border border-purple-100/70 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] shrink-0 border border-purple-100">
                <TrendingUp className="w-4 h-4" />
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Buy aggression</span>
            </div>
            <span className="font-extrabold text-[#7c3aed] text-sm sm:text-base">
              {buyAggression}
            </span>
          </div>

          {/* Row 2: Open interest */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/40 border border-purple-100/70 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] shrink-0 border border-purple-100">
                <BarChart2 className="w-4 h-4" />
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Open interest</span>
            </div>
            <span className="font-extrabold text-[#7c3aed] text-sm sm:text-base">
              {openInterest}
            </span>
          </div>

          {/* Row 3: Volume */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/40 border border-purple-100/70 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] shrink-0 border border-purple-100">
                <Layers className="w-4 h-4" />
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Volume</span>
            </div>
            <span className="font-extrabold text-[#7c3aed] text-sm sm:text-base">
              {volume}
            </span>
          </div>

          {/* Row 4: Price response */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/40 border border-purple-100/70 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] shrink-0 border border-purple-100">
                <Activity className="w-4 h-4" />
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Price response</span>
            </div>
            <span className="font-extrabold text-[#7c3aed] text-sm sm:text-base">
              {priceResponse}
            </span>
          </div>

          {/* Row 5: Liquidation pressure */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/40 border border-purple-100/70 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-50 text-[#7c3aed] shrink-0 border border-purple-100">
                <Zap className="w-4 h-4" />
              </span>
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Liquidation pressure</span>
            </div>
            <span className="font-extrabold text-[#7c3aed] text-sm sm:text-base">
              {liquidationPressure}
            </span>
          </div>

        </div>
      )}

    </div>
  );
}
