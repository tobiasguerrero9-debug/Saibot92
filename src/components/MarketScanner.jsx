import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, RefreshCw, Star, Layers, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { getMarketUniverse, FEATURED_SYMBOLS } from '../services/marketUniverseService';
import { classifyAgentState } from '../services/agentStateClassifier';

export default function MarketScanner({ onSelectSymbol, activeSymbol }) {
  const [universe, setUniverse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [sortField, setSortField] = useState('quoteVolume24h');
  const [sortAsc, setSortAsc] = useState(false);

  const loadUniverse = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMarketUniverse();
      setUniverse(data);
    } catch (err) {
      setError('Failed to fetch Binance USD-M Futures market universe.');
      setUniverse([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUniverse();
    const interval = setInterval(loadUniverse, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredUniverse = useMemo(() => {
    return universe
      .filter((item) => {
        if (filterMode === 'featured' && !item.isFeatured) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toUpperCase();
          return item.symbol.includes(q) || item.baseAsset.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortAsc) {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
  }, [universe, filterMode, searchQuery, sortField, sortAsc]);

  return (
    <div 
      className="rounded-3xl p-6 sm:p-8 space-y-6 font-mono shadow-[0_12px_30px_rgba(20,15,35,0.12)] border"
      style={{
        background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
        border: '1px solid rgba(139, 92, 246, 0.30)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 30px rgba(20, 15, 35, 0.12)'
      }}
    >
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-950/50 text-[#C084FC] border border-purple-500/30">
              <Layers className="w-4 h-4 text-[#C084FC]" />
            </span>
            <h3 className="text-xl font-extrabold text-[#F8F8FC] tracking-tight font-mono">
              Binance Futures Market Scanner
            </h3>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-purple-950/40 border border-purple-500/30 text-[#C084FC]">
              {universe.length} Contracts Active
            </span>
          </div>
          <p className="text-xs text-[#AEB5C3] font-medium mt-1">
            Real-time public USDT perpetual contract universe ordered by 24h volume
          </p>
        </div>

        {/* Filter Toggle & Refresh */}
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <div className="flex items-center space-x-1 bg-[#13111A] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-[#7C3AED] text-white border border-[#A78BFA] shadow-xs'
                  : 'text-[#9CA3AF] hover:text-[#F8F8FC]'
              }`}
            >
              All Markets ({universe.length})
            </button>
            <button
              onClick={() => setFilterMode('featured')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'featured'
                  ? 'bg-[#7C3AED] text-white border border-[#A78BFA] shadow-xs'
                  : 'text-[#9CA3AF] hover:text-[#F8F8FC]'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current text-[#C084FC]" />
              <span>Featured ({FEATURED_SYMBOLS.length})</span>
            </button>
          </div>

          <button
            onClick={loadUniverse}
            disabled={loading}
            className="p-2.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 text-[#C084FC] transition-colors border border-purple-500/30"
            title="Refresh Market Universe"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#C084FC] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search any USDT perpetual (e.g. BTCUSDT, SOL, DOGE)..."
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.035)',
            borderColor: 'rgba(255, 255, 255, 0.08)'
          }}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-[#F8F8FC] placeholder-[#8F96A5] text-xs font-mono font-medium focus:outline-none focus:border-[#C084FC] focus:bg-black/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8F96A5] hover:text-[#F8F8FC]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && universe.length === 0 && (
        <div className="py-14 text-center text-[#AEB5C3] space-y-3 font-mono text-xs">
          <RefreshCw className="w-6 h-6 text-[#C084FC] animate-spin mx-auto" />
          <p>Scanning active Binance USD-M perpetual contracts...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-medium text-center space-y-3 font-mono">
          <p>{error}</p>
          <button onClick={loadUniverse} className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs">
            Retry Scan
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredUniverse.length === 0 && !error && (
        <div className="py-14 text-center text-[#8F96A5] font-mono text-xs space-y-1">
          <p className="font-bold text-[#F8F8FC]">No perpetual contracts match "{searchQuery}"</p>
          <p>Try searching another token symbol or clear the filter.</p>
        </div>
      )}

      {/* Quant Table View */}
      {filteredUniverse.length > 0 && (
        <div className="overflow-x-auto border border-white/10 rounded-2xl bg-[#111218]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#15131B] text-[#AEB5C3] uppercase tracking-wider text-[11px] border-b border-white/10">
                <th className="py-3.5 px-4 font-bold">Symbol</th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#F8F8FC] transition-colors" onClick={() => handleSort('price')}>
                  Price <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#F8F8FC] transition-colors" onClick={() => handleSort('priceChange24h')}>
                  24h Change <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#F8F8FC] transition-colors" onClick={() => handleSort('quoteVolume24h')}>
                  24h Quote Vol <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#F8F8FC] transition-colors" onClick={() => handleSort('fundingRate')}>
                  Funding Rate <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-[#F8F8FC]">
              {filteredUniverse.slice(0, 50).map((m, idx) => {
                const isActive = activeSymbol === m.symbol;
                const agentInfo = classifyAgentState(m);
                const isSqueeze = agentInfo.state === 'SQUEEZE MODE' || (m.priceChange24h >= 2.0 && m.fundingRate < 0) || (m.priceChange24h <= -2.5 && m.fundingRate > 0.00015);
                const squeezeLabel = agentInfo.marketBias === 'SHORT SQUEEZE' || (m.priceChange24h >= 2.0 && m.fundingRate < 0)
                  ? 'SHORT SQUEEZE'
                  : (m.priceChange24h <= -2.5 ? 'LONG SQUEEZE' : 'SQUEEZE');

                return (
                  <tr
                    key={m.symbol}
                    onClick={() => onSelectSymbol(m.symbol)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'border-l-[3px] border-l-[#7C3AED] font-bold'
                        : idx % 2 === 1 ? 'bg-white/[0.015] hover:bg-white/[0.04]' : 'hover:bg-white/[0.04]'
                    } ${isSqueeze && !isActive ? 'border-b-2 border-b-[#7C3AED]' : ''}`}
                    style={{
                      ...(isActive ? { backgroundColor: 'rgba(124, 58, 237, 0.10)' } : {}),
                      ...(isSqueeze && !isActive ? { boxShadow: 'inset 0 -2px 0 rgba(124,58,237,0.35)' } : {})
                    }}
                  >
                    <td className="py-3.5 px-4 font-extrabold text-[#F8F8FC] flex items-center gap-2">
                      {m.isFeatured ? (
                        <Star className="w-3.5 h-3.5 text-[#C084FC] fill-current shrink-0" />
                      ) : (
                        <Star className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />
                      )}
                      <span>{m.symbol}</span>
                      {isSqueeze && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-purple-950/60 border border-purple-500/40 text-[#C084FC] shadow-xs shrink-0">
                          {squeezeLabel}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-[#F8F8FC]">
                      ${m.price > 10 ? m.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : m.price.toFixed(4)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                        m.priceChange24h >= 0 ? 'text-[#34D399] bg-emerald-950/40 border border-emerald-500/30' : 'text-[#F87171] bg-rose-950/40 border border-rose-500/30'
                      }`}>
                        {m.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {m.priceChange24h >= 0 ? '+' : ''}{m.priceChange24h.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-[#AEB5C3]">
                      ${(m.quoteVolume24h / 1e6).toFixed(1)}M
                    </td>

                    <td className={`py-3.5 px-4 font-semibold ${m.fundingRate >= 0 ? 'text-[#AEB5C3]' : 'text-[#F87171] font-bold'}`}>
                      {(m.fundingRate * 100).toFixed(4)}%
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold shadow-xs border border-[#A78BFA]">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-purple-950/60 text-[#AEB5C3] hover:text-[#C084FC] text-[10px] font-bold transition-colors border border-white/10">
                          SELECT
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUniverse.length > 50 && (
            <div className="py-3 text-center text-[11px] font-mono text-[#AEB5C3] bg-[#15131B] border-t border-white/10">
              Showing top 50 volume contracts of {filteredUniverse.length} total active.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
