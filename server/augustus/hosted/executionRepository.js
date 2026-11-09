import { randomUUID, randomBytes } from 'node:crypto';
import { stableHash } from '../stableHash.js';
import { executionGate } from './config.js';
import { validateLiveContext } from '../mainnetContext.js';
import { decideEligibility } from '../sessionPolicy.js';
const zero = '0x0000000000000000000000000000000000000000';
const cloid = () => '0x' + randomBytes(16).toString('hex');
export const approvalDigest = stableHash;
export class ExecutionRepository {
  constructor({ store, config, clock = Date.now }) { Object.assign(this, { store, config, clock }); }
  async gate(client, wallet) {
    const review = (await client.query('SELECT allowed,reviewed,review_id,expires_at FROM augustus_account_reviews WHERE wallet=$1', [wallet])).rows[0];
    const health = (await client.query('SELECT healthy,observed_at FROM augustus_protection_health WHERE singleton=true')).rows[0];
    const protectionWorker = health?.healthy === true && this.clock() - new Date(health.observed_at).getTime() >= 0 && this.clock() - new Date(health.observed_at).getTime() < 15000;
    return { ...executionGate(this.config, review && { ...review, reviewId: review.review_id, expiresAt: review.expires_at }, { persistence: true, identity: true, mapping: true, protectionWorker, signerReady: true }), protectionWorker, emergencyCloseReady: protectionWorker };
  }
  async enqueue(client, wallet, product, input, agent, sessionTokenHash) {
    const gate = await this.gate(client, wallet);
    if (!gate.executionEnabled) throw Error('Live execution gate closed');
    if (!/^[0-9a-f]{64}$/.test(sessionTokenHash || '') || !(await client.query('SELECT wallet FROM augustus_sessions WHERE token_hash=$1 AND wallet=$2 AND expires_at>now() AND origin=$3', [sessionTokenHash, wallet, this.config.origin])).rows.length) throw Error('Authenticated approval session required');
    const s = product.session, p = product.last?.proposal;
    if (input.approved !== true || !p || input.proposalId !== p.proposalId || input.bindingHash !== p.bindingHash || this.clock() >= p.expiresAt || !s.connected || !s.armed || s.killed || s.entries || this.clock() >= s.expiresAt) throw Error('Exact active proposal approval required');
    await product.engine.validateProposalId(p.proposalId);
    const current = product.engine.current;
    if (!current || current.bindingHash !== p.bindingHash) throw Error('Proposal changed during approval');
    const binding = (await client.query('SELECT binding_hash,invalidated,expires_at FROM augustus_proposals WHERE wallet=$1 AND proposal_id=$2 FOR UPDATE', [wallet, p.proposalId])).rows[0];
    if (!binding || binding.invalidated || binding.binding_hash !== p.bindingHash || new Date(binding.expires_at).getTime() <= this.clock()) throw Error('Persisted proposal expired or mismatched');
    const approved = await client.query('INSERT INTO augustus_approvals(wallet,proposal_id,binding_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING proposal_id', [wallet, p.proposalId, p.bindingHash]);
    if (!approved.rows.length) throw Error('Duplicate approval');
    const executionId = randomUUID(), proposal = { ...structuredClone(current), entryCloid: cloid(), stopCloid: cloid(), exitCloid: cloid() };
    const lock = await client.query('INSERT INTO augustus_execution_locks(wallet,execution_id,proposal_id) VALUES($1,$2,$3) ON CONFLICT(wallet) DO NOTHING RETURNING execution_id', [wallet, executionId, p.proposalId]);
    if (!lock.rows.length) throw Error('Entry already reserved');
    const job = { wallet, agent, executionId, identitySessionHash: sessionTokenHash, sessionId: s.id, proposal, risk: structuredClone(s.risk), engine: { config: product.engine.config, current: product.engine.current, result: product.engine.result }, phase: 'QUEUED', approvedAt: this.clock(), entrySent: false, managed: false, killed: false, closeRequested: false, protection: 'NOT_VERIFIED' };
    job.approvalHash = approvalDigest({ wallet, agent, proposal, risk: job.risk });
    await client.query('INSERT INTO augustus_execution_jobs(wallet,execution_id,proposal_id,payload) VALUES($1,$2,$3,$4)', [wallet, executionId, p.proposalId, JSON.stringify(job)]);
    await client.query('INSERT INTO augustus_protection_queue(wallet,execution_id) VALUES($1,$2)', [wallet, executionId]);
    await client.query('UPDATE augustus_approvals SET consumed=true WHERE wallet=$1 AND proposal_id=$2', [wallet, p.proposalId]);
    s.entries = 1; s.armed = false; s.lastProposalId = null; product.engine.invalidate('Execution reserved'); product.last = null;
    product.emit('EXECUTION_RESERVED', { executionId, proposalId: p.proposalId }); product.save();
    return job;
  }
  async load(client, wallet, executionId) {
    const row = (await client.query('SELECT payload FROM augustus_execution_jobs WHERE wallet=$1 AND execution_id=$2 FOR UPDATE', [wallet, executionId])).rows[0];
    const j = row?.payload;
    if (!j || j.wallet !== wallet || j.executionId !== executionId || j.approvalHash !== approvalDigest({ wallet, agent: j.agent, proposal: j.proposal, risk: j.risk })) throw Error('Execution linkage invalid');
    return j;
  }
  async save(client, job, event) {
    await client.query('UPDATE augustus_execution_jobs SET payload=$3,updated_at=now() WHERE wallet=$1 AND execution_id=$2', [job.wallet, job.executionId, JSON.stringify(job)]);
    if (event) await client.query('INSERT INTO augustus_events(wallet,event) VALUES($1,$2)', [job.wallet, JSON.stringify({ action: event, executionId: job.executionId, proposalId: job.proposal.proposalId, phase: job.phase, protection: job.protection, timestamp: this.clock() })]);
  }
  async control(client, wallet, action, input = {}) {
    const row = (await client.query('SELECT execution_id FROM augustus_execution_jobs WHERE wallet=$1', [wallet])).rows[0];
    if (!row) { if (action === 'close') throw Error('No Augustus-managed execution'); return; }
    const job = await this.load(client, wallet, row.execution_id);
    if (action === 'close') {
      if (input.confirmed !== true || input.executionId !== job.executionId || !job.managed || ['CLOSED','NO_FILL','ABORTED'].includes(job.phase)) throw Error('Explicit confirmation of managed execution required');
      job.closeRequested = true;
    } else { job.killed = true; await client.query('UPDATE augustus_proposals SET invalidated=true WHERE wallet=$1', [wallet]); await client.query('DELETE FROM augustus_approvals WHERE wallet=$1 AND consumed=false', [wallet]); }
    await this.save(client, job, action === 'close' ? 'MANUAL_CLOSE_REQUESTED' : 'KILL_PERSISTED');
  }
  async claim(holder) {
    return this.store.transaction(zero, async c => (await c.query("UPDATE augustus_protection_queue SET holder=$1,lease_until=now()+interval '15 seconds' WHERE wallet=(SELECT wallet FROM augustus_protection_queue WHERE active=true AND (lease_until IS NULL OR lease_until<now()) ORDER BY last_checked_at,wallet FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING wallet,execution_id", [holder])).rows[0]);
  }
  async assertLease(c, wallet, executionId, holder) {
    const r = await c.query("UPDATE augustus_protection_queue SET lease_until=now()+interval '15 seconds' WHERE wallet=$1 AND execution_id=$2 AND holder=$3 AND lease_until>now() RETURNING wallet", [wallet, executionId, holder]);
    if (!r.rows.length) throw Error('Execution lease lost');
  }
  async mutate(wallet, executionId, holder, fn) {
    return this.store.transaction(wallet, async c => { await this.assertLease(c, wallet, executionId, holder); const job = await this.load(c, wallet, executionId); const result = await fn(job, c); await this.save(c, job); return result ?? job; });
  }
  async reserveOperation(wallet, executionId, holder, { kind, cloid }) {
    return this.mutate(wallet, executionId, holder, async (job, c) => {
      if (kind === 'entry') {
        const gate = await this.gate(c, wallet);
        if (!gate.executionEnabled || job.killed || job.entrySent || job.phase !== 'ENTRY_VALIDATED' || this.clock() >= job.proposal.expiresAt) throw Error('Entry no longer allowed');
        job.entrySent = true; job.phase = 'ENTRY_UNCERTAIN';
      } else if (!job.entrySent || (kind !== 'cancel' && !job.managed)) throw Error('No approved managed exposure');
      const expected = kind === 'entry' ? job.proposal.entryCloid : kind === 'stop' ? job.proposal.stopCloid : kind === 'exit' ? (job.retryExitCloid || job.proposal.exitCloid) : cloid;
      if (cloid !== expected) throw Error('Operation CLOID mismatch');
      if (kind === 'exit') { job.lastExitCloid = cloid; job.exitAttempts = (job.exitAttempts || 0) + 1; if (job.exitAttempts > 2) throw Error('Emergency close retry limit reached'); }
      const n = (await c.query('INSERT INTO augustus_agent_nonces(wallet,nonce) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET nonce=GREATEST(augustus_agent_nonces.nonce+1,EXCLUDED.nonce) RETURNING nonce', [wallet, this.clock()])).rows[0];
      const nonce = Number(n.nonce); if (!Number.isSafeInteger(nonce)) throw Error('Nonce unavailable');
      await c.query('INSERT INTO augustus_execution_operations(wallet,cloid,kind,nonce) VALUES($1,$2,$3,$4)', [wallet, cloid, kind, nonce]);
      await this.save(c, job, 'WRITE_RESERVED_' + kind.toUpperCase());
      return { nonce };
    });
  }
  async beforeSend(wallet, executionId, holder, kind) {
    return this.mutate(wallet, executionId, holder, async (job, c) => {
      if (kind === 'entry' && (job.killed || this.clock() >= job.proposal.expiresAt || !(await this.gate(c, wallet)).executionEnabled)) throw Error('Entry cancelled before transmission');
      if (kind === 'entry') {
        const identity = await c.query('SELECT wallet FROM augustus_sessions WHERE token_hash=$1 AND wallet=$2 AND expires_at>now() AND origin=$3', [job.identitySessionHash, wallet, this.config.origin]);
        const saved = (await c.query('SELECT payload FROM augustus_state WHERE wallet=$1', [wallet])).rows[0]?.payload?.session;
        if (!identity.rows.length || !saved?.connected || saved.killed || saved.id !== job.sessionId || saved.entries !== 1 || this.clock() >= saved.expiresAt || this.clock() - saved.heartbeatAt > 30000 || approvalDigest(saved.risk) !== approvalDigest(job.risk)) throw Error('Identity, risk or session changed before entry');
        const row = (await c.query('SELECT payload,worker_healthy,observed_at FROM augustus_context ORDER BY observed_at DESC LIMIT 1')).rows[0];
        if (!row?.worker_healthy || this.clock() - new Date(row.observed_at).getTime() >= 10000) throw Error('Context worker stale');
        const { _history, timestamp: _timestamp, ...values } = row.payload; const { timestamp: _approvedTimestamp, ...approvedValues } = job.proposal.context;
        validateLiveContext(row.payload, this.clock());
        const decision = decideEligibility(row.payload, { direction: job.risk.direction === 'BOTH' ? 'BOTH' : job.risk.direction + '_ONLY' }, this.clock());
        if (approvalDigest(values) !== approvalDigest(approvedValues) || decision.decision !== 'ENTRY_ELIGIBLE' || decision.side !== job.proposal.side) throw Error('Context materially changed before signing');
      }
      return true;
    });
  }
  async ownedEntryOrders(wallet, executionId) { return this.store.transaction(wallet, async c => { const j = await this.load(c, wallet, executionId); return [...(j.ownedEntryOrderIds || []), ...(j.ownedFlatStopIds || [])]; }); }
  async current(wallet, executionId) { return this.store.transaction(wallet, c => this.load(c, wallet, executionId)); }
  async release(wallet, executionId, holder, terminal, healthy = false) {
    await this.store.transaction(wallet, c => c.query("UPDATE augustus_protection_queue SET holder=NULL,lease_until=now()+interval '2 seconds',active=$4,fault=$5,last_checked_at=now() WHERE wallet=$1 AND execution_id=$2 AND holder=$3", [wallet, executionId, holder, !terminal, !healthy]));
  }
  async leader(workerId) { return this.store.transaction(zero, async c => !!(await c.query("INSERT INTO augustus_worker_leases(name,holder,expires_at) VALUES('protection',$1,now()+interval '15 seconds') ON CONFLICT(name) DO UPDATE SET holder=EXCLUDED.holder,expires_at=EXCLUDED.expires_at WHERE augustus_worker_leases.expires_at<now() OR augustus_worker_leases.holder=$1 RETURNING holder", [workerId])).rows.length); }
  async heartbeat(workerId, healthy) { await this.store.transaction(zero, c => c.query("INSERT INTO augustus_protection_health(singleton,healthy,observed_at,worker_id) SELECT true,$1,now(),$2 WHERE EXISTS(SELECT 1 FROM augustus_worker_leases WHERE name='protection' AND holder=$2 AND expires_at>now()) ON CONFLICT(singleton) DO UPDATE SET healthy=EXCLUDED.healthy,observed_at=EXCLUDED.observed_at,worker_id=EXCLUDED.worker_id", [healthy, workerId])); }
}
