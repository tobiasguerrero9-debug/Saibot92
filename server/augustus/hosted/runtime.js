import { MainnetAdapter } from '../mainnetAdapter.js';
import { ProposalEngine } from '../proposalEngine.js';
import { ProductSession } from '../productSession.js';
import { validateLiveContext } from '../mainnetContext.js';
import { ExecutionRepository } from './executionRepository.js';
const secretKeys = /private.?key|signature|mnemonic|seed.?phrase|ciphertext|encrypted|token_hash|csrf_hash/i;
export function publicData(value) {
  if (Array.isArray(value)) return value.map(publicData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKeys.test(key)).map(([key, entry]) => [key, publicData(entry)]));
  return value;
}
export class HostedRuntime {
  constructor({ store, vault, config, adapterFactory = options => new MainnetAdapter(options) }) { Object.assign(this, { store, vault, config, adapterFactory }); this.executions = new ExecutionRepository({ store, config }); }
  async context(client) {
    const record = (await client.query('SELECT observed_at,payload,worker_healthy FROM augustus_context ORDER BY observed_at DESC LIMIT 1')).rows[0];
    if (!record?.worker_healthy || Date.now() - new Date(record.observed_at).getTime() > 10000) throw Error('Fresh production context collector unavailable');
    validateLiveContext(record.payload); const { _history, ...context } = record.payload; return context;
  }
  async tenant(wallet, action = 'status', input = {}, authentication = {}) {
    return this.store.transaction(wallet, async client => {
      const record = (await client.query('SELECT address,encrypted FROM augustus_agents WHERE wallet=$1', [wallet])).rows[0];
      if (!record) throw Error('User-specific agent mapping missing'); this.vault.verifyMapping(wallet, record);
      const saved = (await client.query('SELECT payload FROM augustus_state WHERE wallet=$1 FOR UPDATE', [wallet])).rows[0]?.payload;
      const events = (await client.query('SELECT event FROM augustus_events WHERE wallet=$1 ORDER BY id DESC LIMIT 100', [wallet])).rows.map(r => r.event).reverse(), buffered = [];
      const audit = { events, corrupt: false, append(event) { events.push(event); buffered.push(event); }, list(id) { return events.filter(e => e.executionId === id); } };
      if (saved?.session) events.push({ action: 'PRODUCT_CHECKPOINT', state: saved.session });
      const adapter = this.adapterFactory({ master: wallet, agent: record.address, tenantScoped: true });
      const feed = { read: () => this.context(client) }, engine = new ProposalEngine({ adapter, feed });
      if (saved?.engine) Object.assign(engine, saved.engine);
      const product = new ProductSession({ adapter, feed, engine, audit, resumeMonitoring: true });
      product.last = saved?.last || null; product.configHash = saved?.configHash;
      // Control-plane intent must COMMIT even when Hyperliquid/context reads are
      // unavailable. The dedicated worker performs/reconciles the owned writes.
      if (['kill','close','disconnect'].includes(action)) {
        if (action === 'kill') { await product.kill(wallet, false); await this.executions.control(client, wallet, 'kill'); }
        else if (action === 'disconnect') { product.disconnect(wallet); await this.executions.control(client, wallet, 'kill'); }
        else { await this.executions.control(client, wallet, 'close', input); }
        const payload = { ...saved, session: product.session, last: null, engine: { config: engine.config, current: null, invalidated: engine.invalidated, result: { decision: 'NO TRADE', proposal: null, reasons: ['Control action pending reconciliation.'] } } };
        await client.query('INSERT INTO augustus_state(wallet,payload) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET payload=EXCLUDED.payload,revision=augustus_state.revision+1,updated_at=now()', [wallet, JSON.stringify(publicData(payload))]);
        for (const event of buffered.filter(e => e.action !== 'PRODUCT_CHECKPOINT')) await client.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [wallet, JSON.stringify(publicData(event))]);
        return { state: action === 'kill' ? 'KILL SWITCH' : action === 'close' ? 'CLOSE REQUESTED' : 'CONNECT WALLET', killed: product.session.killed, armed: product.session.armed, connected: product.session.connected, risk: product.session.risk, entries: product.session.entries, executionEnabled: false, executionMode: 'MONITORING', proposal: null, reasons: ['Control intent persisted; exchange reconciliation runs in the protection worker.'], persistence: 'COMMITTED_BEFORE_RESPONSE' };
      }
      const gate = await this.executions.gate(client, wallet);
      const executionRow = (await client.query('SELECT execution_id FROM augustus_execution_jobs WHERE wallet=$1', [wallet])).rows[0];
      let execution = executionRow ? await this.executions.load(client, wallet, executionRow.execution_id) : null;
      if (action === 'connect') product.connect(wallet);
      else if (action === 'risk') product.configure(wallet, input);
      else if (action === 'arm') await product.arm(wallet);
      else if (action === 'reject') product.reject(wallet, input.proposalId);
      else if (action === 'reset') product.reset(wallet);
      else if (action === 'execute') {
        if (!gate.executionEnabled) { await client.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [wallet, JSON.stringify({ action: 'EXECUTION_BLOCKED', timestamp: Date.now() })]); return { executionEnabled: false, blocked: true, reasons: gate.reasons, state: 'MONITORING' }; }
        execution = await this.executions.enqueue(client, wallet, product, input, record.address, authentication.sessionTokenHash);
      }
      else if (action !== 'status') throw Error('Unknown product action');
      if (action === 'status') await product.tick();
      const status = await product.status(wallet), before = saved?.last?.proposal?.proposalId;
      await client.query('UPDATE augustus_proposals SET invalidated=true WHERE wallet=$1', [wallet]);
      if (status.proposal) await client.query('INSERT INTO augustus_proposals(wallet,proposal_id,binding_hash,payload,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(wallet,proposal_id) DO UPDATE SET invalidated=false,payload=EXCLUDED.payload,expires_at=EXCLUDED.expires_at', [wallet, status.proposal.proposalId, status.proposal.bindingHash, JSON.stringify(status.proposal), new Date(status.proposal.expiresAt)]);
      if (before && before !== status.proposal?.proposalId) buffered.push({ action: 'PROPOSAL_INVALIDATED', proposalId: before, timestamp: Date.now() });
      const payload = { session: product.session, last: product.last, configHash: product.configHash, positionReconciliation: { observedAt: Date.now(), positions: status.account.positions, orders: status.account.orders, protectionActive: status.protectionActive }, engine: { config: engine.config, current: engine.current, invalidated: engine.invalidated, result: engine.result } };
      await client.query('INSERT INTO augustus_state(wallet,payload) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET payload=EXCLUDED.payload,revision=augustus_state.revision+1,updated_at=now()', [wallet, JSON.stringify(publicData(payload))]);
      for (const event of buffered.filter(e => e.action !== 'PRODUCT_CHECKPOINT')) await client.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [wallet, JSON.stringify(publicData(event))]);
      const managed = execution?.managed && execution.wallet === wallet && execution.agent === record.address;
      const protectedPosition = !!managed && !!status.position && await adapter.stopConfirmed(execution.proposal);
      const ready = gate.executionEnabled && product.session.connected && product.session.armed && !product.session.killed && !product.session.entries && status.readiness.authorizationReady && status.account.agentAuthorized && !!status.risk && !!status.context && Date.now() - status.context.timestamp < 10000;
      return publicData({ ...status, state: status.position && managed ? protectedPosition ? 'PROTECTED' : 'PROTECTION NOT VERIFIED' : status.state, executionEnabled: ready, executionMode: ready ? 'EXECUTION ENABLED' : product.session.armed ? 'ARMED' : 'MONITORING', canApprove: ready && product.session.armed && !product.session.killed && !product.session.entries && !!status.proposal, canClose: !!managed && !!status.position && this.config.stage === 'production', externalPosition: !!status.position && !managed, protectionActive: protectedPosition, positionProtection: managed ? { stop: execution.proposal.stopLoss, takeProfit: execution.proposal.takeProfit, openedAt: execution.openedAt } : null, execution: execution ? { executionId: execution.executionId, proposalId: execution.proposal.proposalId, phase: execution.phase, protection: protectedPosition ? 'VERIFIED' : status.position ? 'NOT_VERIFIED' : execution.protection, incident: execution.incident, closeRequested: execution.closeRequested } : null, executionGate: { ...gate, executionEnabled: ready }, userAgent: { address: record.address }, persistence: 'COMMITTED_BEFORE_RESPONSE' });
    });
  }
  async reserveApproval(client, wallet, proposalId, bindingHash) {
    const proposal = (await client.query('SELECT binding_hash,expires_at,invalidated FROM augustus_proposals WHERE wallet=$1 AND proposal_id=$2 FOR UPDATE', [wallet, proposalId])).rows[0];
    if (!proposal || proposal.invalidated || proposal.binding_hash !== bindingHash || new Date(proposal.expires_at).getTime() <= Date.now()) throw Error('Proposal expired or mismatched');
    const result = await client.query('INSERT INTO augustus_approvals(wallet,proposal_id,binding_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING proposal_id', [wallet, proposalId, bindingHash]);
    if (!result.rows.length) throw Error('Duplicate approval');
  }
  async reserveEntry(client, wallet, executionId, proposalId) {
    const result = await client.query('INSERT INTO augustus_execution_locks(wallet,execution_id,proposal_id) VALUES($1,$2,$3) ON CONFLICT(wallet) DO NOTHING RETURNING execution_id', [wallet, executionId, proposalId]);
    if (!result.rows.length) throw Error('Entry already reserved; reconcile instead of retrying');
  }
}
