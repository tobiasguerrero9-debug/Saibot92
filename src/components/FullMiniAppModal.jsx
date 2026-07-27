import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Activity, ShieldAlert, Zap, TrendingUp, TrendingDown, RefreshCw, BarChart2, Layers, Cpu, CheckCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

const liveChartData = [
  { time: '17:40', btc: 67750, longLiqs: 2.1, shortLiqs: -0.8 },
  { time: '17:42', btc: 67790, longLiqs: 1.4, shortLiqs: -1.2 },
  { time: '17:44', btc: 67820, longLiqs: 4.8, shortLiqs: -0.4 },
  { time: '17:46', btc: 67800, longLiqs: 0.9, shortLiqs: -3.5 },
  { time: '17:48', btc: 67842, longLiqs: 6.2, shortLiqs: -1.1 },
  { time: '17:50', btc: 67880, longLiqs: 8.5, shortLiqs: -0.6 },
  { time: '17:52', btc: 67860, longLiqs: 2.4, shortLiqs: -4.8 },
];

export default function FullMiniAppModal({ isOpen, onClose }) {
  const [selectedPair, setSelectedPair] = useState('BTC-PERP');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'agent',
      text: 'SAIBOT92 Agent Core online. Live order flow, open interest, and liquidation streams initialized for BTC-PERP. How can I assist your market positioning?',
      time: 'Just now',
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveTape, setLiveTape] = useState([]);
  const chatEndRef = useRef(null);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Simulate live trade/liquidation tape ticks
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const isLong = Math.random() > 0.45;
      const size = (Math.random() * 850 + 50).toFixed(1);
      const price = (67800 + (Math.random() - 0.48) * 60).toFixed(2);

      const newTick = {
        id: Date.now(),
        symbol: selectedPair,
        type: isLong ? 'LONG LIQ' : 'SHORT LIQ',
        amount: `$${size}K`,
        price: `$${price}`,
        isLong,
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setLiveTape((prev) => [newTick, ...prev.slice(0, 14)]);
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen, selectedPair]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputMsg;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMsg('');
    setIsTyping(true);

    // Simulate Agent Intelligence response
    setTimeout(() => {
      let agentReply = '';
      const query = text.toLowerCase();

      if (query.includes('liquidation') || query.includes('cascade')) {
        agentReply = `Analysis for ${selectedPair}: Liquidation cluster detected between $67,200 (Longs $34.2M) and $68,400 (Shorts $28.9M). Delta skew remains slightly positive (+4.2%). Recommendation: Monitor order book depth for absorption prior to break.`;
      } else if (query.includes('funding') || query.includes('oi')) {
        agentReply = `Open Interest on ${selectedPair} increased by $145M over the past 2 hours. Funding rate is currently +0.0100%. Shorts are beginning to pay elevated carry, indicating high leverage concentration.`;
      } else if (query.includes('signal') || query.includes('setup')) {
        agentReply = `Top Signal Detected [94% Confidence]: High-probability Long Squeeze setup on ${selectedPair}. Taker sell volume exceeded buy volume by 1.8x in the 5-minute candle.`;
      } else {
        agentReply = `SAIBOT92 Intelligence Engine evaluated query for ${selectedPair}: Market regime showing balanced order flow. Current liquidation risk score: 38/100 (Moderate). No immediate cascade trigger detected.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'agent',
          text: agentReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#040108]/95 backdrop-blur-2xl flex flex-col overflow-hidden text-slate-100">
      
      {/* Top Navigation Bar */}
      <div className="bg-[#0a0416] border-b border-purple-900/40 px-4 py-3 flex items-center justify-between shrink-0">
        
        {/* Logo & Agent Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-900/80 border border-purple-500/40 p-0.5">
              <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-white text-base tracking-wider">
              SAIBOT<span className="text-purple-400">92</span> <span className="text-xs text-purple-400/80 font-mono font-normal">MINI APP v2.4</span>
            </span>
          </div>

          {/* Contract Selector */}
          <div className="hidden sm:flex items-center space-x-1 bg-purple-950/60 p-1 rounded-lg border border-purple-500/20 text-xs font-mono">
            {['BTC-PERP', 'ETH-PERP', 'SOL-PERP'].map((pair) => (
              <button
                key={pair}
                onClick={() => setSelectedPair(pair)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedPair === pair ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>SUB-SECOND TICK ENGINE ACTIVE</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-slate-300 hover:text-white hover:bg-purple-900/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* Main Mini App Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Column: Live Analytics & Liquidation Feed */}
        <div className="lg:col-span-7 p-4 flex flex-col space-y-4 overflow-y-auto border-r border-purple-900/30">
          
          {/* Market Header */}
          <div className="glass-card p-4 rounded-xl border border-purple-500/25 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white font-mono">{selectedPair}</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-xs font-mono font-bold">
                  +2.34%
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Price: $67,842.11 | OI: $16.2B | Funding: 0.0100%
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Order Flow Delta:</span>
              <span className="text-sm font-bold font-mono text-emerald-400">+4.2% (BUY BIAS)</span>
            </div>
          </div>

          {/* Real-time Order Flow & Liquidation Chart */}
          <div className="glass-card p-4 rounded-xl border border-purple-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-400" />
                Live Liquidations & Price Trajectory
              </span>
              <div className="flex items-center space-x-3 text-[11px] font-mono">
                <span className="text-emerald-400">● Long Liqs</span>
                <span className="text-rose-400">● Short Liqs</span>
                <span className="text-purple-300">― BTC Price</span>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={liveChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0721', borderColor: '#7c3aed', borderRadius: '8px', fontSize: '11px' }} 
                  />
                  <Bar dataKey="longLiqs" fill="#10b981" barSize={10} name="Long Liqs ($M)" />
                  <Bar dataKey="shortLiqs" fill="#f43f5e" barSize={10} name="Short Liqs ($M)" />
                  <Line type="monotone" dataKey="btc" stroke="#c084fc" strokeWidth={2} dot={false} name="BTC Price ($)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Real-Time Liquidation Tape Stream */}
          <div className="glass-card p-4 rounded-xl border border-purple-500/25 flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400 animate-bounce" />
                Live Liquidation Telemetry Stream
              </span>
              <span className="text-[11px] font-mono text-purple-300">REAL-TIME FEED</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-2 font-mono text-xs max-h-[200px]">
              {liveTape.map((tick) => (
                <div 
                  key={tick.id}
                  className="p-2 rounded bg-purple-950/30 border border-purple-900/30 flex items-center justify-between hover:border-purple-500/40 transition-all animate-fadeIn"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px]">{tick.time}</span>
                    <span className="font-bold text-white">{tick.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                      tick.isLong ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                    }`}>
                      {tick.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-300">Size: <strong className="text-white">{tick.amount}</strong></span>
                    <span className="text-slate-300">Price: <strong className="text-white">{tick.price}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: SAIBOT92 AI Copilot Workspace */}
        <div className="lg:col-span-5 p-4 flex flex-col bg-[#080314] overflow-hidden">
          
          {/* Copilot Header */}
          <div className="pb-3 border-b border-purple-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <h4 className="text-sm font-bold text-white">SAIBOT92 AI Copilot</h4>
                <p className="text-[11px] text-purple-300">Real-Time Crypto Futures Intelligence</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-500/30 text-purple-300">
              AGENT v92.4
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 px-1 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-lg bg-purple-900/80 border border-purple-500/40 p-0.5 shrink-0">
                    <img src="/mascot_transparent.png" alt="SAIBOT92" className="w-full h-full object-contain" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl ${
                    m.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                      : 'bg-purple-950/60 border border-purple-500/30 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed">{m.text}</p>
                  <span className="block text-[10px] text-purple-300/70 text-right mt-1 font-mono">
                    {m.time}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-purple-300 text-xs font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>SAIBOT92 analyzing order book depth...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Query Shortcuts */}
          <div className="py-2 border-t border-purple-900/30 flex flex-wrap gap-1.5">
            {[
              'Liquidation Risk Analysis',
              'Funding Rate Shift',
              'Top Agent Signals',
            ].map((query, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(query)}
                className="px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-500/20 text-purple-300 hover:text-white hover:border-purple-400/50 text-[11px] transition-colors"
              >
                {query}
              </button>
            ))}
          </div>

          {/* Message Input */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask SAIBOT92 about order flow, OI or signals..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-slate-100 text-xs focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={() => handleSendMessage()}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
