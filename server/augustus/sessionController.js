import { randomBytes, randomUUID } from 'node:crypto';
import { sessionTransition } from '../../src/augustus/state/sessionState.js';
import { SESSION_LIMITS, validateEnvelope, decideEligibility, entryRejections } from './sessionPolicy.js';

const cloid = () => `0x${randomBytes(16).toString('hex')}`;
const bounded = promise => Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Observation timed out.')), 10000); timer.unref?.(); promise.finally(() => clearTimeout(timer)).catch(() => {}); })]);
export class ExecutionSessionController {
  constructor({ gateway, context, health, audit, clock = Date.now, authActive = () => true, allowDevForce = false }) {
    Object.assign(this, { gateway, context, health, audit, clock, authActive, allowDevForce });
    this.session = audit.latest?.() || { state: 'IDLE' }; this.busy = null; this.recovery = this.session.state !== 'IDLE'; this.lastRead = null; this.lastContext = null; this.errors = 0;
    if (this.recovery) { this.session.armed = false; this.session.stopRequested = true; this.session.state = 'EMERGENCY_STOPPED'; }
    this.timer = null;
  }
  emit(action, reason, extra = {}) {
    const event = { timestamp: this.clock(), symbol: 'ETH', executionId: this.session.id || null, agentState: this.session.state, action, reason, marketContext: this.lastContext, positionState: this.lastRead?.position || null, ...extra };
    try { if (this.auditFailed) return false; this.audit.append(event); return true; }
    catch { this.auditFailed = true; this.audit.corrupt = true; this.session.auditFault = true; this.session.armed = false; this.session.stopRequested = true; this.audit.events?.push({ ...event, action: 'AUDIT_FAILURE', reason: 'Durable audit failed. Entries disabled; protection/reduce-only safety actions still permitted.' }); return false; }
  }
  checkpoint() { this.emit('CHECKPOINT', 'Durable session state.', { session: structuredClone(this.session) }); }
  move(next, reason) { const from = this.session.state; this.session.state = sessionTransition(from, next); this.emit('TRANSITION', reason, { from, to: next }); this.checkpoint(); }
  async singleFlight(action) {
    if (this.busy) throw new Error('An execution action is already in flight.');
    const running = Promise.resolve().then(action); this.busy = running;
    try { return await running; } finally { if (this.busy === running) this.busy = null; }
  }
  status(owner) {
    if (this.session.owner && this.session.owner.toLowerCase() !== owner.toLowerCase()) throw new Error('This account does not own the active session.');
    return { session: structuredClone(this.session), decision: this.session.decision || { decision: 'WAIT', reason: 'Configure and arm a session.' }, busy: !!this.busy, marketContext: this.lastContext, exchange: this.lastRead, websocket: this.health(), events: this.audit.list(this.session.id).slice(-150), limits: SESSION_LIMITS, devForceEnabled: this.allowDevForce };
  }
  async configure(owner, input) {
    return this.singleFlight(async () => {
      if (this.audit.corrupt || this.session.armed || this.recovery || this.session.entryUncertain || !['IDLE', 'CONFIGURED', 'COMPLETED', 'ERROR', 'EMERGENCY_STOPPED'].includes(this.session.state)) throw new Error('Stop/reconcile the current session before configuring.');
      if (this.session.owner && this.session.owner.toLowerCase() !== owner.toLowerCase()) throw new Error('Existing session belongs to another account.');
      const config = validateEnvelope(input), read = await bounded(this.gateway.read(owner));
      if (read.account.positions.length || read.account.orders.length) throw new Error('Account must be flat with no open orders before configuration.');
      const state = this.session.state;
      this.session = { id: randomUUID(), owner, state, config, armed: false, stopRequested: false, trades: 0, createdAt: this.clock(), heartbeatAt: this.clock(), entryCloid: cloid(), stopCloid: cloid(), targetCloid: cloid(), exitCloid: cloid(), expiresAt: null, decision: { decision: 'WAIT', reason: 'Configured, not armed.' } };
      this.lastRead = read; this.lastContext = null;
      this.move('CONFIGURED', 'ETH session envelope validated.'); this.emit('SESSION_CONFIGURED', 'User configured one ETH trade attempt.', { config }); return this.status(owner);
    });
  }
  async arm(owner, approved) {
    return this.singleFlight(async () => {
      if (approved !== true || this.session.state !== 'CONFIGURED' || this.session.owner !== owner) throw new Error('A configured session and explicit ARM approval are required.');
      const snap = await bounded(this.gateway.snapshot(owner)), now = this.clock();
      const budget = this.session.config.lossUnit === 'USD' ? this.session.config.maxLoss : snap.account.equity * this.session.config.maxLoss / 100;
      this.session.startEquity = snap.account.equity;
      this.session.lossBudgetUsd = Math.min(budget, snap.account.equity * SESSION_LIMITS.maxLossPercent / 100, SESSION_LIMITS.maxLossUsd);
      this.session.expiresAt = now + this.session.config.durationMinutes * 60000;
      this.session.heartbeatAt = now; this.session.armed = true; this.session.stopRequested = false;
      const reasons = entryRejections(this.session, snap, this.health(), now);
      if (reasons.length) { this.session.armed = false; this.session.expiresAt = null; throw new Error(reasons.join(' ')); }
      this.emit('SESSION_ARMED', 'User authorized bounded semi-autonomous ETH TESTNET execution, stop/target and emergency reduce-only exit.', { config: this.session.config, lossBudgetUsd: this.session.lossBudgetUsd });
      if (this.session.auditFault) throw new Error('Cannot ARM without durable audit.');
      this.move('ARMED', 'Explicit session approval recorded.'); this.move('OBSERVING', 'Waiting for eligible real context.'); return this.status(owner);
    });
  }
  heartbeat(owner) { if (this.session.owner === owner) this.session.heartbeatAt = this.clock(); }
  cleanup() { const s = this.session; return this.gateway.cleanupFlat(s.owner, { orderIds: [s.stopOrderId, s.targetOrderId].filter(Number.isSafeInteger), cloids: [s.stopCloid, s.targetCloid].filter(Boolean) }); }
  force(owner, side) {
    if (!this.allowDevForce || this.session.owner !== owner || !this.session.armed || !['LONG', 'SHORT'].includes(side)) throw new Error('Development force entry is disabled or session is disarmed.');
    this.session.forceSide = side; this.emit('DEVELOPMENT_ENTRY_OVERRIDE', 'Developer requested eligibility override only; live data, risk and ARM checks remain mandatory.', { side }); this.checkpoint();
  }
  async tick() {
    if (this.busy || this.session.state === 'IDLE' || this.session.state === 'CONFIGURED' || this.session.state === 'COMPLETED') return;
    return this.singleFlight(async () => {
      try {
        if (this.recovery) {
          this.recovery = false; this.lastRead = await bounded(this.gateway.cancelEntries(this.session.owner, this.session.entrySubmitted ? this.session.entryCloid : null, this.session.entryOrderId));
          this.emit('RESTART_RECONCILIATION', 'Restart never resumes entries; exchange state inspected.');
          await this.halt('Service restarted. Manual reconfiguration required.', false); return;
        }
        this.lastRead = await bounded(this.gateway.read(this.session.owner));
        const now = this.clock(), live = this.lastRead;
        this.emit('POSITION_RECONCILED', 'Exchange is authoritative.', { orders: live.account.orders, equity: live.account.equity });
        if (this.session.auditFault) { await this.halt('Durable audit failed.', !!this.session.entrySubmitted && !this.gateway.protection(live, this.session.proposal?.stop ?? this.session.config.stopLoss, this.session.proposal?.side)); return; }
        if (!Number.isFinite(live.market.receivedAt) || now - live.market.receivedAt > SESSION_LIMITS.priceAgeMs || live.market.receivedAt > now || !Number.isFinite(live.account.receivedAt) || now - live.account.receivedAt > SESSION_LIMITS.priceAgeMs || live.account.receivedAt > now) { await this.halt('Market/account snapshot stale.', false); return; }
        if (live.account.positions.some(p => p.coin !== 'ETH')) { await this.halt('Conflicting non-ETH position detected.', false); return; }
        if (!this.session.armed || this.session.stopRequested) {
          if (this.session.entryUncertain && this.session.proposal) {
            const reconciled = await this.gateway.reconcileEntry(this.session.owner, this.session.entryCloid, this.session.proposal.size);
            if (['FILLED', 'CANCELED', 'REJECTED'].includes(reconciled.order.status)) { this.session.entryUncertain = false; this.emit('ORDER_RECONCILED', 'Previously uncertain entry now has a terminal status.', { exchangeOrderId: reconciled.order.orderId }); this.checkpoint(); }
          }
          if (live.position && this.session.entrySubmitted && !this.session.exposureResolved && !this.gateway.protection(live, this.session.proposal?.stop ?? this.session.config.stopLoss, this.session.proposal?.side)) await this.halt('Stopped session position has no confirmed protective stop.', true);
          else if (!live.position && !this.session.entryUncertain) this.lastRead = await this.cleanup();
          return;
        }
        if (now >= this.session.expiresAt || now - this.session.heartbeatAt > SESSION_LIMITS.heartbeatMs || !this.authActive(this.session.owner)) { await this.halt('Session expiry or controlling wallet disconnected.', false); return; }
        const health = this.health();
        if (!health.connected || !Number.isFinite(health.lastSeen) || now - health.lastSeen > SESSION_LIMITS.priceAgeMs) { await this.halt('ETH WebSocket stale/disconnected.', false); return; }
        if (this.session.startEquity - live.account.equity >= this.session.lossBudgetUsd) { await this.halt('Session maximum loss reached.', true); return; }
        if (live.position) {
          if (!this.session.proposal || this.session.trades !== 1) { await this.halt('Unexpected exchange position/local state mismatch.', true); return; }
          if (!this.gateway.protection(live, this.session.proposal.stop, this.session.proposal.side)) { await this.halt('Protective stop cannot be confirmed.', true); return; }
          if (!['POSITION_OPEN', 'MANAGING'].includes(this.session.state)) { await this.halt('Duplicate/external fill state detected.', true); return; }
          if (this.session.state === 'POSITION_OPEN') this.move('MANAGING', 'Protection verified; monitoring position.');
          this.errors = 0; return;
        }
        if (this.session.trades > 0) {
          if (live.account.orders.some(o => o.coin === 'ETH' && !o.reduceOnly)) { await this.halt('Unexpected pending entry after IOC reconciliation.', false); return; }
          const clean = await this.cleanup();
          if (!clean.clean) { await this.halt('Flat state cleanup not confirmed.', false); return; }
          this.session.armed = false; this.move('COMPLETED', 'Position closed and orders reconciled flat.'); this.emit('POSITION_CLOSED', 'Exchange confirms ETH position closed.'); this.emit('SESSION_COMPLETED', 'One-trade session complete.'); return;
        }
        if (live.account.positions.length || live.account.orders.length) { await this.halt('Conflicting pending order or position.', false); return; }
        const movements = await bounded(this.gateway.movements(this.session.owner, this.session.createdAt));
        if (!Array.isArray(movements) || movements.length) { await this.halt('Account transfer/ledger change or unknown ledger invalidated loss baseline.', false); return; }
        const ctx = await bounded(this.context()); this.lastContext = ctx;
        let decision = decideEligibility(ctx, this.session.config, this.clock());
        if (this.session.forceSide) {
          if (!ctx || ctx.symbol !== 'ETH' || !Number.isFinite(ctx.timestamp) || ctx.timestamp > this.clock() || this.clock() - ctx.timestamp > SESSION_LIMITS.contextAgeMs) decision = { decision: 'WAIT', reason: 'Even development override requires real fresh ETH context.' };
          else decision = { decision: 'ENTRY_ELIGIBLE', side: this.session.forceSide, reason: 'DEVELOPMENT OVERRIDE: real context retained; no strategy eligibility claimed.' };
        }
        this.session.decision = decision; this.emit('OBSERVATION', decision.reason, { decision });
        if (decision.decision !== 'ENTRY_ELIGIBLE') { this.errors = 0; return; }
        await this.enter(decision);
      } catch {
        this.errors++; this.emit('ERROR', 'Observation/execution failed; raw SDK errors are withheld.');
        await this.halt('Account/market state unknown or execution error. New entries stopped.', !!this.session.entrySubmitted).catch(() => { this.emit('EMERGENCY_STOP', 'Emergency reconciliation also failed. Inspect TESTNET account immediately.'); });
      }
    });
  }
  async enter(decision) {
    const s = this.session, now = this.clock();
    if ((decision.side === 'LONG' && s.config.direction === 'SHORT_ONLY') || (decision.side === 'SHORT' && s.config.direction === 'LONG_ONLY')) { this.emit('ENTRY_REJECTED', 'Direction outside armed envelope.'); return; }
    const snap = await bounded(this.gateway.snapshot(s.owner));
    const reasons = entryRejections(s, snap, this.health(), this.clock());
    if (reasons.length) { this.emit('ENTRY_REJECTED', reasons.join(' ')); return; }
    let proposal;
    try { proposal = this.gateway.prepare(s, snap, decision.side); } catch (error) { this.session.decision = { decision: 'NOT_ELIGIBLE', reason: error.message }; this.emit('ENTRY_REJECTED', error.message); return; }
    this.move('ENTRY_ELIGIBLE', decision.reason); this.emit('ENTRY_ELIGIBLE', decision.reason, { proposal });
    await this.gateway.setLeverage(proposal);
    const final = await bounded(this.gateway.snapshot(s.owner));
    if (entryRejections(s, final, this.health(), this.clock()).length || this.clock() - now > SESSION_LIMITS.priceAgeMs || Math.abs(Number(final.markets.find(m => m.name === 'ETH').markPx) / proposal.entry - 1) > SESSION_LIMITS.slippage * 2) { this.move('OBSERVING', 'Final safety check changed before entry.'); return; }
    proposal = this.gateway.prepare(s, final, decision.side);
    if (!s.armed || s.stopRequested) return;
    s.proposal = proposal; s.trades = 1; delete s.forceSide;
    this.move('PLACING_ORDER', 'Single trade slot reserved before submission.');
    s.entrySubmitted = true; s.entryUncertain = true; this.checkpoint();
    this.emit('ORDER_SUBMITTED', decision.reason, { cloid: s.entryCloid, proposal });
    if (s.auditFault || !s.armed || s.stopRequested) { await this.halt('Audit/STOP changed before order submission.', false); return; }
    let submission;
    try { submission = await this.gateway.submitEntry(proposal, s.entryCloid, Math.min(s.expiresAt, this.clock() + 10000)); }
    catch { this.emit('ERROR', 'Entry response ambiguous. Reconcile CLOID; never resubmit entry.'); }
    const read = await this.gateway.reconcileEntry(s.owner, s.entryCloid, proposal.size); this.lastRead = read;
    s.entryOrderId = read.order.orderId || null;
    if (['FILLED', 'CANCELED', 'REJECTED'].includes(read.order.status)) { s.entryUncertain = false; this.checkpoint(); }
    if (['RESTING', 'PARTIAL'].includes(read.order.status)) this.move('ORDER_OPEN', 'Exchange reports an entry order; reconcile fill before protection.');
    if (!read.position) {
      if (['CANCELED', 'REJECTED'].includes(read.order.status) || submission?.status === 'REJECTED') { s.armed = false; this.move('COMPLETED', 'IOC did not create a position; trade attempt consumed.'); this.emit('SESSION_COMPLETED', 'No fill; no entry retry.'); return; }
      await this.halt('Entry outcome unconfirmed or local/exchange mismatch.', false); return;
    }
    const actualSize = Math.abs(Number(read.position.szi));
    if (actualSize > proposal.size + 1e-9 || (Number(read.position.szi) > 0 ? 'LONG' : 'SHORT') !== proposal.side || !Number.isFinite(Number(read.position.leverage?.value)) || Number(read.position.leverage.value) > s.config.maxLeverage || this.gateway.actualRisk(read, proposal.stop) + Math.max(0, s.startEquity - read.account.equity) > s.lossBudgetUsd + 1e-8 || actualSize * Number(read.position.entryPx) > s.config.maxPositionUsd + 1e-6) { await this.halt('Actual fill exceeds armed risk/size/direction envelope.', true); return; }
    this.move('POSITION_OPEN', 'Actual position confirms fill.'); this.emit('ORDER_FILLED', actualSize < proposal.size ? 'Partial fill confirmed; protect actual size only.' : 'Fill confirmed from exchange position.', { exchangeOrderId: s.entryOrderId, actualSize });
    this.emit('STOP_SUBMITTED', 'Place mandatory reduce-only stop immediately after fill.', { cloid: s.stopCloid, stop: proposal.stop });
    try { await this.gateway.submitProtection(read, proposal.stop, 'sl', s.stopCloid); } catch { this.emit('ERROR', 'Stop response failed or ambiguous; reconcile before any further write.'); }
    const protectedRead = await this.gateway.confirmProtection(s.owner, proposal.stop, proposal.side);
    if (!protectedRead) { await this.halt('Stop could not be confirmed after safe reconciliation retries.', true); return; }
    this.lastRead = protectedRead;
    if (!protectedRead.position) { s.armed = false; this.move('MANAGING', 'Position already exited.'); this.move('COMPLETED', 'Exchange confirms flat.'); this.emit('SESSION_COMPLETED', 'Position exited during protection placement.'); return; }
    this.emit('STOP_CONFIRMED', 'Exchange open orders confirm reduce-only protection.', { exchangeOrderId: protectedRead.stop.oid });
    s.stopOrderId = protectedRead.stop.oid; this.checkpoint();
    if (proposal.target !== null && !s.stopRequested) {
      this.emit('TARGET_SUBMITTED', 'Optional reduce-only TP.', { cloid: s.targetCloid, target: proposal.target });
      try { const target = await this.gateway.submitProtection(protectedRead, proposal.target, 'tp', s.targetCloid); s.targetOrderId = target.orders?.[0]?.orderId || null; this.checkpoint(); } catch { this.emit('ERROR', 'Optional TP failed; mandatory stop retained.'); }
    }
    this.move('MANAGING', 'Position protected; reconcile continuously.');
    if (s.stopRequested) await this.halt('STOP requested while entry was in flight. Protection preserved.', false);
  }
  async halt(reason, flatten, manualClose = false) {
    const s = this.session;
    s.armed = false; s.stopRequested = true;
    if (s.state !== 'EMERGENCY_STOPPED') this.move('EMERGENCY_STOPPED', reason);
    this.emit('EMERGENCY_STOP', reason);
    try { this.lastRead = await this.gateway.cancelEntries(s.owner, s.entrySubmitted ? s.entryCloid : null, s.entryOrderId); this.emit('ENTRY_ORDERS_CANCELED', 'Session-owned pending entries removed; protective and unrelated orders preserved.'); }
    catch { this.emit('ERROR', 'Entry cancellation not confirmed. Reconcile current position before emergency protection/exit.'); this.lastRead = await this.gateway.read(s.owner); }
    const ownsExposure = s.entrySubmitted && s.proposal && !s.exposureResolved;
    if (this.lastRead.position && (ownsExposure || manualClose) && (flatten || !this.gateway.protection(this.lastRead, s.proposal?.stop ?? s.config.stopLoss, s.proposal?.side))) {
      this.emit('EXIT_TRIGGERED', reason, { cloid: s.exitCloid });
      if (s.exitSubmitted && !s.exitTerminal) { this.lastRead = await this.gateway.reconcileEntry(s.owner, s.exitCloid, Math.abs(Number(this.lastRead.position.szi))); s.exitTerminal = ['FILLED', 'CANCELED', 'REJECTED'].includes(this.lastRead.order.status); if (!s.exitTerminal) { this.emit('EMERGENCY_STOP', 'Exit outcome unknown; reconcile only, no duplicate exit.'); return; } }
      for (let attempt = s.exitAttempts || 0; attempt < 3 && this.lastRead.position; attempt++) {
        if (s.exitSubmitted) s.exitCloid = cloid();
        s.exitSubmitted = true; s.exitTerminal = false; s.exitAttempts = attempt + 1; this.checkpoint();
        this.lastRead = await this.gateway.close(s.owner, s.exitCloid);
        s.exitTerminal = ['FILLED', 'CANCELED', 'REJECTED'].includes(this.lastRead.order?.status) || this.lastRead.closed;
        if (!s.exitTerminal || this.lastRead.closed) break;
        this.emit('EXIT_PARTIAL', 'Terminal reduce-only IOC left a residual position; next unique close uses fresh actual size.', { cloid: s.exitCloid });
      }
      this.emit(this.lastRead.closed ? 'POSITION_CLOSED' : 'EMERGENCY_STOP', this.lastRead.closed ? 'Reduce-only emergency close confirmed flat.' : 'Emergency close not fully confirmed. Inspect account immediately.', { exchangeOrderId: this.lastRead.order?.orderId || null });
      if (this.lastRead.closed) this.lastRead = await this.cleanup();
    }
    if (!this.lastRead.position && !s.entryUncertain) { this.lastRead = await this.cleanup(); if (this.lastRead.clean) s.exposureResolved = true; }
    this.checkpoint();
  }
  async stop(owner) {
    if (this.session.owner !== owner) throw new Error('Session owner required.');
    this.session.armed = false; this.session.stopRequested = true;
    this.emit('STOP_REQUESTED', 'User stopped new entries immediately. Existing protection will be preserved.'); this.checkpoint();
    if (this.busy) await this.busy.catch(() => {});
    return this.singleFlight(async () => { await this.halt('Manual STOP AUGUSTUS.', false); return this.status(owner); });
  }
  async closeNow(owner, approved) {
    if (approved !== true || this.session.owner !== owner) throw new Error('Explicit close confirmation required.');
    this.session.armed = false; this.session.stopRequested = true;
    this.emit('EXIT_TRIGGERED', 'User explicitly requested CLOSE POSITION NOW.');
    if (this.busy) await this.busy.catch(() => {});
    return this.singleFlight(async () => {
      if (['MANAGING', 'POSITION_OPEN', 'EMERGENCY_STOPPED'].includes(this.session.state)) this.move('EXITING', 'User-confirmed reduce-only exit.');
      await this.halt('Manual reduce-only close.', true, true);
      if (!this.lastRead?.position && this.lastRead?.clean) { this.move('COMPLETED', 'Manual close confirmed flat and orders cleared.'); this.emit('SESSION_COMPLETED', 'Explicit exit complete.'); }
      return this.status(owner);
    });
  }
  start() { const loop = async () => { try { await this.tick(); } finally { this.timer = setTimeout(loop, 2000); this.timer.unref?.(); } }; void loop(); }
  shutdown() { clearTimeout(this.timer); }
}
