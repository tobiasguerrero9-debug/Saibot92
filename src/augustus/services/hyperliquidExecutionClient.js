// Browser transport only: signing is confined to the local server.
export class HyperliquidExecutionClient {
  constructor({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) { this.fetch = fetchImpl; this.token = null; this.pending = new Set(); }
  async request(path, body) {
    const response = await this.fetch(`/api/augustus${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Local service HTTP ${response.status}`);
    return data;
  }
  config() { return this.request('/config'); }
  async authenticate(provider, address) {
    const { message } = await this.request('/challenge', { address });
    const signature = await provider.request({ method: 'personal_sign', params: [`0x${Array.from(new TextEncoder().encode(message), b => b.toString(16).padStart(2, '0')).join('')}`, address] });
    const data = await this.request('/session', { address, message, signature }); this.token = data.token; return data;
  }
  snapshot() { return this.request('/snapshot'); }
  propose(input) { return this.request('/proposal', input); }
  async approve(proposalId) {
    if (this.pending.has(proposalId)) throw new Error('Proposal already being submitted.');
    this.pending.add(proposalId);
    // Never retry automatically after a timeout; server uses single-use proposals.
    try { return await this.request('/approve', { proposalId, approved: true }); } finally { this.pending.delete(proposalId); }
  }
  manage(action, symbol, orderId) { return this.request('/manage', { action, symbol, orderId, approved: true }); }
  async disconnect() { const previous = this.token; try { if (previous) await this.request('/logout', {}); } finally { if (this.token === previous) this.token = null; } }
}
