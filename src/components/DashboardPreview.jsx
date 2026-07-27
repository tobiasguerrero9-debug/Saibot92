import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ArrowUpRight } from 'lucide-react';
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

const liquidationData = [
  { time: '00:00', longs: 12.4, shorts: -8.2, cumulative: 4.2 },
  { time: '04:00', longs: 18.9, shorts: -6.1, cumulative: 10.6 },
  { time: '08:00', longs: 22.8, shorts: -9.8, cumulative: 9.5 },
  { time: '12:00', longs: 28.6, shorts: -18.7, cumulative: 21.5 },
  { time: '16:00', longs: 16.5, shorts: -8.9, cumulative: 13.5 },
  { time: '20:00', longs: 11.7, shorts: -21.3, cumulative: 12.8 },
];

export default function DashboardPreview({ onOpenMiniApp }) {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <section id="mini-app" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Editorial Dashboard Container */}
      <div className="rounded-[32px] sm:rounded-[40px] bg-[#0b0517] border border-purple-500/25 p-8 sm:p-14 shadow-[0_20px_80px_rgba(6,2,13,0.8)]">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column Supporting Copy */}
          <div className="lg:col-span-4 space-y-6 text-left">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
              ● LIVE DASHBOARD PREVIEW
            </span>

            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              See the market <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300">
                with clarity.
              </span>
            </h2>

            <p className="text-base text-slate-300 font-normal leading-relaxed">
              Clean visuals. Critical data. Actionable insights.
            </p>

            <div className="pt-2">
              <button 
                onClick={onOpenMiniApp}
                className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 font-semibold text-base group transition-colors"
              >
                <span>Explore Dashboard</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Column Dashboard Mockup Panel */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-[#070310] border border-purple-900/40 p-6 space-y-6">
              
              {/* Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-purple-900/30">
                <div className="flex items-center space-x-2 bg-purple-950/60 p-1 rounded-xl border border-purple-500/20">
                  {['Overview', 'Markets', 'Signals', 'Alerts'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                        activeTab === tab
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-purple-950/40 border border-purple-500/20 text-xs font-mono text-slate-300">
                    24h
                  </span>
                  <button 
                    onClick={onOpenMiniApp}
                    className="p-1.5 rounded-lg bg-purple-900/40 text-purple-300 hover:text-white"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chart View */}
              {activeTab === 'Overview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Liquidations (24h)
                    </h3>
                    <div className="flex items-center space-x-4 text-xs font-medium font-mono">
                      <span className="text-emerald-400">● Longs</span>
                      <span className="text-rose-400">● Shorts</span>
                      <span className="text-purple-300">― Cumulative</span>
                    </div>
                  </div>

                  <div className="h-[260px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={liquidationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" vertical={false} />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `$${Math.abs(val)}M`} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f0721', borderColor: 'rgba(139, 92, 246, 0.3)', borderRadius: '12px' }} />
                        <Bar dataKey="longs" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} />
                        <Bar dataKey="shorts" fill="#f43f5e" radius={[0, 0, 3, 3]} barSize={10} />
                        <Line type="monotone" dataKey="cumulative" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab !== 'Overview' && (
                <div className="py-12 text-center text-slate-400 text-xs font-mono space-y-3">
                  <p>Real-time telemetry loaded for {activeTab}.</p>
                  <button onClick={onOpenMiniApp} className="px-4 py-2 rounded-lg bg-purple-900/60 text-purple-200 text-xs font-semibold">
                    Launch Full Mini App Workspace →
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
