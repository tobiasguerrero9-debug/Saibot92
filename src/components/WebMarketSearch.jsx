import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchActiveUniverse, resolveSymbol, fetchActivePerpetualSymbols } from '../services/marketUniverseService';

export default function WebMarketSearch({ onSelectSymbol, activeSymbol }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef(null);

  // Pre-fetch symbol universe index on mount
  useEffect(() => {
    fetchActivePerpetualSymbols();
  }, []);

  // Instant local filtering as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    searchActiveUniverse(query).then((matches) => {
      if (isMounted) {
        setResults(matches);
        setIsLoading(false);
        setIsOpen(true);
        setFocusedIndex(-1);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (symbol) => {
    try {
      const resolved = await resolveSymbol(symbol);
      onSelectSymbol(resolved);
    } catch (e) {
      onSelectSymbol(symbol.toUpperCase());
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (results.length > 0 && focusedIndex >= 0 && focusedIndex < results.length) {
      handleSelect(results[focusedIndex]);
    } else if (results.length > 0) {
      handleSelect(results[0]);
    } else if (query.trim()) {
      handleSelect(query.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={searchRef} className="relative flex-1 max-w-sm">
      <form onSubmit={handleFormSubmit} className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Switch symbol (e.g. AVAXUSDT, NEAR)..."
          className="w-full pl-9 pr-16 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1"
          >
            Clear
          </button>
        ) : (
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-[#7c3aed] font-mono text-[10px] font-bold transition-colors"
          >
            GO
          </button>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-purple-200/90 rounded-2xl shadow-[0_10px_30px_rgba(124,58,237,0.15)] z-50 overflow-hidden font-mono text-xs max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="p-3 text-center text-slate-400 text-[11px]">
              Loading active futures universe...
            </div>
          )}

          {!isLoading && results.length === 0 && (
            <div className="p-3.5 text-center text-slate-500 font-medium text-[11px]">
              No matching perpetual market.
            </div>
          )}

          {!isLoading &&
            results.map((sym, idx) => {
              const isActive = sym === activeSymbol;
              const isFocused = idx === focusedIndex;

              return (
                <div
                  key={sym}
                  onClick={() => handleSelect(sym)}
                  className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isFocused || isActive
                      ? 'bg-purple-50 text-[#7c3aed] font-bold'
                      : 'hover:bg-purple-50/50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold">{sym}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>USD-M PERP</span>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white font-bold text-[9px]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
