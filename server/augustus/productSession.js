import { createHash, randomUUID } from 'node:crypto';
import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { MAINNET } from './mainnetCanary.js';
import { authorizationReadiness } from './mainnetAccountState.js';
import { decideEligibility, SESSION_LIMITS } from './sessionPolicy.js';

export function validateProductRisk(input) {
  const risk = { maxNotionalUsd: input.maxNotionalUsd, maxLeverage: input.maxLeverage, maxLossUsd: input.maxLossUsd, direction: input.direction, sessionMinutes: input.sessionMinutes ?? 60 };
  if (![risk.maxNotionalUsd, risk.maxLossUsd].every(x => typeof x === 'number' && Number.isFinite(x) && x > 0) || risk.maxNotionalUsd < 10 || risk.maxLossUsd >= risk.maxNotionalUsd) throw Error('Enter a position limit of at least $10 and a positive loss limit below that position limit.');
  if (!Number.isInteger(risk.maxLeverage) || risk.maxLeverage < 1 || risk.maxLeverage > 5) throw Error('Maximum leverage must be between 1x and 5x.');
  if (!['LONG', 'SHORT', 'BOTH'].includes(risk.direction) || !Number.isInteger(risk.sessionMinutes) || risk.sessionMinutes < 5 || risk.sessionMinutes > 120) throw Error('Choose a direction and a session between 5 and 120 minutes.');
  return risk;
}
export function productState({ killed, armed, proposal, result, expired, position, protectedPosition, executionState, connected, configured }) {
  if (killed) return 'KILL SWITCH';
  if (executionState === 'EXECUTING' || executionState === 'EXITING') return executionState;
  if (position) return protectedPosition ? 'PROTECTED' : 'POSITION LIVE';
  if (!connected) return 'CONNECT WALLET';
  if (!configured) return 'CONFIGURE RISK';
  if (expired) return 'SETUP EXPIRED';
  if (proposal && armed) return 'AWAITING APPROVAL';
  if (armed) return result?.decision === 'NO TRADE' ? 'NO SETUP' : 'WATCHING';
  return 'READY TO ARM';
}

// Deterministic risk-budget stop, not an additional market signal. Cost/slippage
// reserves reuse the existing policy. Rounding tightens protection; it never
// expands the user loss envelope. No target is fabricated when none is defined.
export function riskEnvelope(risk, state, side) {
  const entry = Number(formatPrice(Number(state.market.markPx) * (1 + (side === 'LONG' ? 1 : -1) * SESSION_LIMITS.slippage), state.market.szDecimals));
  const size = Number(formatSize(risk.maxNotionalUsd / entry, state.market.szDecimals));
  const notional = entry * size, costReserveUsd = notional * SESSION_LIMITS.costRate, slippageReserveUsd = notional * SESSION_LIMITS.slippage;
  const budget = risk.maxLossUsd - costReserveUsd - slippageReserveUsd;
  if (!(size > 0) || notional < 10 || !(budget > 0)) throw Error('The position or loss limit is too small after exchange rounding and cost reserves.');
  const rawStop = entry + (side === 'LONG' ? -1 : 1) * budget / size;
  if (!(rawStop > 0)) throw Error('The loss limit cannot produce a valid protective stop.');
  let stop = Number(formatPrice(rawStop, state.market.szDecimals));
  const tick = Math.max(10 ** -(6 - state.market.szDecimals), 10 ** (Math.floor(Math.log10(rawStop)) - 4));
  if (side === 'LONG' && stop < rawStop) stop = Number(formatPrice(rawStop + tick, state.market.szDecimals));
  if ((side === 'LONG' && stop >= entry) || (side === 'SHORT' && stop <= entry) || Math.abs(entry - stop) * size + costReserveUsd + slippageReserveUsd > risk.maxLossUsd + 1e-8) throw Error('A protective stop cannot fit the configured loss limit.');
  return { MAX_NOTIONAL_USD: risk.maxNotionalUsd, MAX_LOSS_USD: risk.maxLossUsd, notionalUsd: risk.maxNotionalUsd, leverage: risk.maxLeverage, stopLoss: stop, takeProfit: null, maxLossUsd: risk.maxLossUsd, costReserveUsd, slippageReserveUsd, emergencySlippageBps: SESSION_LIMITS.slippage * 10000 };
}

