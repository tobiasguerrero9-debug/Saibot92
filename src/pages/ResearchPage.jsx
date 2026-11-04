import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const sections = [
  { label: 'ORIGIN', title: 'Historical Data Before Prediction', paragraphs: [
    'SAIBOT92 began as an attempt to study market behavior through historical data rather than isolated price predictions.',
    'The initial objective was simple: observe how futures markets behave under different combinations of price expansion, participation, leverage and positioning.',
    'Historical observations became a reference layer for understanding what tends to change before, during and after periods of market stress.',
    'The system was not built around predicting a specific candle. It was built around understanding market context.'
  ] },
  { label: 'ORDER FLOW', title: 'From Price to Participation', paragraphs: [
    'Price alone describes where the market moved. Order flow helps describe how participants were interacting while that movement occurred.',
    'SAIBOT92 progressively expanded its research toward aggressive market activity, open interest, funding, volume behavior, liquidation pressure and short-term changes in participation.',
    'The objective is not to interpret one metric in isolation. The system looks for relationships between multiple observable variables and how those relationships evolve through time.'
  ], note: 'MEASUREMENT NOTE // The current web app estimates buy/sell participation from candle direction. These derived proxies are distinct from directly measured taker-side order flow.' },
  { label: 'MARKET STATES', title: 'Markets as Changing States', paragraphs: [
    'Instead of treating every movement as an independent event, SAIBOT92 models the market as a sequence of changing conditions.',
    'Examples include:'
  ], items: ['absorption', 'directional expansion', 'compression', 'leverage imbalance', 'liquidation cascades', 'squeeze environments', 'low-participation regimes', 'transition states'], after: 'These classifications are deterministic interpretations derived from observable market telemetry. They describe market conditions through explicit rules; they are not machine-learning predictions.' },
  { label: 'WHAT CHANGED', title: 'Temporal Context', paragraphs: [
    'A market snapshot is useful. A change in market state is often more useful.',
    'What Changed was developed to compare the current environment with recent observations and identify shifts in variables such as participation, open interest, price response and aggressive activity.',
    'This creates a short-term memory layer around the market instead of evaluating every observation in isolation.'
  ], note: 'TEMPORAL MEMORY // Current observations are held in session memory. The comparison window depends on available samples and is shown in the interface; it is not a persistent historical database.' },
  { label: 'COPILOT', title: 'A Market Intelligence Copilot', paragraphs: [
    'SAIBOT92 is not designed to issue simplistic instructions such as “buy here” or “sell here.”',
    'Its purpose is to help traders structure decisions before entering a position and while managing one.',
    'The system acts as a research and interpretation layer between raw exchange telemetry and human decision-making.',
    'It provides context. The trader retains control.'
  ] },
  { label: 'AGENTIC DIRECTION', title: 'Toward an Agentic Order-Flow Layer', paragraphs: [
    'The next stage of SAIBOT92 is not simply adding more indicators. The objective is to build a more stateful market intelligence layer.',
    'An agentic system should be able to:'
  ], capabilities: [['OBSERVE', 'current market telemetry'], ['COMPARE', 'the present state with recent history'], ['DETECT', 'meaningful changes in participation and positioning'], ['INTERPRET', 'those changes within the broader market context'], ['REMEMBER', 'previous market states'], ['REACT', 'when the environment materially changes']], after: 'The long-term direction is an order-flow intelligence layer that continuously maintains context rather than repeatedly analyzing isolated snapshots.', note: 'RESEARCH DIRECTION // These capabilities describe the intended evolution, not a claim of completed autonomous behavior. The current product uses deterministic rules and short-term session memory, without AI inference or autonomous trade execution.' },
  { label: 'PRINCIPLE', title: 'Evidence Over Speculation', paragraphs: [
    'SAIBOT92 is built around a simple principle: market interpretation should begin with measurable evidence.',
    'Order flow, open interest, funding, liquidations, volume and price response are not predictions by themselves. They are pieces of evidence.',
    'SAIBOT92 exists to organize those pieces into a more coherent view of market behavior.'
  ] }
];

