import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, RefreshCw, Star, Layers, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { getMarketUniverse, FEATURED_SYMBOLS } from '../services/marketUniverseService';

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
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-[#7c3aed]">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">
              Binance Futures Market Scanner
            </h3>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-[#7c3aed] border border-purple-200">
              {universe.length} Contracts Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time public USDT perpetual contract universe ordered by 24h volume
          </p>
        </div>

        {/* Filter Toggle & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Markets ({universe.length})
            </button>
            <button
              onClick={() => setFilterMode('featured')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                filterMode === 'featured'
                  ? 'bg-[#7c3aed] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Featured ({FEATURED_SYMBOLS.length})</span>
            </button>
          </div>

          <button
            onClick={loadUniverse}
            disabled={loading}
            className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7c3aed] transition-colors border border-purple-200"
            title="Refresh Market Universe"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search any USDT perpetual (e.g. BTCUSDT, SOL, DOGE)..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && universe.length === 0 && (
        <div className="py-14 text-center text-slate-500 space-y-3 font-mono text-xs">
          <RefreshCw className="w-6 h-6 text-[#7c3aed] animate-spin mx-auto" />
          <p>Scanning active Binance USD-M perpetual contracts...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center space-y-3">
          <p>{error}</p>
          <button onClick={loadUniverse} className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md">
            Retry Scan
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredUniverse.length === 0 && !error && (
        <div className="py-14 text-center text-slate-400 font-mono text-xs space-y-1">
          <p className="font-bold text-slate-700">No perpetual contracts match "{searchQuery}"</p>
          <p>Try searching another token symbol or clear the filter.</p>
        </div>
      )}

      {/* Quant Table View */}
      {filteredUniverse.length > 0 && (
        <div className="overflow-x-auto border border-slate-200/60 rounded-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200/70">
                <th className="py-3.5 px-4 font-bold">Symbol</th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('price')}>
                  Price <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('priceChange24h')}>
                  24h Change <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('quoteVolume24h')}>
                  24h Quote Vol <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('fundingRate')}>
                  Funding Rate <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredUniverse.slice(0, 50).map((m) => {
                const isActive = activeSymbol === m.symbol;
                return (
                  <tr
                    key={m.symbol}
                    onClick={() => onSelectSymbol(m.symbol)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-purple-50/80 border-l-4 border-l-[#7c3aed] font-bold'
                        : 'hover:bg-purple-50/30'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-extrabold text-slate-950 flex items-center gap-2">
                      {m.isFeatured && <Star className="w-3.5 h-3.5 text-[#7c3aed] fill-current shrink-0" />}
                      <span>{m.symbol}</span>
                    </td>

                    <td className="py-3.5 px-4 font-bold">
                      ${m.price > 10 ? m.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : m.price.toFixed(4)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                        m.priceChange24h >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                      }`}>
                        {m.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {m.priceChange24h >= 0 ? '+' : ''}{m.priceChange24h.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      ${(m.quoteVolume24h / 1e6).toFixed(1)}M
                    </td>

                    <td className={`py-3.5 px-4 font-semibold ${m.fundingRate >= 0 ? 'text-slate-700' : 'text-rose-600 font-bold'}`}>
                      {(m.fundingRate * 100).toFixed(4)}%
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7c3aed] text-white text-[10px] font-bold shadow-sm">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-[#7c3aed] text-[10px] font-bold transition-colors">
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
            <div className="py-3 text-center text-[11px] font-mono text-slate-400 bg-slate-50/50 border-t border-slate-100">
              Showing top 50 volume contracts of {filteredUniverse.length} total active.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
