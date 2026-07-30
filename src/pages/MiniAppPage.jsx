import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  ShieldAlert, 
  BrainCircuit, 
  TrendingUp, 
  TrendingDown,
  Zap,
  WifiOff,
  Star,
  Search,
  Info,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { subscriptionManager } from '../services/symbolSubscriptionManager';
import { analyzeMarketContext } from '../services/marketContextEngine';
import { FEATURED_SYMBOLS } from '../services/marketUniverseService';
import MarketScanner from '../components/MarketScanner';
import MainChartSection from '../components/MainChartSection';

const TIMEFRAMES = ['5m', '15m', '1h'];

export default function MiniAppPage() {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [symbolSearchInput, setSymbolSearchInput] = useState('');

  const [marketData, setMarketData] = useState(null);
  const [connectionState, setConnectionState] = useState('LOADING');
  const [isStale, setIsStale] = useState(false);
  const [activeTab, setActiveTab] = useState('intelligence'); // 'intelligence' | 'scanner'

  useEffect(() => {
    const unsubscribe = subscriptionManager.subscribeState((data, connState, stale) => {
      setMarketData(data ? { ...data } : null);
      setConnectionState(connState);
      setIsStale(stale);
    });

    subscriptionManager.switchSymbol(selectedSymbol, selectedTimeframe);

    return () => {
      unsubscribe();
    };
  }, [selectedSymbol, selectedTimeframe]);

  const handleSymbolChange = (sym) => {
    setSelectedSymbol(sym.toUpperCase());
    setSymbolSearchInput('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (symbolSearchInput.trim()) {
      handleSymbolChange(symbolSearchInput.trim());
    }
  };

  const handleManualRefresh = () => {
    subscriptionManager.switchSymbol(selectedSymbol, selectedTimeframe);
  };

  const analysis = analyzeMarketContext(marketData);

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-slate-900 font-sans selection:bg-purple-600 selection:text-white">
      
      {/* 1. APP HEADER */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Navigation Back */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Landing Page</span>
            </button>

            <div className="flex items-center gap-2.5 border-l border-slate-200/80 pl-4">
              <div className="w-8 h-8 rounded-lg bg-purple-100 p-0.5 shadow-sm border border-purple-200">
                <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-extrabold text-xl text-slate-950 tracking-tight flex items-center gap-1.5">
                  SAIBOT<span className="text-[#7c3aed]">92</span>
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-400 block -mt-1 uppercase tracking-wider">
                  Futures Intelligence Core v2.4
                </span>
              </div>
            </div>
          </div>

          {/* Connection Status & Refresh Controls */}
          <div className="flex items-center gap-3">
            
            {/* Status Pill */}
            {connectionState === 'CONNECTED' && !isStale && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Binance Data</span>
              </span>
            )}

            {connectionState === 'CONNECTED' && isStale && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Stale Data (Retrying...)</span>
              </span>
            )}

            {connectionState === 'RECONNECTING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reconnecting...</span>
              </span>
            )}

            {connectionState === 'OFFLINE' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold font-mono">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}

            {/* Refresh Button & Timestamp */}
            <div className="flex items-center gap-2">
              {marketData?.lastUpdated && (
                <span className="text-xs font-mono text-slate-500 hidden sm:flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{marketData.lastUpdated}</span>
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={connectionState === 'LOADING'}
                className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-bold text-xs transition-all flex items-center gap-1 border border-purple-200 shadow-sm"
                title="Manual Refresh Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${connectionState === 'LOADING' ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 2. CONTROL BAR */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Featured Markets Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase mr-1">Featured:</span>
              {FEATURED_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSymbolChange(sym)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    selectedSymbol === sym
                      ? 'bg-[#7c3aed] text-white shadow-md shadow-purple-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Star className={`w-3 h-3 ${selectedSymbol === sym ? 'fill-current' : 'text-slate-400'}`} />
                  <span>{sym}</span>
                </button>
              ))}
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
              <button
                onClick={() => setActiveTab('intelligence')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  activeTab === 'intelligence'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Intelligence View
              </button>
              <button
                onClick={() => setActiveTab('scanner')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  activeTab === 'scanner'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Market Scanner
              </button>
            </div>

          </div>

          {/* Sub-Control Bar: Symbol Search Input & Timeframe selector */}
          {activeTab === 'intelligence' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
              
              {/* Quick Search */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={symbolSearchInput}
                  onChange={(e) => setSymbolSearchInput(e.target.value)}
                  placeholder="Switch symbol (e.g. AVAXUSDT, NEAR)..."
                  className="w-full pl-9 pr-16 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-[#7c3aed] font-mono text-[10px] font-bold transition-colors"
                >
                  GO
                </button>
              </form>

              {/* Timeframe Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase mr-1">Candle Timeframe:</span>
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
                      selectedTimeframe === tf
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

            </div>
          )}

        </div>

        {/* VIEW 2: MARKET SCANNER */}
        {activeTab === 'scanner' && (
          <MarketScanner
            activeSymbol={selectedSymbol}
            onSelectSymbol={(sym) => {
              handleSymbolChange(sym);
              setActiveTab('intelligence');
            }}
          />
        )}

        {/* VIEW 1: INTELLIGENCE VIEW */}
        {activeTab === 'intelligence' && (
          <>
            {/* Loading State */}
            {connectionState === 'LOADING' && !marketData && (
              <div className="bg-white rounded-3xl p-16 text-center space-y-4 border border-slate-200/80 shadow-sm">
                <RefreshCw className="w-8 h-8 text-[#7c3aed] animate-spin mx-auto" />
                <h3 className="text-lg font-bold text-slate-950">Connecting to Binance USD-M Futures Stream...</h3>
                <p className="text-xs text-slate-500 font-mono">Fetching public REST snapshot & subscribing to WebSockets for {selectedSymbol}</p>
              </div>
            )}

            {/* Offline Error State */}
            {connectionState === 'OFFLINE' && !marketData && (
              <div className="bg-rose-50 rounded-3xl p-12 text-center space-y-4 border border-rose-200 shadow-sm">
                <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-xl font-bold text-rose-950">Public Binance Futures Telemetry Offline</h3>
                <p className="text-sm text-rose-700 max-w-md mx-auto">Unable to reach public REST endpoint. Retrying connection...</p>
                <button
                  onClick={handleManualRefresh}
                  className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* Live Telemetry Data Loaded */}
            {marketData && (
              <div className="space-y-8">
                
                {/* 3. ACTIVE SYMBOL HERO & 4. METRIC CARDS */}
                <div className="space-y-4">
                  
                  {/* Symbol Header Banner */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-mono font-black text-slate-950 tracking-tight">
                          {marketData.symbol}
                        </h2>
                        <span className="px-3 py-1 rounded-full bg-purple-50 text-[#7c3aed] border border-purple-200 text-xs font-mono font-bold">
                          USDT Perpetual
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Binance USD-M Futures • Live WebSockets Active
                      </p>
                    </div>

                    <div className="flex items-baseline space-x-3 font-mono">
                      <span className="text-4xl font-black text-slate-950 tracking-tight">
                        ${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-bold px-3 py-1 rounded-full text-sm ${
                        marketData.priceChange24h >= 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                      }`}>
                        {marketData.priceChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* 6 Rich Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    
                    {/* Price Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">SPOT PRICE</span>
                      <div className="text-2xl font-mono font-black text-slate-950 group-hover:text-[#7c3aed] transition-colors">
                        ${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">Sub-second websocket</span>
                    </div>

                    {/* 24h Volume Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">24H QUOTE VOL</span>
                      <div className="text-2xl font-mono font-black text-slate-950 group-hover:text-[#7c3aed] transition-colors">
                        ${(marketData.quoteVolume24h / 1e9).toFixed(2)}B
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">Market liquidity depth</span>
                    </div>

                    {/* Open Interest Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">OPEN INTEREST</span>
                      <div className="text-2xl font-mono font-black text-[#7c3aed]">
                        ${(marketData.openInterestUsd / 1e9).toFixed(2)}B
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">{(marketData.openInterestCoins / 1e3).toFixed(0)}k contract coins</span>
                    </div>

                    {/* Funding Rate Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">FUNDING RATE</span>
                      <div className={`text-2xl font-mono font-black ${marketData.fundingRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(marketData.fundingRate * 100).toFixed(4)}%
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">8h carry rate ({marketData.fundingRate >= 0 ? 'longs pay' : 'shorts pay'})</span>
                    </div>

                    {/* Mark Price Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">MARK PRICE</span>
                      <div className="text-2xl font-mono font-black text-slate-800">
                        ${marketData.markPrice > 10 ? marketData.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.markPrice.toFixed(4)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">Liquidation reference</span>
                    </div>

                    {/* 24h Range Card */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2 hover:border-purple-300 transition-all group">
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">24H HIGH / LOW</span>
                      <div className="text-xs font-mono font-bold text-slate-800 space-y-0.5">
                        <div className="text-emerald-600">H: ${marketData.high24h.toLocaleString()}</div>
                        <div className="text-rose-600">L: ${marketData.low24h.toLocaleString()}</div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block">Daily dispersion range</span>
                    </div>

                  </div>

                </div>

                {/* 5. UPGRADED MAIN CHART & QUANT CONTEXT ENGINE PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Left: Upgraded Main Chart Component */}
                  <div className="lg:col-span-7">
                    <MainChartSection marketData={marketData} selectedTimeframe={selectedTimeframe} />
                  </div>

                  {/* Right: Quant Context Engine Panel */}
                  <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-6 flex flex-col justify-between">
                    
                    <div className="space-y-5">
                      
                      {/* Context Scene & Data Score Gauge */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-[11px] font-mono font-bold text-[#7c3aed] uppercase tracking-wider block">MARKET CONTEXT STATE</span>
                          <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">{analysis.condition}</h3>
                        </div>

                        <div className="text-right bg-purple-50 border border-purple-200/80 px-3.5 py-2 rounded-2xl">
                          <span className="text-[10px] font-mono font-bold text-slate-500 block">DATA SCORE</span>
                          <div className="text-2xl font-mono font-black text-[#7c3aed]">{analysis.score}<span className="text-xs text-slate-400 font-normal">/100</span></div>
                        </div>
                      </div>

                      {/* Transition Pressure */}
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                        <span className="text-xs font-mono font-bold text-slate-600">Transition Pressure:</span>
                        <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg bg-purple-100 text-[#7c3aed]">
                          {analysis.transitionPressure}
                        </span>
                      </div>

                      {/* Drivers Block */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                          <Info className="w-3.5 h-3.5 text-[#7c3aed]" />
                          <span>Key Telemetry Drivers</span>
                        </div>
                        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 space-y-2">
                          {analysis.observations.map((obs, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] shrink-0 mt-1.5"></span>
                              <span className="leading-relaxed">{obs}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Disclaimer Note */}
                    <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 text-[11px] text-slate-600 font-medium leading-relaxed">
                      <strong>AI Context Engine Notice:</strong> Telemetry outputs are deterministic market context derived from live Binance REST and WebSocket streams. Not financial advice or trade signals.
                    </div>

                  </div>

                </div>

                {/* SCENARIOS BREAKDOWN GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Continuation */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm font-mono">
                      <span className="p-1 rounded-lg bg-emerald-50 border border-emerald-200">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                      <span>Continuation Scenario</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {analysis.continuationScenario}
                    </p>
                  </div>

                  {/* Transition */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-3">
                    <div className="flex items-center gap-2 text-[#7c3aed] font-bold text-sm font-mono">
                      <span className="p-1 rounded-lg bg-purple-50 border border-purple-200">
                        <Zap className="w-4 h-4" />
                      </span>
                      <span>Transition Scenario</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {analysis.transitionScenario}
                    </p>
                  </div>

                  {/* Invalidation */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-3">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-sm font-mono">
                      <span className="p-1 rounded-lg bg-rose-50 border border-rose-200">
                        <ShieldAlert className="w-4 h-4" />
                      </span>
                      <span>Invalidation Scenario</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {analysis.invalidationScenario}
                    </p>
                  </div>

                </div>

                {/* AGENT NATURAL LANGUAGE SYNTHESIS PANEL */}
                <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl space-y-4 border border-purple-800/40">
                  <div className="flex items-center justify-between border-b border-purple-700/50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-800/60 p-1 flex items-center justify-center border border-purple-500/40">
                        <BrainCircuit className="w-6 h-6 text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">SAIBOT92 Agent Natural Language Synthesis</h3>
                        <p className="text-xs text-purple-200 font-mono">Deterministic Context Engine output based on Binance live telemetry</p>
                      </div>
                    </div>
                    <span className="px-3.5 py-1 rounded-full bg-purple-800/80 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold">
                      Rule-Based Engine
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-purple-100 leading-relaxed font-normal">
                    {analysis.agentSummary}
                  </p>
                </div>

              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
