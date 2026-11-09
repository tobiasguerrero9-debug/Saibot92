import { createHash, randomBytes } from 'node:crypto';
import { isAddress, verifyMessage } from 'viem';
export const digest = value => createHash('sha256').update(value).digest('hex');
export class HostedAuth {
  constructor({ store, vault, config, verify = verifyMessage }) { Object.assign(this, { store, vault, config, verify }); }
  async challenge(address) {
    if (!isAddress(address)) throw Error('Valid wallet required');
    const wallet = address.toLowerCase(), nonce = randomBytes(24).toString('hex'), expires = Date.now() + 120000;
    const message = `Sign in to AUGUSTUS92\nOrigin: ${this.config.origin}\nEnvironment: ${this.config.stage}\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${expires}\nIdentity only. No trading, transfer, leverage change or agent authorization.`;
    await this.store.transaction(wallet, c => c.query('INSERT INTO augustus_login_challenges (nonce_hash,wallet,message,expires_at) VALUES ($1,$2,$3,$4)', [digest(nonce), wallet, message, new Date(expires)]));
    return { nonce, message };
  }
  async authenticate(input, csrf) {
    if (!isAddress(input.address) || !/^0x[0-9a-f]{130}$/i.test(input.signature || '') || !/^[0-9a-f]{48}$/i.test(input.nonce || '')) throw Error('Invalid wallet proof');
    const wallet = input.address.toLowerCase(), token = randomBytes(32).toString('hex');
    const result = await this.store.transaction(wallet, async c => {
      const q = await c.query('DELETE FROM augustus_login_challenges WHERE nonce_hash=$1 RETURNING wallet,message,expires_at', [digest(input.nonce)]), challenge = q.rows[0];
      if (!challenge || challenge.wallet !== wallet || challenge.message !== input.message || new Date(challenge.expires_at).getTime() <= Date.now()) return { valid: false };
      let valid = false; try { valid = await this.verify({ address: wallet, message: challenge.message, signature: input.signature }); } catch { /* Invalid proof is consumed, never logged. */ }
      if (!valid) return { valid: false };
      await c.query('INSERT INTO augustus_accounts(wallet) VALUES($1) ON CONFLICT DO NOTHING', [wallet]);
      let agent = (await c.query('SELECT address,encrypted FROM augustus_agents WHERE wallet=$1', [wallet])).rows[0];
      if (!agent) { agent = this.vault.provision(wallet); agent.address = agent.address.toLowerCase(); await c.query('INSERT INTO augustus_agents(wallet,address,encrypted) VALUES($1,$2,$3)', [wallet, agent.address, JSON.stringify(agent.encrypted)]); }
      this.vault.verifyMapping(wallet, agent);
      await c.query('INSERT INTO augustus_sessions(token_hash,wallet,csrf_hash,origin,expires_at) VALUES($1,$2,$3,$4,$5)', [digest(token), wallet, digest(csrf), this.config.origin, new Date(Date.now() + 30 * 60000)]);
      return { valid: true, address: wallet, agentAddress: agent.address };
    });
    if (!result.valid) throw Error('Wallet identity could not be verified');
    return { token, address: result.address, agentAddress: result.agentAddress };
  }
  async session(token, csrf = null) {
    if (!/^[0-9a-f]{64}$/i.test(token || '')) throw Error('Sign in required');
    const session = await this.store.transaction('0x0000000000000000000000000000000000000000', async c => (await c.query('SELECT wallet,csrf_hash,origin,expires_at FROM augustus_sessions WHERE token_hash=$1', [digest(token)])).rows[0]);
    if (!session || new Date(session.expires_at).getTime() <= Date.now() || session.origin !== this.config.origin || (csrf && session.csrf_hash !== digest(csrf))) throw Error('Sign in required');
    return session.wallet;
  }
  async logout(token) { if (token) await this.store.transaction('0x0000000000000000000000000000000000000000', c => c.query('DELETE FROM augustus_sessions WHERE token_hash=$1', [digest(token)])); }
}
