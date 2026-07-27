import React, { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';

export default function Pricing({ onLaunchApp }) {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Essential market telemetry view for retail traders.',
      features: [
        'Basic market dashboard',
        'Delayed insights (5 min)',
        'Limited signal access',
        'Standard liquidation chart',
      ],
      cta: 'Get Started Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      priceMonthly: 79,
      priceAnnual: 63,
      description: 'Full agentic intelligence layer for active futures traders.',
      features: [
        'Real-time sub-second dashboard',
        'AI market analysis & signal streams',
        'Advanced OI & liquidation heatmaps',
        'Priority agent signal alerts',
        'Multi-exchange order flow delta',
      ],
      cta: 'Start Pro Free Trial',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      priceMonthly: 249,
      priceAnnual: 199,
      description: 'Dedicated infrastructure for quant funds & trading desks.',
      features: [
        'Everything in Pro plan',
        'Custom AI agent pipeline tuning',
        'Full REST & WebSocket API access',
        'Unlimited custom rules & webhooks',
        'Dedicated quant strategist support',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
          PRICING TIERS
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Elevate Your Market Vision
        </h2>
        <p className="text-base text-slate-300">
          Choose the intelligence plan tailored to your trading volume and complexity.
        </p>

        {/* Toggle */}
        <div className="pt-4 flex items-center justify-center space-x-3">
          <span className={`text-xs font-semibold ${!annual ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-12 h-6 rounded-full bg-purple-950 border border-purple-500/40 p-1 transition-colors"
          >
            <div className={`w-4 h-4 rounded-full bg-purple-400 shadow-md transition-transform ${annual ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-semibold ${annual ? 'text-white' : 'text-slate-400'}`}>Annual (Save 20%)</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier, idx) => {
          const price = annual ? tier.priceAnnual : tier.priceMonthly;
          return (
            <div
              key={idx}
              className={`rounded-[32px] p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-[#120728] border-2 border-purple-400/60 shadow-[0_0_50px_rgba(124,58,237,0.3)] scale-[1.02]'
                  : 'bg-[#0a0415] border border-purple-500/20'
              }`}
            >
              <div className="space-y-6">
                {tier.badge && (
                  <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">
                    {tier.badge}
                  </span>
                )}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{tier.name}</h3>
                  <p className="text-xs text-slate-400">{tier.description}</p>
                </div>

                <div className="flex items-baseline space-x-1 font-mono">
                  <span className="text-4xl font-extrabold text-white">${price}</span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>

                <div className="pt-4 border-t border-purple-900/30 space-y-3">
                  {tier.features.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={onLaunchApp}
                  className={`w-full py-3.5 rounded-full font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                    tier.highlighted
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)]'
                      : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-500/30'
                  }`}
                >
                  <span>{tier.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
