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
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E4E6EC] shadow-xs space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E4E6EC]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-[#7C3AED]">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-extrabold text-[#12141A] tracking-tight font-mono">
              Binance Futures Market Scanner
            </h3>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-purple-50 text-[#7C3AED] border border-purple-200">
              {universe.length} Contracts Active
            </span>
          </div>
          <p className="text-xs text-[#5E6675] font-medium mt-1">
            Real-time public USDT perpetual contract universe ordered by 24h volume
          </p>
        </div>

        {/* Filter Toggle & Refresh */}
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <div className="flex items-center space-x-1 bg-[#F2F3F7] p-1 rounded-xl border border-[#E4E6EC]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]'
                  : 'text-[#5E6675] hover:text-[#12141A]'
              }`}
            >
              All Markets ({universe.length})
            </button>
            <button
              onClick={() => setFilterMode('featured')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'featured'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-[#5E6675] hover:text-[#12141A]'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Featured ({FEATURED_SYMBOLS.length})</span>
            </button>
          </div>

          <button
            onClick={loadUniverse}
            disabled={loading}
            className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] transition-colors border border-purple-200"
            title="Refresh Market Universe"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8C94A3] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search any USDT perpetual (e.g. BTCUSDT, SOL, DOGE)..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] text-[#12141A] text-xs font-mono font-medium focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C94A3] hover:text-[#12141A]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && universe.length === 0 && (
        <div className="py-14 text-center text-[#5E6675] space-y-3 font-mono text-xs">
          <RefreshCw className="w-6 h-6 text-[#7C3AED] animate-spin mx-auto" />
          <p>Scanning active Binance USD-M perpetual contracts...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center space-y-3">
          <p>{error}</p>
          <button onClick={loadUniverse} className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-xs">
            Retry Scan
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredUniverse.length === 0 && !error && (
        <div className="py-14 text-center text-[#8C94A3] font-mono text-xs space-y-1">
          <p className="font-bold text-[#12141A]">No perpetual contracts match "{searchQuery}"</p>
          <p>Try searching another token symbol or clear the filter.</p>
        </div>
      )}

      {/* Quant Table View */}
      {filteredUniverse.length > 0 && (
        <div className="overflow-x-auto border border-[#E4E6EC] rounded-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#F2F3F7] text-[#5E6675] uppercase tracking-wider text-[11px] border-b border-[#E4E6EC]">
                <th className="py-3.5 px-4 font-bold">Symbol</th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#12141A] transition-colors" onClick={() => handleSort('price')}>
                  Price <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#12141A] transition-colors" onClick={() => handleSort('priceChange24h')}>
                  24h Change <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#12141A] transition-colors" onClick={() => handleSort('quoteVolume24h')}>
                  24h Quote Vol <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold cursor-pointer hover:text-[#12141A] transition-colors" onClick={() => handleSort('fundingRate')}>
                  Funding Rate <ArrowUpDown className="w-3 h-3 inline ml-0.5 opacity-60" />
                </th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EC] text-[#12141A]">
              {filteredUniverse.slice(0, 50).map((m) => {
                const isActive = activeSymbol === m.symbol;
                return (
                  <tr
                    key={m.symbol}
                    onClick={() => onSelectSymbol(m.symbol)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-purple-50/80 border-l-4 border-l-[#7C3AED] font-bold'
                        : 'hover:bg-purple-50/30'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-extrabold text-[#12141A] flex items-center gap-2">
                      {m.isFeatured && <Star className="w-3.5 h-3.5 text-[#7C3AED] fill-current shrink-0" />}
                      <span>{m.symbol}</span>
                    </td>

                    <td className="py-3.5 px-4 font-bold">
                      ${m.price > 10 ? m.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : m.price.toFixed(4)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                        m.priceChange24h >= 0 ? 'text-[#10B981] bg-emerald-50' : 'text-rose-600 bg-rose-50'
                      }`}>
                        {m.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {m.priceChange24h >= 0 ? '+' : ''}{m.priceChange24h.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-[#5E6675]">
                      ${(m.quoteVolume24h / 1e6).toFixed(1)}M
                    </td>

                    <td className={`py-3.5 px-4 font-semibold ${m.fundingRate >= 0 ? 'text-[#5E6675]' : 'text-rose-600 font-bold'}`}>
                      {(m.fundingRate * 100).toFixed(4)}%
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-[#F2F3F7] hover:bg-purple-100 text-[#5E6675] hover:text-[#7C3AED] text-[10px] font-bold transition-colors">
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
            <div className="py-3 text-center text-[11px] font-mono text-[#8C94A3] bg-[#F2F3F7]/50 border-t border-[#E4E6EC]">
              Showing top 50 volume contracts of {filteredUniverse.length} total active.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
