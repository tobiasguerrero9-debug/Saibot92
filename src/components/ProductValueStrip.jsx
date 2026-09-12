import React from 'react';
import { Activity, Layers, ShieldAlert, Zap } from 'lucide-react';

const valueItems = [
  {
    icon: Activity,
    title: 'TAKER FLOW VELOCITY',
    value: 'Aggressive Taker Buy/Sell imbalance tracked sub-second.',
    accentColor: '#C084FC',
  },
  {
    icon: Layers,
    title: 'OPEN INTEREST DRIFT',
    value: 'Detecting fresh leverage entry & liquidation cliffs.',
    accentColor: '#22D3EE',
  },
  {
    icon: ShieldAlert,
    title: 'LIQUIDATION CASCADES',
    value: 'Real-time monitoring of forced stop-run liquidations.',
    accentColor: '#FBBF24',
  },
  {
    icon: Zap,
    title: 'DETERMINISTIC SCENARIOS',
    value: 'Rule-based agent synthesis without black-box ML delay.',
    accentColor: '#34D399',
  },
];

export default function ProductValueStrip() {
  return (
    <section className="bg-[#FAFAFC] py-8 border-b border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div 
          className="w-full rounded-2xl p-5 sm:p-6 font-mono"
          style={{
            background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)',
            border: '1px solid rgba(139, 92, 246, 0.30)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(20, 15, 35, 0.10)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-white/10">
            {valueItems.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div key={idx} className="lg:px-6 first:pl-0 last:pr-0 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider">
                    <IconComponent className="w-4 h-4 shrink-0" style={{ color: item.accentColor }} />
                    <span style={{ color: item.accentColor }}>{item.title}</span>
                  </div>
                  <p className="text-xs text-[#AEB5C3] leading-relaxed font-sans">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