export class ProductSession {
  constructor({ adapter, feed, engine, audit, clock = Date.now, executor = null, resumeMonitoring = false }) {
    if (executor && executor.network !== 'SIMULATION') throw Error('Live product execution is disabled in this build.');
    Object.assign(this, { adapter, feed, engine, audit, clock, executor });
    this.identity = { master: adapter.master || MAINNET.master, agent: adapter.agent || MAINNET.agent };
    const saved = audit.events?.findLast(e => e.action === 'PRODUCT_CHECKPOINT')?.state;
    this.session = saved ? { ...saved, armed: resumeMonitoring && !saved.entries && !saved.killed && saved.armed, connected: resumeMonitoring && saved.connected, recoveryRequired: !!saved.entries || !resumeMonitoring } : { id: randomUUID(), risk: null, armed: false, killed: false, connected: false, entries: 0, rejectedIds: [], rejectedBindings: [], expiresAt: null, lastProposalId: null };
    if (audit.corrupt) { this.session.killed = true; this.session.recoveryRequired = true; }
    this.busy = false; this.executionState = null; this.ownedPosition = null; this.last = null;
  }
  owner(address) { if (address?.toLowerCase() !== this.identity.master.toLowerCase()) throw Error('Connected wallet does not own this Augustus session.'); }
  emit(action, data = {}) { try { this.audit.append({ timestamp: this.clock(), executionId: this.session.id, action, ...data }); } catch { this.session.killed = true; this.session.armed = false; throw Error('Session storage unavailable. Monitoring stopped.'); } }
  save() { this.emit('PRODUCT_CHECKPOINT', { state: structuredClone(this.session) }); }
  connect(address) { this.owner(address); this.session.connected = true; this.session.heartbeatAt = this.clock(); this.save(); }
  disconnect(address) { this.owner(address); this.session.connected = false; this.session.armed = false; this.engine.invalidate('Wallet disconnected.'); this.save(); }
  configure(address, input) {
    this.owner(address); if (!this.session.connected || this.busy || this.session.entries) throw Error('Reconnect or finish reconciliation before configuring another session.');
    const risk = validateProductRisk(input); this.session.risk = risk; this.session.armed = false; this.engine.invalidate('Risk limits changed.'); this.save(); return risk;
  }
  async arm(address) {
    this.owner(address); if (this.busy || this.session.killed || !this.session.connected || !this.session.risk || this.session.entries) throw Error('Connect, configure risk, and reset any stopped session before arming.');
    this.busy = true;
    try {
      const [state, context] = await Promise.all([this.adapter.read(), this.feed.read()]);
      const ready = authorizationReadiness(state, context, this.session.risk.maxLeverage, this.clock(), this.identity);
      if (!ready.authorizationReady || !state.agentAuthorized) throw Error(!state.agentAuthorized ? 'Augustus authorization is not verified.' : ready.reasons.join(' '));
      if (this.session.killed || !this.session.connected) throw Error('Session stopped while checking readiness.');
      this.session.armed = true; this.session.recoveryRequired = false; this.session.expiresAt = this.clock() + this.session.risk.sessionMinutes * 60000; this.session.lastProposalId = null;
      this.emit('SESSION_ARMED', { risk: this.session.risk, executionEnabled: false }); this.save();
    } finally { this.busy = false; }
  }
  async tick() {
    if (this.ownedPosition && this.executor && !this.busy) {
      this.busy = true;
      try { const result = await this.executor.monitor?.(); if (result && !result.position) { this.ownedPosition = null; this.emit('POSITION_CLOSED'); this.emit('SESSION_COMPLETED'); this.save(); } }
      catch { this.session.killed = true; this.session.armed = false; this.emit('EMERGENCY_STOP'); this.save(); }
      finally { this.busy = false; }
    }
    if (this.busy || !this.session.armed || this.session.killed || !this.session.connected) return;
    this.busy = true;
    try {
      if (this.clock() >= this.session.expiresAt) { this.session.armed = false; this.engine.invalidate('Session expired.'); this.save(); return; }
      if (this.clock() - this.session.heartbeatAt > 30000) { this.session.armed = false; this.engine.invalidate('Wallet connection inactive.'); this.last = { decision: 'NO TRADE', proposal: null, reasons: ['Wallet connection inactive. Reconnect and arm again.'] }; this.save(); return; }
      const [state, context] = await Promise.all([this.adapter.read(), this.feed.read()]);
      const readiness = authorizationReadiness(state, context, this.session.risk.maxLeverage, this.clock(), this.identity);
      if (!readiness.authorizationReady || !state.agentAuthorized) { this.engine.invalidate('Readiness lost.'); this.last = { decision: 'NO TRADE', proposal: null, reasons: state.agentAuthorized ? readiness.reasons : ['Augustus authorization is not verified.'] }; return; }
      const decision = decideEligibility(context, { direction: this.session.risk.direction === 'BOTH' ? 'BOTH' : this.session.risk.direction + '_ONLY' }, this.clock());
      if (decision.decision !== 'ENTRY_ELIGIBLE') {
        this.engine.invalidate('No setup in allowed direction.');
        this.last = { decision: 'NO TRADE', context, proposal: null, reasons: [decision.reason, ...(context.contextScore < 70 ? [`Context score ${context.contextScore}; the strategy requires at least 70.`] : [])] };
        return;
      }
      if (decision.decision === 'ENTRY_ELIGIBLE') {
        const config = riskEnvelope(this.session.risk, state, decision.side), configHash = createHash('sha256').update(JSON.stringify(config)).digest('hex');
        if (this.configHash !== configHash) { this.engine.configure(config); this.configHash = configHash; }
      }
      const result = await this.engine.evaluate();
      if (this.session.killed || !this.session.armed || !this.session.connected) { this.engine.invalidate('Session stopped during evaluation.'); return; }
      if (decision.decision !== 'ENTRY_ELIGIBLE') {
        this.engine.invalidate('No setup in allowed direction.');
        this.last = { ...result, decision: 'NO TRADE', proposal: null, reasons: [...new Set([decision.reason, ...result.reasons.filter(r => !r.includes('not configured'))])] };
      } else if (result.proposal && (this.session.rejectedIds.includes(result.proposal.proposalId) || this.session.rejectedBindings.includes(result.proposal.bindingHash))) {
        this.engine.invalidate('User rejected this setup.'); this.last = { ...result, decision: 'NO TRADE', proposal: null, reasons: ['Setup rejected. Waiting for changed market conditions.'] };
      } else this.last = result;
      const id = this.last?.proposal?.proposalId;
      if (id && id !== this.session.lastProposalId) { this.session.lastProposalId = id; this.emit('ENTRY_PROPOSED', { proposalId: id, bindingHash: this.last.proposal.bindingHash }); this.save(); }
    } catch (error) { this.engine.invalidate('Live evaluation failed.'); this.last = { decision: 'NO TRADE', proposal: null, reasons: [String(error.message).split('\n')[0].slice(0, 250)] }; }
    finally { this.busy = false; }
  }
  reject(address, proposalId) {
    this.owner(address); const current = this.last?.proposal;
    if (!current || current.proposalId !== proposalId) throw Error('This setup has expired.');
    this.session.rejectedIds.push(proposalId); this.session.rejectedBindings.push(current.bindingHash); this.engine.invalidate('User rejected setup.'); this.last = { decision: 'NO TRADE', proposal: null, reasons: ['Setup rejected. Watching for a new setup.'] }; this.emit('USER_REJECTED', { proposalId }); this.save();
  }
  async execute(address, { proposalId, approved }) {
    this.owner(address);
    if (this.busy || !this.session.connected || !this.session.armed || this.session.killed || this.session.entries || approved !== true || this.clock() >= this.session.expiresAt) throw Error('Explicit approval of an active unused session is required.');
    this.busy = true;
    try {
      if (this.last?.proposal?.proposalId !== proposalId || this.session.rejectedIds.includes(proposalId)) throw Error('This setup has expired or was rejected.');
      await this.engine.validateProposalId(proposalId);
      if (!this.executor) throw Error('Live execution remains disabled. No order was submitted.');
      if (this.session.killed || !this.session.connected || !this.session.armed || this.clock() >= this.session.expiresAt) throw Error('Session stopped during approval.');
      this.session.entries = 1; this.executionState = 'EXECUTING'; this.emit('USER_APPROVED', { proposalId }); this.save();
      try {
        const result = await this.executor.run(structuredClone(this.last.proposal), this.session.risk);
        if (result.status !== 'PROTECTED') throw Error('Protective stop unconfirmed.');
        this.ownedPosition = { ...result, proposal: structuredClone(result.proposal || this.last.proposal), proposalId }; this.executionState = null; this.session.armed = false; this.emit('STOP_CONFIRMED', { proposalId }); this.save();
      } catch {
        this.session.killed = true; this.session.armed = false;
        await this.executor.emergencyClose({ reduceOnly: true }); this.emit('EMERGENCY_STOP'); this.save(); throw Error('Emergency stopped. Check the reconciled position.');
      }
    } finally { this.busy = false; }
  }
  async kill(address, confirmClose = false) {
    this.owner(address); this.session.killed = true; this.session.armed = false; this.engine.invalidate('Kill switch.'); this.save();
    if (this.executor) { await this.executor.cancelOwnedEntries(); if (confirmClose === true) await this.executor.emergencyClose({ reduceOnly: true }); }
    this.emit('EMERGENCY_STOP', { confirmedClose: confirmClose === true, liveExecutionEnabled: false });
    return { stopped: true, cancellationSubmitted: !!this.executor, closeSubmitted: !!this.executor && confirmClose === true };
  }
  reset(address) { this.owner(address); if (this.busy || this.session.entries) throw Error('Reconcile the used session before starting another.'); this.session.killed = false; this.session.armed = false; this.engine.invalidate('Manual session reset.'); this.save(); }
  async close(address, confirmed) {
    this.owner(address); if (confirmed !== true || !this.ownedPosition || this.busy) throw Error('Confirm closing the exact owned position.');
    if (!this.executor) throw Error('Live closing remains disabled. No order was submitted.');
    this.busy = true; this.executionState = 'EXITING';
    try { await this.executor.emergencyClose({ reduceOnly: true }); this.ownedPosition = null; this.session.armed = false; this.emit('POSITION_CLOSED'); this.emit('SESSION_COMPLETED'); this.save(); }
    finally { this.busy = false; this.executionState = null; }
  }
  async status(address) {
    this.owner(address); if (this.session.connected) this.session.heartbeatAt = this.clock(); const [account, context] = await Promise.all([this.adapter.read(), this.feed.read().catch(() => null)]);
    const expired = !!this.last?.proposal && (this.clock() >= this.last.proposal.expiresAt || !context || this.clock() - context.timestamp >= 10000);
    if (expired) this.engine.invalidate('Setup expired.');
    const position = account.positions.find(p => p.coin === 'ETH') || null;
    const own = this.ownedPosition, protectedPosition = !!own && !!position && await this.adapter.stopConfirmed(own.proposal);
    const state = productState({ ...this.session, configured: !!this.session.risk, result: this.last, proposal: expired ? null : this.last?.proposal, expired, position, protectedPosition, executionState: this.executionState });
    return { state, risk: this.session.risk, armed: this.session.armed, killed: this.session.killed, connected: this.session.connected, entries: this.session.entries, expiresAt: this.session.expiresAt, account, context, readiness: authorizationReadiness(account, context, this.session.risk?.maxLeverage ?? 5, this.clock(), this.identity), reasons: this.last?.reasons || ['Configure risk and arm Augustus to begin watching for setups.'], proposal: this.session.armed && !this.session.killed && !expired ? this.last?.proposal ?? null : null, executionEnabled: false, executionMode: this.session.armed ? 'ARMED' : 'MONITORING', canApprove: false, canClose: false, externalPosition: !!position && !own, protectionActive: protectedPosition, position, positionProtection: own?.proposal ? { stop: own.proposal.stopLoss, takeProfit: own.proposal.takeProfit, openedAt: own.startedAt } : null, audit: this.audit.events.filter(e => e.action !== 'PRODUCT_CHECKPOINT').slice(-30) };
  }
}
