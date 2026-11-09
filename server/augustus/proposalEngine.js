import { randomUUID } from 'node:crypto';
import { stableHash as hash } from './stableHash.js';
import { decideEligibility, SESSION_LIMITS } from './sessionPolicy.js';
import { MAINNET, validateCanaryCaps, validateCanaryProposal } from './mainnetCanary.js';
import { authorizationReadiness } from './mainnetAccountState.js';
import { validateLiveContext } from './mainnetContext.js';

const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
export class ProposalEngine {
  constructor({ adapter, feed, clock = Date.now }) {
    this.adapter = adapter; this.feed = feed; this.clock = clock; this.config = null; this.current = null; this.invalidated = []; this.pending = null;
    this.identity = { master: adapter.master || MAINNET.master, agent: adapter.agent || MAINNET.agent };
    this.result = { decision: 'NO TRADE', reasons: ['Waiting for live evaluation.'], executionEnabled: false, proposal: null };
  }
  invalidate(reason) {
    if (this.current) this.invalidated = [...this.invalidated, { proposalId: this.current.proposalId, reason, timestamp: this.clock() }].slice(-50);
    this.current = null;
  }
  configure(input) {
    const caps = validateCanaryCaps(input);
    if (!positive(input.notionalUsd) || input.notionalUsd > caps.MAX_NOTIONAL_USD || !Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > 5 || !positive(input.stopLoss) || !positive(input.maxLossUsd) || input.maxLossUsd > caps.MAX_LOSS_USD || !Number.isFinite(input.costReserveUsd) || input.costReserveUsd < 0 || !positive(input.slippageReserveUsd) || !positive(input.emergencySlippageBps) || input.emergencySlippageBps >= 10000 || (input.takeProfit != null && !positive(input.takeProfit))) throw Error('Explicit notional, leverage cap, protective stop, loss budget and cost/slippage reserves required.');
    this.config = structuredClone({ ...caps, notionalUsd: input.notionalUsd, leverage: input.leverage, stopLoss: input.stopLoss, takeProfit: input.takeProfit ?? null, maxLossUsd: input.maxLossUsd, costReserveUsd: input.costReserveUsd, slippageReserveUsd: input.slippageReserveUsd, emergencySlippageBps: input.emergencySlippageBps });
    this.invalidate('User risk configuration changed.');
    this.result = { decision: 'NO TRADE', reasons: ['Risk configuration saved; awaiting fresh evaluation.'], executionEnabled: false, proposal: null };
  }
  status() {
    if (this.current && this.clock() >= this.current.expiresAt) { this.invalidate('Proposal expired.'); this.result = { ...this.result, decision: 'NO TRADE', proposal: null, reasons: ['Proposal expired; fresh evaluation required.'] }; }
    return structuredClone({ ...this.result, engineEnabled: true, executionEnabled: false, approvalEnabled: false, configured: !!this.config, invalidated: this.invalidated });
  }
  evaluate() {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => { this.pending = null; }); return this.pending;
  }
  async run() {
    let context = null, state = null;
    try {
      [context, state] = await Promise.all([this.feed.read(), this.adapter.read()]);
      const now = this.clock(), reasons = [];
      try { validateLiveContext(context, now); } catch (e) { reasons.push(e.message); }
      const readiness = authorizationReadiness(state, context, this.config?.leverage ?? 5, now, this.identity);
      reasons.push(...readiness.reasons);
      if (!state.agentAuthorized) reasons.push('Exact Augustus agent authorization is not confirmed.');
      const eligible = decideEligibility(context, { direction: 'BOTH' }, now);
      if (eligible.decision !== 'ENTRY_ELIGIBLE') {
        if (!['LOCKED IN', 'SQUEEZE MODE', 'RISK OFF'].includes(context?.agentState)) reasons.push(`Agent State ${context?.agentState ?? 'UNAVAILABLE'} is not an eligible directional state.`);
        if (!Number.isFinite(context?.contextScore) || context.contextScore < 70) reasons.push(`Context Score ${context?.contextScore ?? 'UNAVAILABLE'} is below required 70.`);
        const buy = context?.orderFlow?.buyRatio;
        if (context?.agentState === 'RISK OFF' ? !(buy <= 0.42) : !(buy >= 0.58)) reasons.push(context?.agentState === 'RISK OFF' ? 'Short requires derived buy share <= 42%.' : 'Long requires derived buy share >= 58%.');
        reasons.push(eligible.reason);
      }
      if (!this.config) reasons.push('User MAX_NOTIONAL_USD, MAX_LOSS_USD, notional, leverage cap, stop and cost/slippage reserves are not configured.');
      if (reasons.length) {
        this.invalidate('Eligibility, data, account or risk prerequisites no longer pass.');
        this.result = { decision: 'NO TRADE', evaluatedAt: now, contextTimestamp: context?.timestamp, context, reasons: [...new Set(reasons)], proposal: null, executionEnabled: false }; return this.status();
      }
      // Current strategy supplies direction only. Preserve explicit user risk/stop
      // configuration; never invent stops, financial caps or larger size.
      const cfg = this.config, entry = Number(state.market.markPx) * (1 + (eligible.side === 'LONG' ? 1 : -1) * SESSION_LIMITS.slippage);
      const input = { symbol: 'ETH-PERP', side: eligible.side, orderType: 'IOC', estimatedEntry: entry, size: cfg.notionalUsd / entry, leverage: state.currentLeverage, stopLoss: cfg.stopLoss, takeProfit: cfg.takeProfit, maxLossUsd: cfg.maxLossUsd, costReserveUsd: cfg.costReserveUsd, slippageReserveUsd: cfg.slippageReserveUsd, emergencySlippageBps: cfg.emergencySlippageBps, context, createdAt: now, whyEntryEligible: eligible.reason };
      const rounded = await this.adapter.roundedProposal(input, cfg);
      const latest = await this.adapter.read();
      if (this.config !== cfg) throw Error('Risk configuration changed during evaluation; fresh evaluation required.');
      validateLiveContext(context, this.clock()); validateCanaryProposal(rounded, cfg, latest, this.clock(), this.identity);
      if (!latest.agentAuthorized || latest.currentLeverage !== rounded.leverage || Math.abs(Number(latest.market.markPx) - Number(state.market.markPx)) > Number(state.market.markPx) * SESSION_LIMITS.slippage) throw Error('Account or price changed during proposal construction.');
      const { timestamp, ...contextValues } = context;
      const binding = hash({ config: cfg, rounded: { side: rounded.side, entry: rounded.estimatedEntry, size: rounded.size, stop: rounded.stopLoss, target: rounded.takeProfit, leverage: rounded.leverage }, context: contextValues, equity: latest.equity, availableMargin: latest.availableMargin });
      if (!this.current || this.current.bindingHash !== binding || this.clock() >= this.current.expiresAt) {
        this.invalidate('Price/context/risk/account binding changed or proposal expired.');
        const stopRisk = Math.abs(rounded.estimatedEntry - rounded.stopLoss) * rounded.size;
        this.current = { ...rounded, proposalId: randomUUID(), bindingHash: binding, contextTimestamp: timestamp, estimatedMarginRequiredUsd: rounded.notionalUsd / rounded.leverage, estimatedMaximumLossUsd: stopRisk + cfg.costReserveUsd + cfg.slippageReserveUsd, riskReward: rounded.takeProfit == null ? null : Math.abs(rounded.takeProfit - rounded.estimatedEntry) / Math.abs(rounded.estimatedEntry - rounded.stopLoss), riskRewardNote: rounded.takeProfit == null ? 'No take-profit configured; reward/risk unavailable.' : 'Price-distance ratio; fees/slippage excluded from reward.', whyEligible: eligible.reason, createdAt: now, expiresAt: Math.min(timestamp + 10000, now + 10000), approvalRequired: true, executionEnabled: false };
      }
      this.result = { decision: 'ELIGIBLE PROPOSAL', evaluatedAt: this.clock(), contextTimestamp: timestamp, context, reasons: [], proposal: this.current, executionEnabled: false }; return this.status();
    } catch (error) {
      this.invalidate('Live data or validation failure.');
      this.result = { decision: 'NO TRADE', evaluatedAt: this.clock(), context, reasons: [String(error.message).split('\n')[0].replace(/0x[0-9a-f]{64,}/gi, '[redacted]').slice(0, 300)], proposal: null, executionEnabled: false }; return this.status();
    }
  }
  async validateProposalId(proposalId) {
    const latest = await this.evaluate();
    if (latest.decision !== 'ELIGIBLE PROPOSAL' || latest.proposal?.proposalId !== proposalId) throw Error('Proposal ID is invalid, stale or superseded.');
    return { proposalId, bindingHash: latest.proposal.bindingHash, executionEnabled: false, approvalRequired: true };
  }
}