const layers = [
  ['REAL MARKET DATA', 'Public Binance prices, OHLCV, open interest, funding and received liquidation events.'],
  ['DERIVED METRICS', 'Calculated USD values, candle-direction participation proxies and relationships between inputs.'],
  ['DETERMINISTIC CLASSIFICATION', 'Explicit rules translate telemetry into market-state labels and contextual scenarios.'],
  ['TEMPORAL MEMORY', 'Recent session observations support comparisons over the available sample window.'],
  ['FUTURE AGENTIC CAPABILITIES', 'A research direction toward sustained context, rather than a completed autonomous system.']
];

export default function ResearchPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div className="min-h-screen bg-[#FAFAFC] text-[#12141A] font-sans selection:bg-[#7C3AED] selection:text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <div className="max-w-3xl mb-10 sm:mb-14">
          <Link to="/" className="font-mono text-xs font-bold text-[#7C3AED] hover:underline">← BACK TO HOME</Link>
          <p className="mt-8 font-mono text-xs font-bold tracking-widest text-[#7C3AED]">SAIBOT92 / RESEARCH NOTES</p>
          <h1 className="mt-4 text-4xl sm:text-6xl font-mono font-black tracking-tight">RESEARCH PROTOCOL</h1>
          <p className="mt-5 text-lg sm:text-xl leading-relaxed text-[#5E6675]">From historical data to agentic order-flow intelligence.</p>
          <p className="mt-5 text-sm leading-relaxed text-[#5E6675]">The research origin, current interpretation framework and future direction of SAIBOT92.</p>
        </div>
        <aside aria-label="Evidence framework" className="mb-8 rounded-2xl border border-[#D4D8E2] bg-white p-6 sm:p-8">
          <h2 className="font-mono text-xs font-bold tracking-widest text-[#7C3AED]">READING THE SYSTEM / EVIDENCE FRAMEWORK</h2>
          <dl className="mt-5 divide-y divide-[#E4E6EC]">
            {layers.map(([label, text]) => <div key={label} className="py-4 first:pt-0 last:pb-0 grid sm:grid-cols-[220px_1fr] gap-2 sm:gap-6"><dt className="font-mono text-xs font-bold text-[#12141A]">{label}</dt><dd className="text-sm leading-relaxed text-[#5E6675]">{text}</dd></div>)}
          </dl>
        </aside>
        <div className="space-y-6">
          {sections.map((section, index) => (
            <section key={section.label} aria-labelledby={`research-${index}`} className="rounded-2xl border border-purple-500/30 p-6 sm:p-10 text-[#F8F8FC]" style={{ background: 'linear-gradient(135deg, #0F1015 0%, #15121D 55%, #1A1424 100%)' }}>
              <div className="flex items-center gap-3 border-b border-white/10 pb-5 font-mono text-xs font-bold tracking-widest">
                <span className="text-[#C084FC]">{String(index + 1).padStart(2, '0')}</span><span className="text-[#22D3EE]">{section.label}</span>
                {section.capabilities && <span className="ml-auto text-[10px] text-[#FBBF24]">FUTURE DIRECTION</span>}
              </div>
              <h2 id={`research-${index}`} className="mt-6 mb-5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight">{section.title}</h2>
              <div className="max-w-3xl space-y-4 text-sm sm:text-base leading-relaxed text-[#AEB5C3]">
                {section.paragraphs.map(text => <p key={text}>{text}</p>)}
                {section.items && <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 list-disc pl-5 marker:text-[#C084FC]">{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
                {section.capabilities && <dl className="grid sm:grid-cols-2 gap-3 py-2">{section.capabilities.map(([label, text]) => <div key={label} className="border border-white/10 rounded-lg p-4"><dt className="font-mono text-xs font-bold text-[#C084FC]">{label}</dt><dd className="mt-2 text-sm">{text}</dd></div>)}</dl>}
                {section.after && <p>{section.after}</p>}
              </div>
              {section.note && <p className="mt-6 border-l-2 border-[#FBBF24]/60 pl-4 font-mono text-xs leading-relaxed text-[#AEB5C3]">{section.note}</p>}
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-[#D4D8E2] pt-6">
          <p className="text-xs font-mono text-[#5E6675]">MEASURABLE INPUTS. EXPLICIT RULES. HUMAN DECISIONS.</p>
          <Link to="/app" className="rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] px-5 py-3 text-white font-mono text-xs font-bold">OPEN LIVE TERMINAL ↗</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
