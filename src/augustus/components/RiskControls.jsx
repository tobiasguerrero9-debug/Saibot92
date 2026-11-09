import React from 'react';
const fields = [['maxRiskPerTradePercent', 'Risk / trade (%)', 0.1], ['maxLeverage', 'Max leverage', 1], ['maxDailyLossPercent', 'Rolling 24h loss limit (%)', 0.1], ['maxConcurrentPositions', 'Max positions / entry orders', 1], ['maxPositionNotional', 'Max position notional ($)', 1]];
export default function RiskControls({ settings, onChange, disabled }) {
  return <section className="aug-panel"><h2>RISK CONTROLS</h2><p className="aug-muted">Limits can tighten the server policy. They cannot silently exceed it. A protective stop is mandatory.</p><div className="aug-grid">
    {fields.map(([key, label, step]) => <label key={key}>{label}<input type="number" min={step} step={step} value={settings[key]} disabled={disabled} onChange={event => onChange({ ...settings, [key]: Number(event.target.value) })} /></label>)}
    <label>Allowed markets<input disabled={disabled} value={settings.allowedMarkets.join(', ')} onChange={event => onChange({ ...settings, allowedMarkets: event.target.value.toUpperCase().split(',').map(m => m.trim()).filter(Boolean) })} /></label>
  </div></section>;
}
