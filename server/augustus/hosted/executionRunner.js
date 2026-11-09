import { MainnetAdapter } from '../mainnetAdapter.js';
import { ProposalEngine } from '../proposalEngine.js';
import { validateCanaryProposal } from '../mainnetCanary.js';
import { decideEligibility } from '../sessionPolicy.js';
import { validateLiveContext } from '../mainnetContext.js';
import { createLiveExchange } from './liveExchange.js';
import { randomBytes } from 'node:crypto';
const terminal = phase => ['CLOSED','NO_FILL','ABORTED'].includes(phase);
export class ExecutionRunner {
  constructor({ repository, vault, context, adapterFactory = options => new MainnetAdapter(options), clientFactory = createLiveExchange, clock = Date.now }) { Object.assign(this, { repository, vault, context, adapterFactory, clientFactory, clock }); }
  async run(wallet, executionId, holder) {
    const repo = this.repository;
    let job = await repo.mutate(wallet, executionId, holder, async (j, c) => {
      const record = (await c.query('SELECT address,encrypted FROM augustus_agents WHERE wallet=$1', [wallet])).rows[0];
      if (!record || record.address.toLowerCase() !== j.agent.toLowerCase()) throw Error('Agent mapping changed');
      this.vault.verifyMapping(wallet, record); return { job: j, record };
    });
    const record = job.record; job = job.job;
    const exchange = this.clientFactory({ wallet, record, vault: this.vault, repository: repo, job, holder });
    const adapter = this.adapterFactory({ master: wallet, agent: job.agent, tenantScoped: true, executionClient: exchange });
    const checkpoint = async (changes, event) => { job = await repo.mutate(wallet, executionId, holder, async (j, c) => { Object.assign(j, changes); await repo.save(c, j, event); }); };
    try {
      if (terminal(job.phase)) return { terminal: true, healthy: true };
      if (!job.entrySent) {
        if (job.killed) { await checkpoint({ phase: 'ABORTED' }, 'KILL_BEFORE_ENTRY'); return { terminal: true, healthy: true }; }
        // Recreate the exact proposal engine and require unchanged binding, fresh
        // strategy, fresh account, caps and exchange rounding immediately before entry.
        const context = await this.context(); validateLiveContext(context, this.clock());
        const decision = decideEligibility(context, { direction: job.risk.direction === 'BOTH' ? 'BOTH' : job.risk.direction + '_ONLY' }, this.clock());
        if (decision.decision !== 'ENTRY_ELIGIBLE' || decision.side !== job.proposal.side) throw Error('Context no longer eligible');
        const engine = new ProposalEngine({ adapter, feed: { read: this.context }, clock: this.clock }); Object.assign(engine, job.engine);
        await engine.validateProposalId(job.proposal.proposalId);
        const state = await adapter.read();
        validateCanaryProposal(job.proposal, { MAX_NOTIONAL_USD: job.risk.maxNotionalUsd, MAX_LOSS_USD: job.risk.maxLossUsd }, state, this.clock(), { master: wallet, agent: job.agent });
        if (job.proposal.leverage > job.risk.maxLeverage || state.currentLeverage !== job.proposal.leverage) throw Error('Leverage mismatch');
        await checkpoint({ phase: 'ENTRY_VALIDATED' }, 'FINAL_REVALIDATION_PASSED');
        try { await adapter.entry(job.proposal, { MAX_NOTIONAL_USD: job.risk.maxNotionalUsd, MAX_LOSS_USD: job.risk.maxLossUsd }); }
        catch { /* No replay. Persisted reservation and exchange state decide next step. */ }
        job = await repo.mutate(wallet, executionId, holder, j => j);
        if (!job.entrySent) throw Error('Entry was not submitted');
      }
      let state = await adapter.read();
      const entries = state.orders.filter(o => o.coin === 'ETH' && o.cloid === job.proposal.entryCloid && !o.reduceOnly);
      await checkpoint({ ownedEntryOrderIds: entries.map(o => o.oid) });
      if (entries.length) await adapter.cancelEntries(job.proposal.entryCloid);
      state = await adapter.read();
      const position = state.positions.find(p => p.coin === 'ETH');
      if (!position) {
        const status = await adapter.info('orderStatus', { user: wallet, oid: job.proposal.entryCloid });
        const settled = status?.status === 'order' && /^(filled|.*[Cc]anceled|.*[Rr]ejected)$/.test(status.order?.status || '');
        if (!settled) { await checkpoint({ phase: 'ENTRY_UNCERTAIN', protection: 'NOT_VERIFIED' }, 'ENTRY_OUTCOME_UNCERTAIN'); return { terminal: false, healthy: false }; }
        // Do not retire a possibly in-flight entry on a single flat snapshot.
        // Wait out its signing expiry and observe flat state on separate ticks.
        if (!job.flatObservedAt || this.clock() - job.flatObservedAt < 2000 || (!job.managed && this.clock() < job.proposal.expiresAt + 5000)) {
          await checkpoint({ phase: 'SETTLEMENT_PENDING', protection: 'NOT_VERIFIED', flatObservedAt: job.flatObservedAt || this.clock() }, 'FLAT_SETTLEMENT_PENDING');
          return { terminal: false, healthy: false };
        }
        await checkpoint({ ownedFlatStopIds: state.orders.filter(o => o.cloid === job.proposal.stopCloid && o.reduceOnly).map(o => o.oid) });
        await adapter.cleanupProtection?.(job.proposal);
        await checkpoint({ phase: job.managed ? 'CLOSED' : 'NO_FILL', protection: 'FLAT', position: null }, 'FLAT_CONFIRMED');
        return { terminal: true, healthy: true };
      }
      if (job.flatObservedAt) await checkpoint({ flatObservedAt: null });
      if (!job.managed) {
        // Attribution requires actual fills for this execution's persisted CLOID;
        // an unrelated ETH position must never be silently adopted or closed.
        const fill = await adapter.reconcile(job.proposal.entryCloid);
        if (fill.side !== job.proposal.side || fill.size > job.proposal.size + 1e-9) throw Error('Managed fill attribution mismatch');
        await checkpoint({ managed: true, fill, openedAt: this.clock(), phase: 'FILLED', position }, 'FILL_RECONCILED');
      }
      const actualSize = Math.abs(Number(position.szi)), sameSide = (Number(position.szi) > 0 ? 'LONG' : 'SHORT') === job.proposal.side;
      const knownOrders = new Set([job.fill.orderId, ...(job.ownedOrderIds || []), ...state.orders.filter(o => o.cloid && [job.proposal.entryCloid,job.proposal.stopCloid,job.proposal.exitCloid,job.retryExitCloid].includes(o.cloid)).map(o => o.oid)]);
      const exits = await Promise.all([job.proposal.stopCloid,job.lastExitCloid].filter(Boolean).map(oid => adapter.info('orderStatus', { user: wallet, oid })));
      for (const status of exits) if (status?.status === 'order' && Number.isSafeInteger(status.order?.order?.oid)) knownOrders.add(status.order.order.oid);
      const foreignFill = state.fills?.some(f => f.coin === 'ETH' && Number(f.time) >= job.approvedAt && !knownOrders.has(f.oid));
      const entryChanged = Math.abs(Number(position.entryPx) - job.fill.price) > Math.max(1e-8, job.fill.price * 1e-6);
      if (!sameSide || actualSize > job.fill.size + 1e-9 || entryChanged || foreignFill) { const error = Error('External position change; ownership uncertain'); error.name = 'OwnershipUncertain'; throw error; }
      await checkpoint({ ownedOrderIds: [...knownOrders].filter(Number.isSafeInteger) });
      const p = job.proposal, withinRisk = job.fill.size * job.fill.price <= job.risk.maxNotionalUsd + 1e-8 && Math.abs(job.fill.price - p.stopLoss) * actualSize + p.costReserveUsd + p.slippageReserveUsd <= Math.min(job.risk.maxLossUsd, p.maxLossUsd) + 1e-8;
      if (job.closeRequested || !withinRisk || job.lastExitCloid) return await this.close({ adapter, job, checkpoint, reason: job.closeRequested ? 'MANUAL_CLOSE' : !withinRisk ? 'FILL_RISK_VIOLATION' : 'EXIT_RECOVERY' });
      let confirmed = await adapter.stopConfirmed(p);
      if (!confirmed && !['PROTECTED','PROTECTION_FAILED','EXIT_UNCERTAIN'].includes(job.phase)) {
        await checkpoint({ phase: 'PROTECTING', protection: 'NOT_VERIFIED' }, 'STOP_REQUESTED');
        try { await adapter.protect({ ...p, size: actualSize, reduceOnly: true }); } catch { /* Readback, never response status, determines protection. */ }
        confirmed = await adapter.stopConfirmed(p);
      }
      if (!confirmed) return await this.close({ adapter, job, checkpoint, reason: 'PROTECTION_FAILED' });
      await checkpoint({ phase: 'PROTECTED', protection: 'VERIFIED', verifiedAt: this.clock(), position, actualSize }, 'STOP_INDEPENDENTLY_VERIFIED');
      return { terminal: false, healthy: true };
    } catch (error) {
      // An unavailable API cannot establish position/ownership or confirm a close.
      // Persist uncertainty and keep reconciliation active. Never report PROTECTED.
      if (job.managed && error.name !== 'OwnershipUncertain') return this.close({ adapter, job, checkpoint, reason: 'PROTECTION_READBACK_FAILED' });
      await checkpoint({ phase: job.entrySent ? 'RECONCILIATION_REQUIRED' : 'ABORTED', protection: 'NOT_VERIFIED', incident: error.name === 'OwnershipUncertain' ? 'OWNERSHIP_UNCERTAIN' : job.entrySent ? 'RECONCILIATION_FAILED' : 'ENTRY_ABORTED' }, 'RECONCILIATION_FAILED');
      return { terminal: !job.entrySent, healthy: false };
    }
  }
  async close({ adapter, job, checkpoint, reason }) {
    await checkpoint({ phase: 'PROTECTION_FAILED', protection: 'FAILED', incident: reason }, reason);
    try {
      let exitCloid = job.retryExitCloid || job.proposal.exitCloid;
      if (job.lastExitCloid) {
        const previous = await adapter.info('orderStatus', { user: job.wallet, oid: job.lastExitCloid });
        if (previous?.status !== 'order' || !/^(filled|.*[Cc]anceled|.*[Rr]ejected)$/.test(previous.order?.status || '') || (job.exitAttempts || 0) >= 2) throw Error('Previous exit unsettled or retry exhausted');
        exitCloid = '0x' + randomBytes(16).toString('hex'); await checkpoint({ retryExitCloid: exitCloid }, 'TERMINAL_EXIT_RECONCILED_RETRY_RESERVED');
      }
      const closeReceipt = await adapter.emergencyClose({ ...job.proposal, exitCloid, reduceOnly: true });
      const state = await adapter.read();
      if (state.positions.some(p => p.coin === 'ETH') || state.orders.some(o => o.cloid === job.proposal.entryCloid && !o.reduceOnly)) throw Error('Close unconfirmed');
      await checkpoint({ ownedFlatStopIds: state.orders.filter(o => o.cloid === job.proposal.stopCloid && o.reduceOnly).map(o => o.oid) });
      await adapter.cleanupProtection?.(job.proposal);
      await checkpoint({ phase: 'CLOSED', protection: 'FLAT', position: null, closeReceipt }, 'REDUCE_ONLY_CLOSE_CONFIRMED');
      return { terminal: true, healthy: true };
    } catch {
      await checkpoint({ phase: 'EXIT_UNCERTAIN', protection: 'FAILED' }, 'EMERGENCY_CLOSE_UNCONFIRMED');
      return { terminal: false, healthy: false };
    }
  }
}
