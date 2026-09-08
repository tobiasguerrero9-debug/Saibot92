import React from 'react';
import { Activity, Layers, ShieldAlert, Zap } from 'lucide-react';

const valueItems = [
  {
    icon: Activity,
    title: 'TAKER FLOW VELOCITY',
    value: 'Aggressive Taker Buy/Sell imbalance tracked sub-second.',
    accent: 'text-[#6D28D9]'
  },
  {
    icon: Layers,
    title: 'OPEN INTEREST DRIFT',
    value: 'Detecting fresh leverage entry & liquidation cliffs.',
    accent: 'text-[#0891B2]'
  },
  {
    icon: ShieldAlert,
    title: 'LIQUIDATION CASCADES',
    value: 'Real-time monitoring of forced stop-run liquidations.',
    accent: 'text-[#C58A00]'
  },
  {
    icon: Zap,
    title: 'DETERMINISTIC SCENARIOS',
    value: 'Rule-based agent synthesis without black-box ML delay.',
    accent: 'text-[#10B981]'
  }
];

export default function ProductValueStrip() {
  return (
    <div className="w-full bg-gradient-to-b from-white to-[#F7F8FB] border-y border-[#D4D8E2] py-7 font-mono shadow-[0_4px_18px_rgba(20,24,40,0.04)]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-[#D4D8E2]">
          {valueItems.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div key={idx} className="lg:px-6 first:pl-0 last:pr-0 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#10131A]">
                  <IconComponent className={`w-4 h-4 ${item.accent}`} />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-[#4E5666] leading-relaxed">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
