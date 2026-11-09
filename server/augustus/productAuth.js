import { randomBytes } from 'node:crypto';
import { verifyMessage } from 'viem';
import { MAINNET } from './mainnetCanary.js';
export class ProductAuth {
  constructor({ clock = Date.now, verify = verifyMessage } = {}) { this.clock = clock; this.verify = verify; this.challenges = new Map(); this.sessions = new Map(); }
  challenge(address) {
    if (address?.toLowerCase() !== MAINNET.master.toLowerCase()) throw Error('Connect the dedicated Augustus master wallet.');
    if (this.challenges.size > 20) this.challenges.clear();
    const nonce = randomBytes(24).toString('hex');
    const message = `Sign in to AUGUSTUS92\nWallet: ${MAINNET.master}\nNonce: ${nonce}\nExpires: ${this.clock() + 120000}\nIdentity verification only. This does not authorize trading, transfers, agent delegation or leverage changes.`;
    this.challenges.set(nonce, { message, expiresAt: this.clock() + 120000 }); return { nonce, message };
  }
  async authenticate({ address, nonce, message, signature }) {
    const challenge = this.challenges.get(nonce); this.challenges.delete(nonce);
    if (address?.toLowerCase() !== MAINNET.master.toLowerCase() || !challenge || message !== challenge.message || this.clock() > challenge.expiresAt || !/^0x[0-9a-f]{130}$/i.test(signature || '')) throw Error('Wallet sign-in expired or invalid.');
    if (!await this.verify({ address: MAINNET.master, message, signature })) throw Error('Wallet ownership could not be verified.');
    const token = randomBytes(32).toString('hex'); this.sessions.set(token, { address: MAINNET.master, expiresAt: this.clock() + 30 * 60000 }); return { token, address: MAINNET.master };
  }
  address(header) { const token = header?.replace(/^Bearer /, ''), session = this.sessions.get(token); if (!session || this.clock() > session.expiresAt) { this.sessions.delete(token); throw Error('Connect your wallet to continue.'); } return session.address; }
  logout(header) { this.sessions.delete(header?.replace(/^Bearer /, '')); }
}
