import React, { useState } from 'react';
export default function TradeProposal({ app }) {
  const [side, setSide] = useState('LONG'), [orderType, setOrderType] = useState('market'), [entry, setEntry] = useState(''), [stop, setStop] = useState(''), [target, setTarget] = useState(''), [leverage, setLeverage] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const p = app.proposal, frozen = app.busy || app.state === 'AWAITING_APPROVAL';
  return <section className="aug-panel"><h2>TRADE THESIS → RISK CHECK → PROPOSAL</h2><p className="aug-muted">Define your entry, stop and target. Sizing and checks are deterministic. No AI-generated trade signal.</p>
    <form onSubmit={event => { event.preventDefault(); setConfirmed(false); app.propose({ side, orderType, entry: Number(entry), stop: Number(stop), target: Number(target), leverage: Number(leverage) }); }}>
      <div className="aug-grid">
        <label>Side<select disabled={frozen} value={side} onChange={e => setSide(e.target.value)}><option>LONG</option><option>SHORT</option></select></label>
        <label>Entry type<select disabled={frozen} value={orderType} onChange={e => setOrderType(e.target.value)}><option value="market">Market (IOC with price cap)</option><option value="limit">Limit</option></select></label>
        {orderType === 'limit' && <label>Entry<input required type="number" step="any" min="0" disabled={frozen} value={entry} onChange={e => setEntry(e.target.value)} /></label>}
        <label>Leverage<input required type="number" min="1" max={app.settings.maxLeverage} step="1" disabled={frozen} value={leverage} onChange={e => setLeverage(e.target.value)} /></label>
        <label>Protective stop<input required type="number" step="any" min="0" disabled={frozen} value={stop} onChange={e => setStop(e.target.value)} /></label>
        <label>Target<input required type="number" step="any" min="0" disabled={frozen} value={target} onChange={e => setTarget(e.target.value)} /></label>
      </div><button disabled={frozen} type="submit">BUILD TESTNET PROPOSAL</button>
    </form>
    {p && <div className="aug-proposal"><h3>{p.symbol}-PERP / {p.side}</h3><dl className="aug-grid">{[['Entry', p.entry], ['Leverage', `${p.leverage}x`], ['Size', p.size], ['Notional', `$${p.positionNotional.toFixed(2)}`], ['Stop', p.stop], ['Target', p.target], ['Planned max loss + cost buffer', `$${p.maxLoss.toFixed(2)}`], ['Risk / equity', `${(p.maxLoss / app.snapshot.account.equity * 100).toFixed(3)}%`]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>{p.thesis}</p><p className="aug-muted">Stop execution can slip. Planned loss is not a guaranteed maximum. Proposals expire after 30 seconds.</p>
      <strong>{app.risk?.decision}</strong>{app.risk?.reasons?.map(reason => <p key={reason} className="aug-warning">{reason}</p>)}
      <label className="aug-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={app.busy} />I approve this specific TESTNET order, stop and target.</label>
      <div className="aug-actions"><button disabled={!confirmed || app.busy || app.state !== 'AWAITING_APPROVAL' || !app.snapshot.executionEnabled} onClick={app.approve}>APPROVE TRADE</button><button disabled={app.busy} onClick={app.reject}>REJECT</button></div>
    </div>}
  </section>;
}
