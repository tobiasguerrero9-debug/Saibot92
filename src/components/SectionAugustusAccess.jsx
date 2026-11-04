import React from 'react';
import { LockKeyhole } from 'lucide-react';

const accessStatus = [
  ['holder_verification', 'PENDING'],
  ['token_access', 'INITIALIZING'],
  ['execution_layer', 'LOCKED'],
];

export default function SectionAugustusAccess() {
  return (
    <section id="augustus92" aria-labelledby="augustus92-title" className="bg-[#FAFAFC] py-16 sm:py-24 border-t border-[#D4D8E2]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[32px] border border-purple-500/30 shadow-[0_12px_32px_rgba(20,15,35,0.12)]" style={{ background: 'linear-gradient(135deg, #0F1015 0%, #15121D 70%, #10201F 100%)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5 sm:px-10 font-mono text-[10px] sm:text-xs font-bold tracking-widest">
            <span className="text-[#C084FC]">HOLDER GATED ACCESS</span>
            <span className="inline-flex items-center gap-2 text-[#2FE7CF]"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" /> AUGUSTUS92 // LOCKED</span>
          </div>

          <div className="grid lg:grid-cols-[1.15fr_1fr]">
            <div className="p-6 sm:p-10 lg:p-12">
              <p className="font-mono text-[10px] font-bold tracking-widest text-[#AEB5C3]">FUTURE MODULE / PERPETUAL MARKETS</p>
              <h2 id="augustus92-title" className="mt-4 font-mono text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-[#F8F8FC]">AUGUSTUS<span className="text-[#2FE7CF]">92</span></h2>
              <p className="mt-3 text-lg text-[#F8F8FC]">The agentic execution layer.</p>

              <div className="mt-7 space-y-4 text-sm sm:text-base leading-relaxed text-[#AEB5C3] max-w-xl">
                <p><span className="text-[#C084FC]">SAIBOT92 reads the market.</span><br />AUGUSTUS92 is being built to act on it.</p>
                <p>Access to AUGUSTUS92 will be reserved for SAIBOT92 token holders.</p>
                <p>The planned holder layer will unlock wallet-verified access to more agentic trading functionality, including future execution workflows built around perpetual markets.</p>
              </div>

              <dl className="mt-8 border-y border-white/10 py-2 font-mono text-[11px] sm:text-xs">
                {accessStatus.map(([label, status]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-2 py-3">
                    <dt className="text-[#AEB5C3]">{label}:</dt>
                    <dd className={status === 'LOCKED' ? 'text-[#2FE7CF] font-bold' : 'text-[#FBBF24]'}>{status}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7">
                <button type="button" disabled aria-describedby="augustus92-availability" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-mono text-xs font-bold tracking-wider text-[#9CA3AF] cursor-not-allowed">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4" /> UNLOCK WITH TOKEN
                </button>
                <p id="augustus92-availability" className="mt-3 text-xs text-[#AEB5C3]">Available after token launch. The token is not live; holder access and execution are not active.</p>
              </div>
            </div>

            <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-black/35">
              <div className="relative flex flex-1 items-center justify-center bg-black p-6 sm:p-8">
                <img src="/augustus92-mascot.png" alt="AUGUSTUS92 mint mascot" width="1254" height="1254" className="w-full max-w-[420px] h-auto object-contain" />
                <span className="absolute bottom-5 left-6 sm:left-8 inline-flex items-center gap-2 rounded-md border border-[#2FE7CF]/20 bg-[#0F1015]/90 px-3 py-2 font-mono text-[10px] text-[#2FE7CF]"><LockKeyhole aria-hidden="true" className="h-3 w-3" /> EXECUTION LAYER / LOCKED</span>
              </div>
              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <h3 className="font-mono text-[10px] font-bold tracking-widest text-[#C084FC]">LIVE NOW / SAIBOT92</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#AEB5C3]">Research · Market Scanner · Squeeze detection · What Changed · Futures analytics</p>
                </div>
                <div className="border-t border-white/10 pt-5">
                  <h3 className="font-mono text-[10px] font-bold tracking-widest text-[#2FE7CF]">COMING / AUGUSTUS92</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#AEB5C3]">Token holder verification · AUGUSTUS92 unlock · Agentic execution</p>
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-[#AEB5C3]">Hyperliquid execution integration planned.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
