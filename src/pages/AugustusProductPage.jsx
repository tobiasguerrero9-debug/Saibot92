import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './augustus-product.css';
import { nextOnboardingStep } from '../augustus/state/onboarding.js';

const contextRows = [['Agent State', 'agentState'], ['Market Bias', 'marketBias'], ['Context Score', 'contextScore'], ['What Changed', 'whatChanged'], ['Derived Order Flow', 'orderFlow'], ['Open Interest', 'openInterest'], ['Funding', 'funding'], ['Liquidations', 'liquidationContext'], ['Squeeze State', 'squeezeState'], ['Transition Pressure', 'transitionPressure']];
const money = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const short = address => address ? address.slice(0, 6) + '…' + address.slice(-4) : 'Not connected';
function contextValue(key, value) {
  if (value == null) return 'Unavailable';
  if (key === 'openInterest') return '$' + money(value);
  if (key === 'funding') return (Number(value) * 100).toFixed(5) + '%';
  if (key === 'whatChanged') return value.hasHistory ? `${value.windowLabel} · OI ${value.oiDeltaPct} · ${value.priceResponse}` : 'Collecting real observations';
  if (key === 'orderFlow') return `${value.orderFlowPressure} · ${value.buyRatioPct} derived buy share`;
  if (key === 'liquidationContext') return value.status === 'OBSERVING' ? `Observing · ${value.events?.length ?? 0} events` : 'Unavailable';
  return String(value);
}
export default function AugustusProductPage() {
  const [snapshot, setSnapshot] = useState(null), [status, setStatus] = useState(null), [wallet, setWallet] = useState(null), [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [now, setNow] = useState(Date.now()), [killPrompt, setKillPrompt] = useState(false);
  const signedIn = useRef(false), provider = useRef(null), csrf = useRef(null), active = useRef(true), walletEpoch = useRef(0);
  const dialog = useRef(null);
  const serverClock = useRef(null);
  useEffect(() => { if (!killPrompt) return; const previous = document.activeElement; dialog.current?.querySelector('button')?.focus(); return () => previous?.focus?.(); }, [killPrompt]);
  async function request(path, body) {
    const r = await fetch('/api/augustus-product' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json', 'X-Augustus-Canary-CSRF': csrf.current || '' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    const data = await r.json(); if (!r.ok) { const error = Error(data.error || 'Augustus is temporarily unavailable.'); error.status = r.status; throw error; } return data;
  }
  async function refresh() {
    const epoch = walletEpoch.current;
    const r = await fetch('/api/augustus-product/bootstrap', { signal: AbortSignal.timeout(15000) }); const data = await r.json(); if (!r.ok) throw Error('Live market connection unavailable.');
    if (!active.current) return;
    if (Number.isFinite(data.serverTime)) { serverClock.current = { time: data.serverTime, received: performance.now() }; setNow(data.serverTime); }
    setSnapshot(data); csrf.current = data.csrf;
    try {
      const session = await request('/status');
      const accounts = await (provider.current || window.ethereum)?.request({ method: 'eth_accounts' });
      if (accounts?.[0]?.toLowerCase() !== session.account.master.toLowerCase()) { await disconnect(); throw Error('Wallet changed. Reconnect your Augustus account.'); }
      if (active.current && epoch === walletEpoch.current) { signedIn.current = true; setWallet(session.account.master); setStatus(session); setStep(previous => previous === 1 || (previous === 3 && session.account?.agentAuthorized) ? nextOnboardingStep(session) : previous); }
    } catch (error) { if (error.status === 401) { signedIn.current = false; setWallet(null); setStatus(null); } else throw error; }
  }
  async function action(path, body = {}) {
    setBusy(true); setError(''); try { const data = await request(path, body); setStatus(data); return data; } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }
  async function disconnect() {
    walletEpoch.current += 1;
    signedIn.current = false; setWallet(null); setStatus(null); setStep(1);
    try { await request('/disconnect', {}); } catch { setError('Server disconnect could not be confirmed. Execution remains disabled.'); }
  }
  useEffect(() => {
    active.current = true; let running = false;
    const poll = async () => { if (running) return; running = true; try { await refresh(); } catch { if (active.current) { setSnapshot(null); setStatus(null); setError('Live connection unavailable. Approval is blocked until data is restored.'); } } finally { running = false; } };
    void poll(); const timer = setInterval(poll, 5000), clock = setInterval(() => setNow(serverClock.current ? serverClock.current.time + performance.now() - serverClock.current.received : Date.now()), 1000);
    return () => { active.current = false; clearInterval(timer); clearInterval(clock); };
  }, []);
  useEffect(() => {
    const p = window.ethereum?.providers?.find(x => x.isMetaMask) || window.ethereum;
    provider.current = p;
    const changed = () => { void disconnect(); };
    p?.on?.('accountsChanged', changed); p?.on?.('disconnect', changed);
    return () => { p?.removeListener?.('accountsChanged', changed); p?.removeListener?.('disconnect', changed); };
  }, []);
  async function connect() {
    setBusy(true); setError('');
    try {
      await refresh(); const p = provider.current || window.ethereum;
      if (!p) throw Error('Open this page in a browser with a wallet extension.');
      const accounts = await p.request({ method: 'eth_requestAccounts' });
      const r = await fetch('/api/augustus-product/bootstrap'); const live = await r.json(); csrf.current = live.csrf;
      const challenge = await request('/challenge', { address: accounts[0] });
      const hex = '0x' + [...new TextEncoder().encode(challenge.message)].map(b => b.toString(16).padStart(2, '0')).join('');
      const signature = await p.request({ method: 'personal_sign', params: [hex, accounts[0]] });
      const current = await p.request({ method: 'eth_accounts' });
      if (current?.[0]?.toLowerCase() !== accounts[0]?.toLowerCase()) throw Error('Wallet changed during sign-in. Reconnect to continue.');
      const session = await request('/session', { address: accounts[0], ...challenge, signature }); signedIn.current = true; setWallet(session.address);
      const s = await request('/status'); setStatus(s); setStep(nextOnboardingStep(s));
    } catch (e) { setError(e.code === 4001 ? 'Wallet sign-in declined. Nothing was authorized.' : String(e.message).split('\n')[0]); } finally { setBusy(false); }
  }
  async function configure(event) {
    event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget));
    const s = await action('/risk', { maxNotionalUsd: Number(f.notional), maxLeverage: Number(f.leverage), maxLossUsd: Number(f.loss), direction: f.direction, sessionMinutes: Number(f.duration) }); if (s) setStep(nextOnboardingStep(s));
  }
  const account = status?.account || snapshot?.state, context = status?.context || snapshot?.context;
  const readiness = status?.readiness || snapshot?.readiness;
  const candidate = status?.proposal, proposalExpired = candidate && now >= candidate.expiresAt;
  const fresh = context && now >= context.timestamp && now - context.timestamp < 10000;
  const state = proposalExpired ? 'SETUP EXPIRED' : status?.state || 'PUBLIC MONITORING';
  const p = candidate && !proposalExpired && fresh ? candidate : null, position = status?.position;
  const rows = p ? [['Side', p.side], ['Entry', '$' + money(p.estimatedEntry)], ['Notional', '$' + money(p.notionalUsd)], ['Leverage', p.leverage + '× CROSS'], ['Margin required', '$' + money(p.estimatedMarginRequiredUsd)], ['Protective stop', '$' + money(p.stopLoss)], ['Take profit', p.takeProfit == null ? 'Not required by this setup' : '$' + money(p.takeProfit)], ['Estimated loss at stop', '$' + money(p.estimatedMaximumLossUsd)], ['Risk / reward', p.riskReward == null ? 'No target defined' : p.riskReward.toFixed(2)], ['Context score', p.context.contextScore], ['Proposal ID', p.proposalId], ['Size · ETH', p.size], ['Usable collateral', '$' + money(account?.availableMargin)], ['Execution gate', status?.executionEnabled ? 'ENABLED' : 'DISABLED'], ['Position protection service', status?.executionGate?.protectionWorker ? 'HEALTHY' : 'UNAVAILABLE'], ['Emergency close', status?.executionGate?.emergencyCloseReady ? 'READY' : 'UNAVAILABLE']] : [];
  return <div className="aug-product">
    <header className="ap-header"><Link to="/" className="ap-brand">SAIBOT<span>92</span></Link><span className="ap-market">ETH-PERP <i /> MAINNET</span><button className="ap-kill" disabled={!wallet || busy} onClick={() => setKillPrompt(true)}>KILL AUGUSTUS</button></header>
    <main>
      <div className="ap-intro"><div><p className="ap-eyebrow">AGENTIC EXECUTION LAYER</p><h1>AUGUSTUS<span>92</span></h1><p className="ap-subtitle">Watch the context. Review the setup. Keep control.</p></div><div className="ap-connection"><span className={fresh ? 'ap-live' : ''}>{fresh ? '● LIVE CONTEXT' : '○ WAITING FOR CONTEXT'}</span><button onClick={wallet ? disconnect : connect} disabled={busy || !snapshot}>{wallet ? short(wallet) + ' · disconnect' : 'CONNECT WALLET'}</button></div></div>
      <div className="ap-state" aria-live="polite"><div><span>AGENT STATUS</span><strong>{state}</strong></div><div><span>EXECUTION</span><strong className="ap-amber">{status?.executionMode || 'MONITORING'}{!status?.executionEnabled && ' · LIVE DISABLED'}</strong></div></div>
      <p className="ap-risk-note">Augustus can execute trades after your approval. Trading involves risk and protective stops may experience slippage. <strong>{status?.executionEnabled ? 'Live execution requires your exact proposal approval.' : 'Live execution is disabled.'}</strong></p>
      {error && <p className="ap-error" role="alert">{error}</p>}
      {!wallet && <section className="ap-watching" aria-label="Public monitoring"><p className="ap-eyebrow">PUBLIC MONITORING</p><h2>{fresh ? snapshot?.monitoring?.setup || 'NO SETUP' : 'NO SETUP'}</h2><p>{fresh ? snapshot?.monitoring?.reason : 'Waiting for fresh live ETH context.'}</p><p className="ap-muted">No account-specific proposal is available in public monitoring. Connect your wallet to configure risk and monitor your own proposals.</p><button onClick={connect} disabled={busy || !snapshot}>CONNECT WALLET TO CONFIGURE AUGUSTUS</button></section>}
      {status?.execution?.incident && <p className="ap-error" role="alert">Augustus requires attention. {status.execution.phase === 'CLOSED' ? 'The position is confirmed closed; the incident remains in the audit log.' : status.execution.incident === 'ENTRY_ABORTED' ? 'Entry was aborted. No new entry will be retried automatically.' : status.execution.incident === 'OWNERSHIP_UNCERTAIN' ? 'Position ownership changed. Automatic actions are blocked; check the account on Hyperliquid.' : 'Protection or closing could not be confirmed. New entries are blocked. Reconciliation continues; check the position on Hyperliquid.'}</p>}
      {wallet && !status?.armed && !position && !status?.killed && <section className="ap-onboarding" aria-label="Augustus onboarding">
        <nav className="ap-steps" aria-label="Setup steps">{['Connect', 'Configure risk', 'Authorize', 'Arm Augustus'].map((label, i) => <button key={label} disabled={!wallet && i > 0} aria-current={step === i + 1 ? 'step' : undefined} onClick={() => setStep(i + 1)}><span>0{i + 1}</span> {label}</button>)}</nav>
        <div className="ap-step-body">
          {step === 1 && <><h2>Your dedicated wallet. Your control.</h2><p>Connect to verify your account, available collateral, leverage and Augustus authorization. Sign-in verifies identity only.</p><button onClick={connect} disabled={busy || !snapshot}>CONNECT WALLET</button><p className="ap-muted">Your wallet uses its own isolated Augustus agent and risk limits.</p></>}
          {step === 2 && <form onSubmit={configure}><h2>Define the boundaries.</h2><div className="ap-fields"><label>Maximum position · USD<input name="notional" type="number" min="10" step="any" required defaultValue={status?.risk?.maxNotionalUsd} /></label><label>Maximum leverage<select name="leverage" required defaultValue={status?.risk?.maxLeverage || ''}><option value="" disabled>Select limit</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><label>Maximum acceptable loss · USD<input name="loss" type="number" min="0.000001" step="any" required defaultValue={status?.risk?.maxLossUsd} /></label><label>Allowed direction<select name="direction" defaultValue={status?.risk?.direction || 'BOTH'}><option value="BOTH">Long & short</option><option value="LONG">Long only</option><option value="SHORT">Short only</option></select></label><label>Session duration<select name="duration" defaultValue={status?.risk?.sessionMinutes || 60}><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">120 minutes</option></select></label></div><p className="ap-muted">ETH only · one entry · one position · mandatory stop. Stops are derived from your loss limit after cost reserves; they cannot guarantee the loss amount.</p><button disabled={busy}>SAVE RISK LIMITS</button></form>}
          {step === 3 && <><h2>{account?.agentAuthorized ? 'Augustus authorization verified.' : 'Authorize your Augustus agent.'}</h2><p>{account?.agentAuthorized ? 'Your dedicated agent is linked to this master account. No additional authorization is needed.' : 'Use Hyperliquid’s official authorization screen to approve your dedicated agent, then return here to verify it.'}</p><p className="ap-address">Your agent: {status?.userAgent?.address || account?.agent}</p>{!account?.agentAuthorized && <><a className="ap-button" href="https://app.hyperliquid.xyz/API" target="_blank" rel="noopener noreferrer">AUTHORIZE AUGUSTUS ↗</a></>}<div className="ap-actions"><button disabled={busy} onClick={async () => { await refresh(); }}>VERIFY AUTHORIZATION</button><button disabled={!account?.agentAuthorized || !status?.risk} onClick={() => setStep(4)}>CONTINUE</button></div></>}
          {step === 4 && <><h2>Ready to watch ETH?</h2><p>Arming starts setup detection and proposal monitoring. It does not submit a trade.</p><dl className="ap-metrics"><div><dt>Position limit</dt><dd>${money(status?.risk?.maxNotionalUsd)}</dd></div><div><dt>Loss limit</dt><dd>${money(status?.risk?.maxLossUsd)}</dd></div><div><dt>Leverage cap</dt><dd>{status?.risk?.maxLeverage ?? '—'}×</dd></div><div><dt>Direction</dt><dd>{status?.risk?.direction || '—'}</dd></div></dl><button disabled={busy || !status?.risk || !account?.agentAuthorized || !readiness?.authorizationReady || !fresh} onClick={() => action('/arm')}>ARM AUGUSTUS</button>{readiness?.reasons?.length > 0 && <p className="ap-muted">{readiness?.reasons?.join(' ')}</p>}</>}
        </div>
      </section>}
      {status?.killed && <section className="ap-stopped"><h2>AUGUSTUS STOPPED</h2><p>New setups and entries are blocked. Existing position protection is preserved. Owned pending entries are cancelled by the protection worker. Closing requires a separate confirmation.</p><button disabled={busy || status.entries > 0} onClick={async () => { const s = await action('/reset'); if (s) setStep(4); }}>RESET MONITORING SESSION</button></section>}
      {status?.armed && !p && <section className="ap-watching"><div className="ap-pulse" aria-hidden="true" /><p className="ap-eyebrow">AUGUSTUS IS WATCHING ETH</p><h2>{proposalExpired ? 'SETUP EXPIRED' : 'NO VALID SETUP'}</h2><ul>{status.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p className="ap-muted">No forced entries. Waiting for the strategy and risk checks to agree.</p></section>}
      {p && <section className="ap-proposal"><p className="ap-eyebrow">SETUP DETECTED · REVIEW REQUIRED</p><h2>{p.side} ETH-PERP <small>IOC</small></h2><dl className="ap-metrics">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{p.whyEligible}</p><p className="ap-muted">Context: {new Date(p.contextTimestamp).toLocaleTimeString()} · expires in {Math.max(0, Math.ceil((p.expiresAt - now) / 1000))}s</p><div className="ap-actions"><button disabled={!status.canApprove || busy || !fresh} onClick={() => action('/execute', { proposalId: p.proposalId, bindingHash: p.bindingHash, approved: true })}>APPROVE &amp; EXECUTE</button><button className="ap-secondary" disabled={busy} onClick={() => action('/reject', { proposalId: p.proposalId })}>REJECT</button></div><p className="ap-muted">Approval applies only to this exact proposal. Execution requires every server-side gate to pass.</p></section>}
      {position && <section className="ap-position"><p className="ap-eyebrow">{status.protectionActive ? 'PROTECTION ACTIVE' : 'PROTECTION NOT VERIFIED'}</p><h2>POSITION LIVE · ETH-PERP</h2><dl className="ap-metrics">{[['Side', Number(position.szi) > 0 ? 'LONG' : 'SHORT'], ['Entry', '$' + money(position.entryPx)], ['Current price', '$' + money(account.market.markPx)], ['Size · ETH', Math.abs(Number(position.szi))], ['Leverage', position.leverage?.value + '×'], ['Unrealized PnL', '$' + money(position.unrealizedPnl)], ['Stop', status.positionProtection?.stop ? '$' + money(status.positionProtection.stop) : 'Verify on exchange'], ['Take profit', status.positionProtection?.takeProfit ? '$' + money(status.positionProtection.takeProfit) : 'Not configured / verify on exchange'], ['Configured loss limit', '$' + money(status.risk?.maxLossUsd)], ['Time in position', status.positionProtection?.openedAt ? Math.max(0, Math.floor((now - status.positionProtection.openedAt) / 60000)) + 'm' : 'Unavailable without verified opening fill']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{status.externalPosition && <p className="ap-error">Existing exposure detected. Augustus will not open another position or claim ownership of this position.</p>}<button disabled={!status.canClose || busy} onClick={() => { if (window.confirm("Close this Augustus-managed ETH position using a reduce-only order?")) void action("/close", { executionId: status.execution.executionId, confirmed: true }); }}>CLOSE POSITION — REDUCE ONLY</button></section>}
      <section className="ap-telemetry"><p className="ap-muted">ETH price · ${money(account?.market?.markPx)}</p><div className="ap-section-title"><h2>LIVE CONTEXT</h2><span>{fresh ? new Date(context.timestamp).toLocaleTimeString() : 'WAITING FOR FRESH DATA'}</span></div><dl>{contextRows.map(([label,key]) => <div key={key}><dt>{label}</dt><dd>{contextValue(key, context?.[key])}</dd></div>)}</dl><p className="ap-muted">Public USD-M research telemetry. Derived order flow is a candle-direction proxy. Execution pricing comes from Hyperliquid.</p></section>
      {wallet && <dl className="ap-account-strip"><div><dt>ETH price</dt><dd>${money(account?.market?.markPx)}</dd></div><div><dt>Usable collateral</dt><dd>${money(account?.availableMargin)}</dd></div><div><dt>Account mode</dt><dd>{account?.accountMode === 'unifiedAccount' ? 'Unified' : account?.accountMode || '—'}</dd></div><div><dt>ETH leverage</dt><dd>{account?.currentLeverage ?? '—'}× {account?.marginMode?.toUpperCase()}</dd></div><div><dt>Authorization</dt><dd>{account?.agentAuthorized ? 'VERIFIED' : 'NOT VERIFIED'}</dd></div></dl>}
      <footer><span>AUGUSTUS92 · CONTROLLED ETH SESSION</span>{import.meta.env.DEV && <Link to="/augustus92/canary">Developer diagnostics ↗</Link>}</footer>
    </main>
    {killPrompt && <div className="ap-dialog-backdrop"><section ref={dialog} className="ap-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kill-title" onKeyDown={event => { if (event.key === 'Escape') setKillPrompt(false); if (event.key === 'Tab') { const buttons = dialog.current.querySelectorAll('button'); if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); } else if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); } } }}><h2 id="kill-title">Stop Augustus?</h2><p>This stops proposal monitoring and blocks new entries. It does not close an existing position. Any future close requires a separate explicit confirmation.</p><div className="ap-actions"><button className="ap-kill" onClick={async () => { await action('/kill', { confirmClose: false }); setKillPrompt(false); }}>KILL AUGUSTUS</button><button onClick={() => setKillPrompt(false)}>KEEP WATCHING</button></div></section></div>}
  </div>;
}


