const PREFERENCE = 'saibot92.alert-audio.v1';

export class AlertAudio {
  constructor({ storage, contextFactory = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  } } = {}) {
    Object.assign(this, { storage, contextFactory });
    this.enabled = false; this.context = null; this.nodes = new Set(); this.listeners = new Set(); this.activation = 0;
    try { this.enabled = storage?.getItem(PREFERENCE) === 'true'; } catch { /* Preference storage is optional. */ }
    this.beginSession(0);
  }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  snapshot = () => this.enabled;
  setEnabled(enabled) {
    this.activation++;
    this.enabled = enabled === true;
    try { this.storage?.setItem(PREFERENCE, String(this.enabled)); } catch { /* Keep the current session usable. */ }
    if (!this.enabled) this.stop();
    this.listeners.forEach(fn => fn());
  }
  // Called only by an explicit click. No autoplay bypass, queued sounds or
  // initialization from a polling response.
  async unlock() {
    try {
      if (!this.context || this.context.state === 'closed') this.context = this.contextFactory();
      if (!this.context) return false;
      if (this.context.state !== 'running') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }
  async enableFromGesture() {
    const request = ++this.activation;
    const running = await this.unlock();
    if (request !== this.activation) return false;
    this.setEnabled(true);
    return running ? this.play('WATCH', true) : false;
  }
  beginSession(version) {
    this.baselined = false; this.lastVersion = version; this.cutoff = 0; this.watermark = 0; this.seen = new Set();
  }
  endSession() { this.activation++; this.stop(); this.baselined = false; }
  receive(events, metadata = {}) {
    try { return this.consume(events, metadata); } catch { return false; }
  }
  consume(events, { version, lastScan } = {}) {
    if (!Number.isFinite(version) || version <= this.lastVersion) return false;
    this.lastVersion = version;
    const valid = events.filter(e => typeof e.id === 'string' && Number.isFinite(e.timestamp));
    if (!this.baselined) {
      this.baselined = true; this.cutoff = Math.max(Number.isFinite(lastScan) ? lastScan : 0, ...valid.map(e => e.timestamp));
      this.watermark = this.cutoff; this.seen = new Set(valid.map(e => e.id)); return false;
    }
    const prior = this.watermark;
    const fresh = valid.filter(e => !this.seen.has(e.id) && e.timestamp > this.cutoff && e.timestamp >= prior);
    valid.forEach(e => this.seen.add(e.id));
    this.watermark = Math.max(this.watermark, ...valid.map(e => e.timestamp));
    this.seen = new Set([...this.seen].slice(-1000));
    // One restrained cue per received batch; HIGH takes priority over WATCH.
    // All IDs are consumed even when muted or autoplay is blocked.
    const severity = fresh.some(e => e.severity === 'HIGH') ? 'HIGH' : fresh.some(e => e.severity === 'WATCH') ? 'WATCH' : null;
    return severity ? this.play(severity) : false;
  }
  play(severity, confirmation = false) {
    if (!this.enabled || this.context?.state !== 'running' || !['WATCH','HIGH'].includes(severity)) return false;
    try {
      this.stop();
      const start = this.context.currentTime;
      const tones = severity === 'HIGH' ? [[0,880,1100,0.09,0.035],[0.13,1320,1500,0.15,0.04]] : [[0,1040,1320,0.18,0.025]];
      for (const [offset,from,to,duration,volume] of tones) {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain(), time = start + offset;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(from,time); oscillator.frequency.exponentialRampToValueAtTime(to,time+duration*0.5);
        gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(volume*(confirmation ? 0.5 : 1),time+0.008); gain.gain.exponentialRampToValueAtTime(0.0001,time+duration);
        oscillator.connect(gain); gain.connect(this.context.destination);
        this.nodes.add(oscillator);
        oscillator.onended = () => { this.nodes.delete(oscillator); try { oscillator.disconnect(); gain.disconnect(); } catch { /* Audio must never affect Alerts. */ } };
        oscillator.start(time); oscillator.stop(time+duration+0.01);
      }
      return true;
    } catch { this.stop(); return false; }
  }
  stop() { for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch { /* Already ended. */ } } this.nodes.clear(); }
}
let storage; try { storage = globalThis.localStorage; } catch { /* Browser policy may disable storage. */ }
export const alertAudio = new AlertAudio({ storage });
