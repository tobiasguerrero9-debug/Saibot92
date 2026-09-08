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
  Terminal,
  Activity,
  Layers
} from 'lucide-react';
import { subscriptionManager } from '../services/symbolSubscriptionManager';
import { analyzeMarketContext } from '../services/marketContextEngine';
import { classifyAgentState } from '../services/agentStateClassifier';
import { whatChangedTracker } from '../services/whatChangedTracker';
import { analyzeOrderFlow } from '../services/orderFlowAnalyzer';
import { FEATURED_SYMBOLS } from '../services/marketUniverseService';
import MarketScanner from '../components/MarketScanner';
import MainChartSection from '../components/MainChartSection';
import WhatChangedBlock from '../components/WhatChangedBlock';
import WebMarketSearch from '../components/WebMarketSearch';

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

  const handleManualRefresh = () => {
    subscriptionManager.switchSymbol(selectedSymbol, selectedTimeframe);
  };

  // Perform deterministic evaluations
  const agentStateInfo = classifyAgentState(marketData);
  const whatChanged = whatChangedTracker.get5mChange(selectedSymbol);
  const orderFlowInfo = analyzeOrderFlow(marketData);
  const analysis = analyzeMarketContext(marketData);

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-[#12141A] font-sans selection:bg-[#7C3AED] selection:text-white">
      
      {/* 1. APP HEADER */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E4E6EC] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Navigation Back */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#7C3AED] text-xs font-bold font-mono transition-all border border-purple-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Landing Page</span>
            </button>

            <div className="flex items-center gap-3 border-l border-[#E4E6EC] pl-4">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 p-1 flex items-center justify-center shadow-xs">
                <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-extrabold text-lg text-[#12141A] tracking-tight flex items-center gap-1.5 font-mono">
                  SAIBOT92 <span className="text-[#7C3AED]">/ INTELLIGENCE LAYER</span>
                </span>
                <span className="text-[10px] font-mono text-[#8C94A3] block -mt-1 uppercase tracking-wider">
                  BINANCE USD-M FUTURES TELEMETRY
                </span>
              </div>
            </div>
          </div>

          {/* Connection Status & Refresh Controls */}
          <div className="flex items-center gap-3 font-mono text-xs">
            
            {/* Live Connection Badge */}
            {connectionState === 'CONNECTED' && !isStale && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#10B981] font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>LIVE BINANCE</span>
              </span>
            )}

            {connectionState === 'CONNECTED' && isStale && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>STALE</span>
              </span>
            )}

            {connectionState === 'RECONNECTING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>RECONNECTING</span>
              </span>
            )}

            {connectionState === 'OFFLINE' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE</span>
              </span>
            )}

            {/* Refresh Button & Timestamp */}
            <div className="flex items-center gap-2">
              {marketData?.lastUpdated && (
                <span className="text-[#8C94A3] hidden sm:flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-[#7C3AED]" />
                  <span>updated {marketData.lastUpdated}</span>
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={connectionState === 'LOADING'}
                className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-bold text-xs transition-all flex items-center gap-1 border border-purple-200 shadow-xs"
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
        <div className="bg-white rounded-2xl p-5 border border-[#E4E6EC] shadow-xs space-y-4 font-mono">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Featured Markets Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#8C94A3] uppercase mr-1">Featured:</span>
              {FEATURED_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSymbolChange(sym)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedSymbol === sym
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'bg-[#F2F3F7] hover:bg-purple-50 text-[#5E6675] border border-[#E4E6EC]'
                  }`}
                >
                  <Star className={`w-3 h-3 ${selectedSymbol === sym ? 'fill-current text-white' : 'text-[#8C94A3]'}`} />
                  <span>{sym}</span>
                </button>
              ))}
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center space-x-1 bg-[#F2F3F7] p-1 rounded-xl border border-[#E4E6EC]">
              <button
                onClick={() => setActiveTab('intelligence')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'intelligence'
                    ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]'
                    : 'text-[#5E6675] hover:text-[#12141A]'
                }`}
              >
                Agent Intelligence
              </button>
              <button
                onClick={() => setActiveTab('scanner')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'scanner'
                    ? 'bg-white text-[#7C3AED] shadow-xs border border-[#E4E6EC]'
                    : 'text-[#5E6675] hover:text-[#12141A]'
                }`}
              >
                Market Scanner
              </button>
            </div>

          </div>

          {/* Sub-Control Bar: Symbol Search Input & Timeframe selector */}
          {activeTab === 'intelligence' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#E4E6EC]">
              
              {/* Quick Search Autocomplete */}
              <WebMarketSearch
                activeSymbol={selectedSymbol}
                onSelectSymbol={handleSymbolChange}
              />

              {/* Timeframe Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-[#8C94A3] uppercase mr-1">Candle Feed:</span>
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      selectedTimeframe === tf
                        ? 'bg-[#12141A] text-white shadow-xs'
                        : 'bg-[#F2F3F7] hover:bg-slate-200 text-[#5E6675]'
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

        {/* VIEW 1: AGENT INTELLIGENCE VIEW */}
        {activeTab === 'intelligence' && (
          <>
            {/* Loading State */}
            {connectionState === 'LOADING' && !marketData && (
              <div className="bg-white rounded-2xl p-16 text-center space-y-4 border border-[#E4E6EC] shadow-xs font-mono">
                <RefreshCw className="w-8 h-8 text-[#7C3AED] animate-spin mx-auto" />
                <h3 className="text-lg font-bold text-[#12141A]">Connecting to Binance USD-M Futures Stream...</h3>
                <p className="text-xs text-[#8C94A3]">Fetching public REST snapshot & subscribing to WebSockets for {selectedSymbol}</p>
              </div>
            )}

            {/* Offline Error State */}
            {connectionState === 'OFFLINE' && !marketData && (
              <div className="bg-rose-50 rounded-2xl p-12 text-center space-y-4 border border-rose-200 shadow-xs font-mono">
                <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-xl font-bold text-rose-950">Public Binance Futures Telemetry Offline</h3>
                <p className="text-sm text-rose-700 max-w-md mx-auto">Unable to reach public REST endpoint. Retrying connection...</p>
                <button
                  onClick={handleManualRefresh}
                  className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* Live Telemetry Data Loaded */}
            {marketData && (
              <div className="space-y-8">
                
                {/* HERO MODULES GRID: AGENT STATE (Left) + WHAT CHANGED HERO (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start font-mono">
                  
                  {/* AGENT STATE MODULE */}
                  <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#E4E6EC] shadow-xs space-y-6 flex flex-col justify-between h-full">
                    
                    <div className="space-y-5">
                      <div className="flex items-center justify-between border-b border-[#E4E6EC] pb-4">
                        <div className="flex items-center gap-2 text-[#7C3AED]">
                          <Terminal className="w-4 h-4 text-[#7C3AED]" />
                          <span className="text-xs font-bold uppercase tracking-wider">AGENT STATE</span>
                        </div>
                        <span className="text-[11px] text-[#8C94A3]">
                          EVALUATED AT {marketData.lastUpdated}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#10B981] animate-pulse"></span>
                          <h2 className="text-3xl sm:text-4xl font-black text-[#12141A] tracking-tight">
                            ● {agentStateInfo.state}
                          </h2>
                        </div>

                        <div className="px-3.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-[#5B21B6]">
                          context_score: <span className="text-[#12141A] font-black">{agentStateInfo.contextScore}/100</span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-[#5E6675] font-sans leading-relaxed font-medium">
                        {agentStateInfo.description}
                      </p>
                    </div>

                    {/* Technical State Micro-Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs border-t border-[#E4E6EC]">
                      <div className="p-3 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] space-y-0.5">
                        <span className="text-[10px] text-[#8C94A3] uppercase block font-bold">CONFIDENCE</span>
                        <span className="font-bold text-[#7C3AED]">{agentStateInfo.confidence}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] space-y-0.5">
                        <span className="text-[10px] text-[#8C94A3] uppercase block font-bold">MARKET BIAS</span>
                        <span className="font-bold text-[#10B981]">{agentStateInfo.marketBias}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] space-y-0.5">
                        <span className="text-[10px] text-[#8C94A3] uppercase block font-bold">TRANSITION</span>
                        <span className="font-bold text-[#0891B2]">{agentStateInfo.transition}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] space-y-0.5">
                        <span className="text-[10px] text-[#8C94A3] uppercase block font-bold">SYMBOL</span>
                        <span className="font-bold text-[#12141A]">{marketData.symbol}</span>
                      </div>
                    </div>

                  </div>

                  {/* WHAT CHANGED HERO FEATURE (Right Column) */}
                  <div className="lg:col-span-5 flex justify-center">
                    <WhatChangedBlock whatChanged={whatChanged} isDemo={false} />
                  </div>

                </div>

                {/* 4. ACTIVE SYMBOL METRIC CARDS */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-mono">
                  
                  {/* Price */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">SPOT PRICE</span>
                    <div className="text-xl sm:text-2xl font-black text-[#12141A]">
                      ${marketData.price > 10 ? marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.price.toFixed(4)}
                    </div>
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${marketData.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-rose-600'}`}>
                      {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(2)}%
                    </span>
                  </div>

                  {/* 24h Volume */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">24H QUOTE VOL</span>
                    <div className="text-xl sm:text-2xl font-black text-[#12141A]">
                      ${(marketData.quoteVolume24h / 1e9).toFixed(2)}B
                    </div>
                    <span className="text-[10px] text-[#8C94A3] block font-sans">Market liquidity depth</span>
                  </div>

                  {/* Open Interest */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">OPEN INTEREST</span>
                    <div className="text-xl sm:text-2xl font-black text-[#7C3AED]">
                      ${(marketData.openInterestUsd / 1e9).toFixed(2)}B
                    </div>
                    <span className="text-[10px] text-[#8C94A3] block font-sans">{(marketData.openInterestCoins / 1e3).toFixed(0)}k contract coins</span>
                  </div>

                  {/* Funding Rate */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">FUNDING RATE</span>
                    <div className={`text-xl sm:text-2xl font-black ${marketData.fundingRate >= 0 ? 'text-[#10B981]' : 'text-rose-600'}`}>
                      {(marketData.fundingRate * 100).toFixed(4)}%
                    </div>
                    <span className="text-[10px] text-[#8C94A3] block font-sans">8h carry (Baseline 0.01%)</span>
                  </div>

                  {/* Mark Price */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">MARK PRICE</span>
                    <div className="text-xl sm:text-2xl font-black text-[#12141A]">
                      ${marketData.markPrice > 10 ? marketData.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : marketData.markPrice.toFixed(4)}
                    </div>
                    <span className="text-[10px] text-[#8C94A3] block font-sans">Liquidation reference</span>
                  </div>

                  {/* 24h High/Low */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E4E6EC] shadow-xs space-y-1.5 hover:border-purple-300 transition-all">
                    <span className="text-[10px] font-bold text-[#8C94A3] uppercase tracking-wider block">24H HIGH / LOW</span>
                    <div className="text-xs font-bold text-[#12141A] space-y-0.5">
                      <div className="text-[#10B981]">H: ${marketData.high24h.toLocaleString()}</div>
                      <div className="text-rose-600">L: ${marketData.low24h.toLocaleString()}</div>
                    </div>
                    <span className="text-[10px] text-[#8C94A3] block font-sans">Daily dispersion range</span>
                  </div>

                </div>

                {/* 5. ORDER FLOW PRIORITY MODULE */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E4E6EC] shadow-xs space-y-6 font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E4E6EC]">
                    <div className="flex items-center gap-2 text-[#7C3AED]">
                      <Activity className="w-5 h-5 text-[#7C3AED]" />
                      <div>
                        <h3 className="text-lg font-bold text-[#12141A] tracking-tight">ORDER FLOW & TELEMETRY BREAKDOWN</h3>
                        <p className="text-xs text-[#5E6675] font-sans">Direct exchange taker volume vs derived order flow interpretations</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-md bg-purple-50 text-[#7C3AED] border border-purple-200 text-xs font-bold">
                      {orderFlowInfo.directData.dataBasis}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    
                    {/* Direct Exchange Telemetry — Dark Mini Terminal Panel */}
                    <div 
                      className="p-5 rounded-xl space-y-3 font-mono"
                      style={{
                        background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
                        border: '1px solid rgba(139, 92, 246, 0.38)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(20, 15, 35, 0.12)'
                      }}
                    >
                      <div className="text-xs font-bold text-[#F8F8FC] uppercase tracking-wider border-b border-white/10 pb-2.5 flex items-center gap-1.5">
                        <span className="text-[#A78BFA] font-mono font-bold">›</span>
                        <span>DIRECT EXCHANGE DATA (RAW TAKERS)</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Taker Buy Sample Volume:</span>
                        <span className="font-extrabold text-[#34D399]">{orderFlowInfo.directData.takerBuyVol.toFixed(2)} Coins</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Taker Sell Sample Volume:</span>
                        <span className="font-extrabold text-[#F87171]">{orderFlowInfo.directData.takerSellVol.toFixed(2)} Coins</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Taker Buy Share Ratio:</span>
                        <span className="font-extrabold text-[#F8F8FC]">{orderFlowInfo.derivedData.buyRatioPct}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[#AEB5C3]">24h Quote Vol Total:</span>
                        <span className="font-extrabold text-[#C084FC]">${(marketData.quoteVolume24h / 1e9).toFixed(2)}B</span>
                      </div>
                    </div>

                    {/* Derived Interpretations — Dark Mini Terminal Panel */}
                    <div 
                      className="p-5 rounded-xl space-y-3 font-mono"
                      style={{
                        background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
                        border: '1px solid rgba(139, 92, 246, 0.38)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(20, 15, 35, 0.12)'
                      }}
                    >
                      <div className="text-xs font-bold text-[#F8F8FC] uppercase tracking-wider border-b border-white/10 pb-2.5 flex items-center gap-1.5">
                        <span className="text-[#A78BFA] font-mono font-bold">›</span>
                        <span>DERIVED ORDER FLOW INTERPRETATIONS</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Aggressive Buyers:</span>
                        <span className="font-extrabold text-[#34D399]">{orderFlowInfo.derivedData.aggressiveBuyers}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Aggressive Sellers:</span>
                        <span className="font-extrabold text-[#F87171]">{orderFlowInfo.derivedData.aggressiveSellers}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                        <span className="text-[#AEB5C3]">Taker Imbalance:</span>
                        <span className="font-extrabold text-[#C084FC]">{orderFlowInfo.derivedData.takerImbalance}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[#AEB5C3]">Order Flow Pressure:</span>
                        <span className="font-extrabold text-[#F8F8FC]">{orderFlowInfo.derivedData.orderFlowPressure}</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 6. MAIN CHART & QUANT CONTEXT ENGINE PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-mono">
                  
                  {/* Left: Main Chart Component */}
                  <div className="lg:col-span-7">
                    <MainChartSection marketData={marketData} selectedTimeframe={selectedTimeframe} />
                  </div>

                  {/* Right: Quant Context Engine Panel */}
                  <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-8 border border-[#E4E6EC] shadow-xs space-y-6 flex flex-col justify-between">
                    
                    <div className="space-y-5">
                      
                      {/* Context Scene & Data Score Gauge */}
                      <div className="flex items-center justify-between border-b border-[#E4E6EC] pb-4">
                        <div>
                          <span className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider block">MARKET CONTEXT STATE</span>
                          <h3 className="text-xl font-extrabold text-[#12141A] tracking-tight">{analysis.condition}</h3>
                        </div>

                        <div className="text-right bg-purple-50 border border-purple-200 px-3.5 py-2 rounded-xl">
                          <span className="text-[10px] font-bold text-[#5E6675] block">DATA SCORE</span>
                          <div className="text-2xl font-black text-[#7C3AED]">{analysis.score}<span className="text-xs text-[#8C94A3] font-normal">/100</span></div>
                        </div>
                      </div>

                      {/* Transition Pressure */}
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F2F3F7] border border-[#E4E6EC] text-xs">
                        <span className="text-[#5E6675] font-bold">Transition Pressure:</span>
                        <span className="font-extrabold px-2.5 py-1 rounded-lg bg-purple-100 text-[#7C3AED]">
                          {analysis.transitionPressure}
                        </span>
                      </div>

                      {/* Drivers Block */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C94A3] uppercase tracking-wider">
                          <Info className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>Key Telemetry Drivers</span>
                        </div>
                        <div className="bg-[#F2F3F7] rounded-xl p-4 border border-[#E4E6EC] space-y-2">
                          {analysis.observations.map((obs, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-[#12141A] font-medium font-sans">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] shrink-0 mt-1.5"></span>
                              <span className="leading-relaxed">{obs}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Disclaimer Note */}
                    <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 text-[11px] text-[#5E6675] font-sans leading-relaxed">
                      <strong>AI Context Engine Notice:</strong> Telemetry outputs are deterministic market context derived from live Binance REST and WebSocket streams. Not financial advice or trade signals.
                    </div>

                  </div>

                </div>

                {/* SCENARIOS BREAKDOWN GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                  
                  {/* Continuation */}
                  <div className="bg-white rounded-2xl p-6 border border-[#E4E6EC] shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-[#10B981] font-bold text-sm">
                      <span className="p-1 rounded-lg bg-emerald-50 border border-emerald-200">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                      <span>Continuation Scenario</span>
                    </div>
                    <p className="text-xs text-[#5E6675] font-sans leading-relaxed">
                      {analysis.continuationScenario}
                    </p>
                  </div>

                  {/* Transition */}
                  <div className="bg-white rounded-2xl p-6 border border-[#E4E6EC] shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-[#7C3AED] font-bold text-sm">
                      <span className="p-1 rounded-lg bg-purple-50 border border-purple-200">
                        <Zap className="w-4 h-4" />
                      </span>
                      <span>Transition Scenario</span>
                    </div>
                    <p className="text-xs text-[#5E6675] font-sans leading-relaxed">
                      {analysis.transitionScenario}
                    </p>
                  </div>

                  {/* Invalidation */}
                  <div className="bg-white rounded-2xl p-6 border border-[#E4E6EC] shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                      <span className="p-1 rounded-lg bg-rose-50 border border-rose-200">
                        <ShieldAlert className="w-4 h-4" />
                      </span>
                      <span>Invalidation Scenario</span>
                    </div>
                    <p className="text-xs text-[#5E6675] font-sans leading-relaxed">
                      {analysis.invalidationScenario}
                    </p>
                  </div>

                </div>

                {/* 7. SAIBOT SAYS MODULE */}
                <div className="bg-gradient-to-r from-[#5B21B6] to-[#7C3AED] rounded-2xl p-8 text-white shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-400/40 pb-4 font-mono">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-white/20">
                        <BrainCircuit className="w-6 h-6 text-purple-100" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">SAIBOT SAYS</h3>
                        <p className="text-xs text-purple-200 font-sans">Deterministic Agent Natural Language Synthesis</p>
                      </div>
                    </div>
                    <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-purple-100 text-xs font-bold">
                      Rule-Based Engine
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-purple-50 leading-relaxed font-sans font-medium">
                    "{analysis.agentSummary}"
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
