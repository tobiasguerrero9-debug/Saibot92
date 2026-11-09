import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { BellDot, Activity } from 'lucide-react';
import { alertsInbox as alertsStore } from '../services/alertsInbox';
import { alertAudio } from '../services/alertAudio';
import './alerts.css';
const filters = { ALL: null, SQUEEZE: 'SQUEEZE_DETECTED', STATE: 'AGENT_STATE_SHIFT', LIQ: 'LIQUIDATION_RISK', AUGUSTUS: 'AUGUSTUS' };
export default function AlertsDrawer({ monitor }) {
  const events = useSyncExternalStore(alertsStore.subscribe, alertsStore.snapshot);
  const conditions = useSyncExternalStore(alertsStore.subscribe, alertsStore.liveSnapshot);
  const soundEnabled = useSyncExternalStore(alertAudio.subscribe, alertAudio.snapshot);
  const [open, setOpen] = useState(false), [filter, setFilter] = useState('ALL'), [banner, setBanner] = useState(null), [now, setNow] = useState(Date.now());
  const initialized = useRef(false);
  const seen = useRef(new Set(events.map(e => e.id))), trigger = useRef(null), panel = useRef(null);
  useEffect(() => { alertAudio.beginSession(alertsStore.receivedVersion); return () => alertAudio.endSession(); }, []);
  useEffect(() => {
    const played = alertAudio.receive(events, { version: alertsStore.receivedVersion, lastScan: monitor?.status?.lastScan });
    if (import.meta.env.DEV && played) console.debug('Alerts audio scheduled for a new backend alert.');
  }, [events, monitor?.status?.lastScan]);
  useEffect(() => {
    if (!initialized.current) { if (!alertsStore.hasLoaded) return; initialized.current = true; seen.current = new Set(events.map(e => e.id)); return; }
    const high = events.find(e => !seen.current.has(e.id) && e.severity === 'HIGH');
    seen.current = new Set(events.map(e => e.id));
    if (high) setBanner(high);
  }, [events]);
  useEffect(() => { if (!banner) return; const timer = setTimeout(() => setBanner(null), 6000); return () => clearTimeout(timer); }, [banner]);
  useEffect(() => { if (!open) return; setNow(Date.now()); panel.current?.querySelector('button')?.focus(); const button = trigger.current; const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; const timer = setInterval(() => setNow(Date.now()), 15000); return () => { clearInterval(timer); document.body.style.overflow = prior; button?.focus(); }; }, [open]);
  const unread = events.filter(e => !e.acknowledged).length;
  const live = conditions.filter(e => now - e.observedAt < 65000 && (!filters[filter] || e.type === filters[filter]));
  const history = events.filter(e => !filters[filter] || e.type === filters[filter]);
  return <>
    <button ref={trigger} className="sa-alert-button" aria-expanded={open} aria-controls="sa-alert-drawer" onClick={() => { if (!open) void alertAudio.unlock(); setOpen(v => !v); }}><BellDot size={13} aria-hidden="true" /> ALERTS{unread > 0 && <span aria-label={`${unread} unread alerts`}>{unread}</span>}</button>
    {createPortal(<>
    {banner && <div className="sa-alert-banner" role="status"><button onClick={() => { setOpen(true); setBanner(null); }}><Activity size={12} aria-hidden="true" /> {banner.symbol} // {banner.title}</button><button aria-label="Dismiss alert banner" onClick={() => setBanner(null)}>×</button></div>}
    {open && <div className="sa-alert-overlay" onClick={() => setOpen(false)}><aside id="sa-alert-drawer" ref={panel} className="sa-alert-drawer" role="dialog" aria-modal="true" aria-labelledby="sa-alert-title" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') { const buttons = panel.current.querySelectorAll('button'); const first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }}>
      <header><div><h2 id="sa-alert-title">SAIBOT92 ALERTS</h2><p><i /> LIVE EVENT LAYER</p></div><button aria-label="Close alerts" onClick={() => setOpen(false)}>×</button></header>
      <nav aria-label="Alert filters">{Object.keys(filters).map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</nav>
      <div className="sa-alert-tools"><span>{unread} unread</span><button aria-pressed={soundEnabled} onClick={() => { if (soundEnabled) alertAudio.setEnabled(false); else void alertAudio.enableFromGesture(); }}>AUDIO {soundEnabled ? 'ON' : 'OFF'}</button>{import.meta.env.DEV && <button disabled={!soundEnabled} onClick={async () => { if (await alertAudio.unlock()) alertAudio.play('WATCH'); }}>TEST SOUND</button>}<button disabled={!unread} onClick={() => alertsStore.acknowledge()}>MARK ALL READ</button></div>
      <div className="sa-alert-history"><h3 className="sa-alert-section">LIVE CONDITIONS</h3>{live.slice(0, 8).map(e => <div key={`${e.symbol}:${e.type}`} className={`sa-alert-row sa-live-row sa-alert-${e.severity.toLowerCase()}`} title={e.context}><span className="sa-alert-meta"><strong>{e.symbol}</strong><b>{e.severity}</b></span><span className="sa-alert-title">{e.title}</span></div>)}{live.length > 8 && <p className="sa-alert-empty">Showing 8 of {live.length} current conditions.</p>}{!live.length && <p className="sa-alert-empty">{filter === 'AUGUSTUS' ? 'Augustus integration is not active.' : monitor?.error ? 'Market monitoring unavailable. Retrying automatically.' : monitor?.loading && !monitor?.observedAt ? 'Loading current market conditions…' : 'No alert conditions detected. SAIBOT92 is monitoring the market.'}</p>}<h3 className="sa-alert-section">EVENT HISTORY</h3>{history.map(e => <button key={e.id} className={`sa-alert-row sa-alert-${e.severity.toLowerCase()}`} onClick={() => alertsStore.acknowledge(e.id)} aria-label={`${e.symbol}: ${e.title}${!e.acknowledged ? ', unread' : ''}`}>
        <span className="sa-alert-meta"><b>{e.severity}</b><span>{!e.acknowledged && '● UNREAD'}</span></span><strong>{e.symbol}</strong><span className="sa-alert-title">{e.title}</span><span className="sa-alert-context">{e.context}</span><time dateTime={new Date(e.timestamp).toISOString()}>{Math.max(0, Math.floor((now - e.timestamp) / 60000)) < 1 ? 'Just now' : `${Math.max(1, Math.floor((now - e.timestamp) / 60000))}m ago`}</time>
      </button>)}{!history.length && <p className="sa-alert-empty">No new transitions yet.</p>}</div>
      <footer>Background monitor · {monitor?.status?.state || 'OFFLINE'} · {monitor?.status?.marketsEvaluated || 0} markets · last scan {monitor?.status?.lastScan ? new Date(monitor.status.lastScan).toLocaleTimeString() : 'unavailable'} · read state saved in this browser.</footer>
    </aside></div>}
    </>, document.body)}
  </>;
}
