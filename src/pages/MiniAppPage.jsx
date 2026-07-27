import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  BarChart2, 
  ShieldAlert, 
  BrainCircuit, 
  Sparkles,
  Zap
} from 'lucide-react';
import { fetchFuturesMarketData } from '../services/binanceApi';
import { analyzeMarketContext } from '../services/analysisEngine';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const MARKETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const TIMEFRAMES = ['5m', '15m', '1h'];

export default function MiniAppPage() {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');

  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const marketResult = await fetchFuturesMarketData(selectedSymbol, selectedTimeframe);
      const analysisResult = analyzeMarketContext(marketResult);
      setData(marketResult);
      setAnalysis(analysisResult);
      setLastUpdated(new Date().toLocaleTimeString([], { hour12: false }));
    } catch (err) {
      setError(err.message || 'Failed to fetch public Binance USD-M Futures data');
      setData(null);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedTimeframe]);

  // Initial load and symbol/timeframe changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-600 selection:text-white">
      
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          
          {/* Back & Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Landing Page</span>
            </button>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="w-7 h-7 rounded-lg bg-purple-100 p-0.5">
                <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
              </div>
              <span className="font-extrabold text-xl text-slate-950 tracking-tight">
                SAIBOT<span className="text-[#7c3aed]">92</span> <span className="text-xs font-mono font-normal text-slate-500">MINI APP MVP</span>
              </span>
            </div>
          </div>

          {/* Live Data Connection Status Indicator */}
          <div className="flex items-center gap-3">
            {error ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Connection Error</span>
              </span>
            ) : data ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Binance Futures Data</span>
              </span>
            ) : null}

            {/* Refresh Button & Time */}
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                  Updated: {lastUpdated}
                </span>
              )}
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#7c3aed] font-bold text-xs transition-colors flex items-center gap-1 border border-purple-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Controls Bar: Symbol & Timeframe Selectors */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          
          {/* Symbol Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase mr-1">Market:</span>
            {MARKETS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  selectedSymbol === sym
                    ? 'bg-[#7c3aed] text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase mr-1">Timeframe:</span>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="bg-white rounded-3xl p-16 text-center space-y-4 border border-slate-200 shadow-sm">
            <RefreshCw className="w-8 h-8 text-[#7c3aed] animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Fetching Live Binance USD-M Futures Telemetry...</h3>
            <p className="text-sm text-slate-500 font-mono">Connecting to public REST endpoint for {selectedSymbol}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 rounded-3xl p-12 text-center space-y-4 border border-rose-200 shadow-sm">
            <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
            <h3 className="text-xl font-bold text-rose-900">Failed to Load Public Market Data</h3>
            <p className="text-sm text-rose-700 max-w-md mx-auto">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Live Data Loaded View */}
        {data && analysis && (
          <div className="space-y-8">
            
            {/* 1. Market Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              {/* Price */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">PRICE ({data.symbol})</span>
                <div className="text-2xl font-mono font-black text-slate-950">
                  ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* 24h Change */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">24H CHANGE</span>
                <div className={`text-2xl font-mono font-black ${data.priceChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {data.priceChange >= 0 ? '+' : ''}{data.priceChange.toFixed(2)}%
                </div>
              </div>

              {/* 24h Volume */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">24H VOLUME</span>
                <div className="text-2xl font-mono font-black text-slate-950">
                  ${(data.volume24h / 1e9).toFixed(2)}B
                </div>
              </div>

              {/* Open Interest */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">OPEN INTEREST</span>
                <div className="text-2xl font-mono font-black text-[#7c3aed]">
                  ${(data.openInterestUsd / 1e9).toFixed(2)}B
                </div>
              </div>

              {/* Funding Rate */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">FUNDING RATE</span>
                <div className={`text-2xl font-mono font-black ${data.fundingRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {(data.fundingRate * 100).toFixed(4)}%
                </div>
              </div>

              {/* 24h Range */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">24H HIGH / LOW</span>
                <div className="text-xs font-mono font-bold text-slate-700">
                  H: ${data.high24h.toLocaleString()}<br />
                  L: ${data.low24h.toLocaleString()}
                </div>
              </div>

            </div>

            {/* 2. Main Grid: Candlestick Chart + Analysis Engine */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left: Kline Chart */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-[#7c3aed]" />
                    <h3 className="text-lg font-bold text-slate-950">
                      {data.symbol} Price & Taker Volume ({selectedTimeframe})
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">Binance Futures Feed</span>
                </div>

                <div className="h-[320px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.klines} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px' }} />
                      <Bar dataKey="volume" fill="#cbd5e1" radius={[2, 2, 0, 0]} barSize={8} name="Volume" />
                      <Line type="monotone" dataKey="close" stroke="#7c3aed" strokeWidth={2.5} dot={false} name="Close Price ($)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Transparent Rule-Based Analysis Engine Display */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-[#7c3aed] uppercase">CONTEXT SCENE</span>
                      <h3 className="text-xl font-extrabold text-slate-950">{analysis.condition}</h3>
                    </div>

                    {/* Data Score Badge */}
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-400">DATA SCORE</span>
                      <div className="text-2xl font-mono font-black text-[#7c3aed]">{analysis.score}/100</div>
                    </div>
                  </div>

                  {/* Transition Pressure */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100">
                    <span className="text-xs font-mono font-bold text-slate-600">Transition Pressure:</span>
                    <span className="text-xs font-mono font-bold text-[#7c3aed]">{analysis.transitionPressure}</span>
                  </div>

                  {/* Key Observations */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">Key Data Observations</h4>
                    <ul className="space-y-2 text-xs text-slate-700 font-medium">
                      {analysis.observations.map((obs, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] shrink-0 mt-1"></span>
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Disclaimer Label */}
                <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-500 font-medium">
                  <strong>Notice:</strong> Interpretations are rule-based market context derived from public telemetry. Not financial advice or trade signals.
                </div>

              </div>

            </div>

            {/* 3. Scenarios Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Continuation */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm font-mono">
                  <TrendingUp className="w-4 h-4" />
                  <span>Continuation Scenario</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {analysis.continuationScenario}
                </p>
              </div>

              {/* Transition */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-[#7c3aed] font-bold text-sm font-mono">
                  <Zap className="w-4 h-4" />
                  <span>Transition Scenario</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {analysis.transitionScenario}
                </p>
              </div>

              {/* Invalidation */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-sm font-mono">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Invalidation Scenario</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {analysis.invalidationScenario}
                </p>
              </div>

            </div>

            {/* 4. Agent Analysis Panel */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-8 text-white shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-purple-700/50 pb-4">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="w-6 h-6 text-purple-300" />
                  <div>
                    <h3 className="text-lg font-bold text-white">SAIBOT92 Agent Natural Language Synthesis</h3>
                    <p className="text-xs text-purple-200 font-mono">Deterministic Context Engine output based on Binance live REST data</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-purple-800 text-purple-200 text-xs font-mono font-bold">
                  Rule-Based Engine
                </span>
              </div>

              <p className="text-sm sm:text-base text-purple-100 leading-relaxed font-normal">
                {analysis.agentSummary}
              </p>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
