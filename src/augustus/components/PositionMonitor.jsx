import React, { useState } from 'react';
export default function PositionMonitor({ app }) {
  const [pending, setPending] = useState(null);
  const account = app.snapshot.account;
  return <section className="aug-panel"><h2>POSITION MONITORING</h2><p className="aug-muted">Actual TESTNET master-account state. Refreshes every 5 seconds.</p>
    {!account.positions.length && <p>No open positions returned by the exchange.</p>}
    {account.positions.map(p => {
      const m = app.snapshot.markets.find(m => m.name === p.coin), orders = account.orders.filter(o => o.coin === p.coin);
      const stopOrder = orders.find(o => o.reduceOnly && o.orderType?.includes('Stop'));
      const plannedRisk = stopOrder ? Math.max(0, Number(p.szi) * (Number(p.entryPx) - Number(stopOrder.triggerPx))) : null;
      return <article key={p.coin} className="aug-proposal"><h3>{p.coin} / {Number(p.szi) > 0 ? 'LONG' : 'SHORT'}</h3><dl className="aug-grid">{[['Entry', p.entryPx], ['Mark', m?.markPx ?? 'Unavailable'], ['Size', p.szi], ['Leverage', p.leverage?.value], ['Unrealized PnL', p.unrealizedPnl], ['Liquidation price', p.liquidationPx ?? 'Unavailable'], ['Stops', orders.filter(o => o.orderType?.includes('Stop')).map(o => o.triggerPx).join(', ') || 'Not verified'], ['Targets', orders.filter(o => o.orderType?.includes('Take Profit')).map(o => o.triggerPx).join(', ') || 'Not verified'], ['Planned stop risk (before slippage/fees)', plannedRisk === null ? 'No verified stop' : plannedRisk.toFixed(2)], ['Margin used (not stop risk)', p.marginUsed]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value ?? 'Unavailable'}</dd></div>)}</dl><div className="aug-actions"><button disabled={app.busy || app.mode !== 'COPILOT'} onClick={() => setPending({ action: 'breakeven', symbol: p.coin })}>MOVE STOP TO BREAKEVEN</button><button disabled={app.busy || app.mode !== 'COPILOT'} onClick={() => setPending({ action: 'close', symbol: p.coin })}>CLOSE POSITION</button></div></article>;
    })}
    <h3>OPEN ORDERS / {account.orders.length}</h3>{account.orders.map(o => <div key={o.oid} className="aug-order">{o.coin} · {o.side} · {o.sz} · {o.orderType || 'Order'} · #{o.oid}<button disabled={app.busy || app.mode !== 'COPILOT'} onClick={() => setPending({ action: 'cancel', symbol: o.coin, orderId: o.oid })}>CANCEL</button></div>)}
    <p className="aug-muted">Recent fills returned: {account.fills.length}. This is the exchange's bounded recent-fill response, not a complete performance record.</p>
    {pending && <div className="aug-confirm-box" role="group" aria-label="Confirm position action"><p>Approve TESTNET {pending.action} for {pending.symbol}{pending.orderId ? ` order #${pending.orderId}` : ''}?</p><div className="aug-actions"><button disabled={app.busy} onClick={() => { app.manage(pending.action, pending.symbol, pending.orderId); setPending(null); }}>CONFIRM ACTION</button><button onClick={() => setPending(null)}>BACK</button></div></div>}
  </section>;
}
