import React, { useEffect, useState } from 'react';
const contextLabels = ['Agent State', 'Market Bias', 'Context Score', 'What Changed', 'Derived Order Flow', 'Open Interest', 'Funding', 'Liquidation Context', 'Squeeze State', 'Transition Pressure'];
// Review-only screen: deliberately has no wallet, signature, arming or order API.
export default function MainnetCanaryPage() {
  const [review, setReview] = useState(null);
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const update = async () => { try { const r = await fetch('/api/augustus-canary/snapshot', { signal: AbortSignal.timeout(12000) }); const data = await r.json(); if (!r.ok) throw Error(data.error || 'Read-only service unavailable'); if (active) { setSnapshot(data); setError(''); } } catch { if (active) { setSnapshot(null); setError('Mainnet/context service unavailable — entry disabled.'); } } };
    void update(); const timer = setInterval(update, 8000); return () => { active = false; clearInterval(timer); };
  }, []);
  async function preview(event) {
    event.preventDefault(); setReview(null); setLoading(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const input = { MAX_NOTIONAL_USD: Number(values.MAX_NOTIONAL_USD), MAX_LOSS_USD: Number(values.MAX_LOSS_USD), leverage: Number(values.LEVERAGE), notionalUsd: Number(values.NOTIONAL_USD), stopLoss: Number(values.STOP_LOSS), takeProfit: values.TAKE_PROFIT ? Number(values.TAKE_PROFIT) : null, maxLossUsd: Number(values.MAX_LOSS_USD_FOR_PROPOSAL), costReserveUsd: Number(values.COST_RESERVE_USD), slippageReserveUsd: Number(values.SLIPPAGE_RESERVE_USD), emergencySlippageBps: Number(values.EMERGENCY_SLIPPAGE_BPS) };
      const r = await fetch('/api/augustus-canary/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Augustus-Canary-CSRF': snapshot?.csrf || '' }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) }); const data = await r.json(); if (!r.ok) throw Error(data.error || 'Proposal rejected'); setReview(data); setError('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <main style={{ background: '#0f1015', color: '#eee', minHeight: '100vh', padding: '32px', fontFamily: 'monospace' }}>
    <h1>AUGUSTUS92 / MAINNET_CANARY</h1>
    <p>EXECUTION DISABLED — review only. Nothing on this screen signs or submits an order.</p>
    {error && <p role="alert">{error}</p>}
    {snapshot && <><p>Account mode: {snapshot.state.accountMode} · usable ETH collateral: {snapshot.state.availableMargin} USDC · margin mode: {snapshot.state.marginMode} · current ETH leverage: {snapshot.state.currentLeverage ?? 'UNKNOWN'}x · positions: {snapshot.state.positions.length} · orders: {snapshot.state.orders.length} · agent authorized: {String(snapshot.state.agentAuthorized)} · context: {snapshot.ready ? 'AVAILABLE' : snapshot.reason}</p><p>Authorization readiness: {snapshot.readiness?.authorizationReady ? 'READY FOR SEPARATE REVIEW' : 'BLOCKED'} {snapshot.readiness?.reasons?.join(' ')}</p></>}
    <section aria-live="polite"><h2>PROPOSAL ENGINE ONLY — {snapshot?.proposalEngine?.decision || 'NO TRADE'}</h2>
      <p>Evaluates every 5 seconds. Existing thresholds are unchanged. No approval or execution is enabled.</p>
      <ul>{(snapshot?.proposalEngine?.reasons || ['Waiting for live evaluation.']).map(reason => <li key={reason}>{reason}</li>)}</ul>
      {snapshot?.proposalEngine?.proposal && <pre>{JSON.stringify(snapshot.proposalEngine.proposal, null, 2)}</pre>}
    </section>
    <form onSubmit={preview}>
      <fieldset><legend>Required user risk limits — no preset financial values</legend>
        {['MAX_NOTIONAL_USD', 'MAX_LOSS_USD'].map(name => <p key={name}><label>{name} <input name={name} type="number" min="0.000001" step="any" required /></label></p>)}
      </fieldset>
      <p>SYMBOL: ETH-PERP · ORDER TYPE: IOC · one entry / one position</p>
      <p>Direction follows the existing eligibility rules; estimated entry uses live ETH metadata. Missing risk or stop configuration produces NO TRADE.</p>
      {['NOTIONAL_USD', 'LEVERAGE', 'STOP_LOSS', 'MAX_LOSS_USD_FOR_PROPOSAL', 'COST_RESERVE_USD', 'SLIPPAGE_RESERVE_USD', 'EMERGENCY_SLIPPAGE_BPS'].map(name => <p key={name}><label>{name} <input name={name} type="number" min={name === 'LEVERAGE' ? 1 : '0.000001'} max={name === 'LEVERAGE' ? 5 : undefined} step={name === 'LEVERAGE' ? 1 : 'any'} required /></label></p>)}
      <p><label>TAKE_PROFIT (optional) <input name="TAKE_PROFIT" type="number" min="0.000001" step="any" /></label></p>
      <button type="submit" disabled={loading || !snapshot}>SAVE PROPOSAL-ONLY RISK CONFIGURATION</button>
    </form>
    <section><h2>Current SAIBOT92 context — public USD-M research telemetry</h2><dl>{contextLabels.map((label, i) => <React.Fragment key={label}><dt>{label}</dt><dd>{JSON.stringify(snapshot?.context?.[['agentState','marketBias','contextScore','whatChanged','orderFlow','openInterest','funding','liquidationContext','squeezeState','transitionPressure'][i]]) ?? 'UNAVAILABLE'}</dd></React.Fragment>)}</dl></section>
    {review && <section aria-live="polite"><h2>Latest proposal-only configuration evaluation</h2><pre>{JSON.stringify(review, null, 2)}</pre>
      <p>Approval blocked: live execution disabled. Proposal expires with its market/context freshness window and must be revalidated before any future approval.</p>
      <button disabled>APPROVE EXACT TRADE — DISABLED</button>
    </section>}
    <p>STOP AUGUSTUS: new mainnet execution is already blocked in this build. No live session exists.</p>
  </main>;
}
