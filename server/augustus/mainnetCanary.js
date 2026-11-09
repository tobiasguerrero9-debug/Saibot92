import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { AUTH_MASTER, AUTH_AGENT } from './authorizationFlow.js';

export const MAINNET = Object.freeze({ mode: 'MAINNET_CANARY', info: 'https://api.hyperliquid.xyz/info', exchange: 'https://api.hyperliquid.xyz/exchange', ws: 'wss://api.hyperliquid.xyz/ws', master: AUTH_MASTER, agent: AUTH_AGENT });
// This delivery cannot send live orders, even if an environment variable is set.
export const LIVE_CANARY_EXECUTION_IMPLEMENTED = false;
export const CONTEXT_FIELDS = Object.freeze(['agentState', 'marketBias', 'contextScore', 'whatChanged', 'orderFlow', 'openInterest', 'funding', 'liquidationContext', 'squeezeState', 'transitionPressure']);
const cloid = () => '0x' + randomBytes(16).toString('hex');
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const fresh = (time, now) => Number.isFinite(time) && time <= now && now - time <= 10000;
export function canaryEnvironment(env = {}) {
  return Object.freeze({ mode: env.AUGUSTUS_MODE, mainnetAcknowledged: env.AUGUSTUS_ACK_MAINNET === 'true', requestedExecution: env.AUGUSTUS_ENABLE_MAINNET_EXECUTION === 'true', executionEnabled: false });
}
export function validateCanaryCaps(input) {
  if (!positive(input.MAX_NOTIONAL_USD) || !positive(input.MAX_LOSS_USD)) throw Error('Explicit positive numeric MAX_NOTIONAL_USD and MAX_LOSS_USD are required.');
  return Object.freeze({ MAX_NOTIONAL_USD: input.MAX_NOTIONAL_USD, MAX_LOSS_USD: input.MAX_LOSS_USD });
}
export function assertCanarySnapshot(s, now = Date.now(), flat = true, identity = { master: AUTH_MASTER, agent: AUTH_AGENT }) {
  if (!s || s.network !== 'Mainnet' || s.master?.toLowerCase() !== identity.master.toLowerCase() || s.agent?.toLowerCase() !== identity.agent.toLowerCase()) throw Error('Wrong mainnet account/network.');
  if (!fresh(s.accountAt, now) || !fresh(s.ordersAt, now) || !fresh(s.marketAt, now) || s.reconciled !== true || s.uncertain === true) throw Error('Stale or unreconciled account/orders/market state.');
  if (!fresh(s.modeAt, now) || !fresh(s.activeAssetAt, now)) throw Error('Stale account mode or ETH leverage state.');
  if (!Array.isArray(s.positions) || !Array.isArray(s.orders) || !positive(s.equity) || !positive(s.availableMargin) || s.agentAuthorized !== true) throw Error('Funded, authorized account state required.');
  if (s.accountModeSupported !== true || s.collateralKnown !== true || s.marginMode !== 'cross' || !Number.isInteger(s.currentLeverage) || s.currentLeverage < 1 || s.currentLeverage > 5) throw Error('Known account mode, collateral and CROSS leverage <= 5x required.');
  if (flat && (s.positions.length || s.orders.length)) throw Error('Existing positions or orders block entry, including other markets.');
}
export function validateCanaryProposal(p, caps, s, now = Date.now(), identity = { master: AUTH_MASTER, agent: AUTH_AGENT }) {
  validateCanaryCaps(caps); assertCanarySnapshot(s, now, true, identity);
  if (p.symbol !== 'ETH-PERP' || !['LONG', 'SHORT'].includes(p.side) || p.orderType !== 'IOC') throw Error('ETH-PERP IOC only.');
  if (!Number.isInteger(p.leverage) || p.leverage < 1 || p.leverage > 5) throw Error('Leverage must be 1–5x.');
  if (s.currentLeverage > p.leverage) throw Error('Exchange leverage exceeds user cap.');
  if (![p.notionalUsd, p.estimatedEntry, p.stopLoss, p.size, p.maxLossUsd].every(positive)) throw Error('Positive size, entry, notional, mandatory stop and max loss required.');
  if (!fresh(p.createdAt, now) || !fresh(p.context?.timestamp, now) || CONTEXT_FIELDS.some(key => p.context[key] == null)) throw Error('Fresh complete SAIBOT92 context required.');
  if (p.notionalUsd < 10 || p.notionalUsd > caps.MAX_NOTIONAL_USD || Math.abs(p.size * p.estimatedEntry - p.notionalUsd) > 0.000001) throw Error('Notional outside envelope or inconsistent with size.');
  if (p.notionalUsd / p.leverage > s.availableMargin) throw Error('Insufficient usable perpetual margin.');
  if ((p.side === 'LONG' && p.stopLoss >= p.estimatedEntry) || (p.side === 'SHORT' && p.stopLoss <= p.estimatedEntry)) throw Error('Stop must be on the protective side.');
  if (p.takeProfit != null && (!positive(p.takeProfit) || (p.side === 'LONG' ? p.takeProfit <= p.estimatedEntry : p.takeProfit >= p.estimatedEntry))) throw Error('Invalid take profit.');
  if (!Number.isFinite(p.costReserveUsd) || p.costReserveUsd < 0 || !positive(p.slippageReserveUsd)) throw Error('Explicit fee and positive slippage reserves required.');
  const loss = Math.abs(p.estimatedEntry - p.stopLoss) * p.size + p.costReserveUsd + p.slippageReserveUsd;
  if (loss > p.maxLossUsd || p.maxLossUsd > caps.MAX_LOSS_USD || p.notionalUsd / p.leverage + p.costReserveUsd + p.slippageReserveUsd > s.availableMargin) throw Error('Estimated loss or collateral reserve exceeds approved envelope.');
  return loss;
}
export function prepareMainnetApproval(now = Date.now()) {
  if (!Number.isSafeInteger(now)) throw Error('Invalid authorization nonce.');
  const expiry = now + 86400000;
  return { network: 'Mainnet', endpoint: MAINNET.exchange, master: AUTH_MASTER, agent: AUTH_AGENT, expiry, expiresAtUtc: new Date(expiry).toISOString(), action: { type: 'approveAgent', hyperliquidChain: 'Mainnet', signatureChainId: '0xa4b1', agentAddress: AUTH_AGENT, agentName: `AUGUSTUS92 valid_until ${expiry}`, nonce: now }, nonce: now, signed: false, submitted: false, orders: false, transfers: false, executionEnabled: false };
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Control-plane implementation. Tests supply an in-memory SIMULATION gateway.
// No mainnet trading client is constructed, exported or wired in this delivery.
export class MainnetCanary {
  constructor({ env = {}, audit, gateway, clock = Date.now, simulation = false }) {
    this.environment = canaryEnvironment(env); this.audit = audit; this.gateway = gateway; this.clock = clock;
    this.simulation = simulation === true && gateway?.network === 'SIMULATION';
    if (simulation && !this.simulation) throw Error('Only an in-memory simulation gateway may simulate execution.');
    if (!audit?.append || !audit?.list || audit.corrupt) throw Error('Healthy durable audit required.');
    this.id = randomUUID(); this.busy = false; this.stopped = false; this.entries = 0; this.state = 'DISABLED';
    // Any previous reservation requires explicit operator reconciliation, never auto-resume.
    this.recoveryRequired = audit.events?.some(e => e.action === 'ORDER_SUBMITTED' && !audit.events.some(c => c.executionId === e.executionId && c.action === 'SESSION_COMPLETED')) || false;
  }
  emit(action, data = {}) { try { this.audit.append({ executionId: this.id, timestamp: this.clock(), action, ...data }); } catch { this.stopped = true; this.state = 'AUDIT_FAILED'; throw Error('Audit write failed; entries blocked.'); } }
  gate() {
    if (this.environment.mode !== 'MAINNET_CANARY' || !this.environment.mainnetAcknowledged) throw Error('Explicit MAINNET_CANARY environment gate required.');
    if (!this.simulation || !this.environment.requestedExecution) throw Error('Live execution is disabled by this build.');
    if (this.stopped || this.recoveryRequired) throw Error('Stopped or unreconciled session.');
  }
  async locked(fn) { if (this.busy) throw Error('Single-flight execution lock held.'); this.busy = true; try { return await fn(); } finally { this.busy = false; } }
  configure(input) { if (this.busy || this.entries || this.state === 'ARMED') throw Error('Cannot reconfigure active/consumed session.'); this.caps = validateCanaryCaps(input); this.proposal = null; this.state = 'CONFIGURED'; this.emit('SESSION_CONFIGURED', { caps: this.caps }); }
  async arm() { return this.locked(async () => { this.gate(); if (!this.caps || this.entries || this.state !== 'CONFIGURED') throw Error('User caps and fresh session required.'); assertCanarySnapshot(await this.gateway.read(), this.clock()); this.state = 'ARMED'; this.emit('SESSION_ARMED', { caps: this.caps }); }); }
  async propose(input) { return this.locked(async () => {
    if (!this.caps || !['CONFIGURED', 'ARMED'].includes(this.state) || this.entries || this.stopped) throw Error('Configure a fresh session first.');
    const p = JSON.parse(JSON.stringify({ ...input, executionId: this.id, entryCloid: cloid(), stopCloid: cloid(), exitCloid: cloid(), createdAt: this.clock() }));
    validateCanaryProposal(p, this.caps, await this.gateway.read(), this.clock());
    this.proposal = JSON.stringify(p); this.proposalHash = digest(p); this.emit('ENTRY_PROPOSED', { proposal: p, proposalHash: this.proposalHash });
    return { proposal: p, proposalHash: this.proposalHash, executionEnabled: false, warning: 'Review only. No approval or entry submission occurs.' };
  }); }
  async approveAndExecute({ approved, proposalHash }) { return this.locked(async () => {
    this.gate(); if (this.state !== 'ARMED' || approved !== true || !this.proposal || proposalHash !== this.proposalHash || this.entries) throw Error('Exact proposal approval and unused entry slot required.');
    const p = JSON.parse(this.proposal); validateCanaryProposal(p, this.caps, await this.gateway.read(), this.clock());
    this.emit('USER_APPROVED', { proposalHash });
    if (this.stopped) throw Error('Kill switch active.');
    // Reserve durably before submission; ambiguity consumes the only entry slot.
    this.entries = 1; this.state = 'ENTRY_PENDING'; this.emit('ORDER_SUBMITTED', { cloid: p.entryCloid });
    try {
      await this.gateway.entry(p, this.caps); // No automatic submission retry.
      const fill = await this.gateway.reconcile(p.entryCloid);
      if (!fill || !positive(fill.size) || !positive(fill.price) || fill.size > p.size || fill.symbol !== 'ETH-PERP' || fill.side !== p.side) throw Error('Entry fill unconfirmed or outside proposal.');
      this.emit('ORDER_FILLED', { size: fill.size, price: fill.price });
      if (fill.size * fill.price > this.caps.MAX_NOTIONAL_USD || Math.abs(fill.price - p.stopLoss) * fill.size + p.costReserveUsd + p.slippageReserveUsd > p.maxLossUsd) throw Error('Actual fill violates envelope.');
      let protectedPosition = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (await this.gateway.stopConfirmed(p, fill)) { protectedPosition = true; break; }
        // Same stop CLOID; gateway must reconcile it before any retry.
        try { await this.gateway.protect({ ...p, size: fill.size, reduceOnly: true }); }
        catch { /* Reconcile the same CLOID before a bounded retry; no new order ID. */ }
        if (await this.gateway.stopConfirmed(p, fill)) { protectedPosition = true; break; }
      }
      if (!protectedPosition) throw Error('Protective SL not confirmed.');
      this.state = 'PROTECTED'; this.emit('STOP_CONFIRMED', { cloid: p.stopCloid }); this.emit('POSITION_UPDATED', { protected: true });
    } catch {
      this.stopped = true; this.state = 'EMERGENCY_STOPPED';
      try { this.emit('ERROR', { reason: 'Entry/protection uncertain; reconcile and reduce-only close.' }); } catch { /* Protection remains required even if audit storage fails. */ }
      try { await this.gateway.cancelEntries(p.entryCloid); } catch { /* Cancellation uncertainty must not suppress protective closing. */ }
      await this.gateway.emergencyClose({ ...p, reduceOnly: true });
      const s = await this.gateway.read();
      if (s.positions.length) throw Error('EMERGENCY_STOPPED: close unconfirmed; manual reconciliation required.');
      this.emit('EMERGENCY_STOP', { closed: true }); this.emit('POSITION_CLOSED');
      throw Error('EMERGENCY_STOPPED');
    }
  }); }
  async stop() {
    this.stopped = true; // Synchronous gate closes even while another call is in flight.
    await this.gateway.cancelEntries(this.proposal ? JSON.parse(this.proposal).entryCloid : null);
    this.emit('EMERGENCY_STOP', { mode: 'PRESERVE_CONFIRMED_SL', newEntriesBlocked: true });
    if (!this.busy && this.state === 'PROTECTED') {
      const p = JSON.parse(this.proposal);
      if (!await this.gateway.stopConfirmed(p)) { await this.gateway.emergencyClose({ ...p, reduceOnly: true }); this.state = 'EMERGENCY_STOPPED'; }
    }
  }
  async reconcileClosed() { return this.locked(async () => { if (!this.entries) throw Error('No canary entry to reconcile.'); const s = await this.gateway.read(); if (s.positions.length || s.orders.length || !fresh(s.accountAt, this.clock()) || !fresh(s.ordersAt, this.clock())) throw Error('Flat exchange state not confirmed.'); this.stopped = true; this.state = 'COMPLETED'; this.emit('POSITION_CLOSED'); this.emit('SESSION_COMPLETED'); }); }
}
