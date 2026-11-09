import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { isAddress } from 'viem';
export class AgentVault {
  constructor(config) { this.config = config; }
  aad(wallet, agent) { return Buffer.from(`${this.config.stage}:${this.config.databaseScope}:${wallet.toLowerCase()}:${agent.toLowerCase()}:${this.config.keyId}`); }
  provision(wallet) {
    if (!isAddress(wallet)) throw Error('Invalid wallet mapping');
    const raw = Buffer.from(generatePrivateKey().slice(2), 'hex');
    try {
      const address = privateKeyToAccount('0x' + raw.toString('hex')).address;
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.config.key, iv); cipher.setAAD(this.aad(wallet, address));
      const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()]);
      return { address, encrypted: { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), keyId: this.config.keyId } };
    } finally { raw.fill(0); }
  }
  verifyMapping(wallet, record) {
    if (!isAddress(wallet) || !isAddress(record.address) || record.encrypted?.keyId !== this.config.keyId) throw Error('Agent mapping unavailable');
    let raw;
    try { const d = createDecipheriv('aes-256-gcm', this.config.key, Buffer.from(record.encrypted.iv, 'base64')); d.setAAD(this.aad(wallet, record.address)); d.setAuthTag(Buffer.from(record.encrypted.tag, 'base64')); raw = Buffer.concat([d.update(Buffer.from(record.encrypted.ciphertext, 'base64')), d.final()]); if (privateKeyToAccount('0x' + raw.toString('hex')).address.toLowerCase() !== record.address.toLowerCase()) throw Error(); return true; }
    catch { throw Error('Agent mapping verification failed'); } finally { raw?.fill(0); }
  }
  publicRecord(record) { return { address: record.address }; }
  async withSigner(wallet, record, operation) {
    this.verifyMapping(wallet, record);
    let raw;
    try {
      const d = createDecipheriv('aes-256-gcm', this.config.key, Buffer.from(record.encrypted.iv, 'base64'));
      d.setAAD(this.aad(wallet, record.address)); d.setAuthTag(Buffer.from(record.encrypted.tag, 'base64'));
      raw = Buffer.concat([d.update(Buffer.from(record.encrypted.ciphertext, 'base64')), d.final()]);
      // Only the scoped operation receives the signer. It never crosses an API boundary.
      const account = privateKeyToAccount('0x' + raw.toString('hex'));
      return await operation({ address: account.address, signTypedData: parameters => account.signTypedData(parameters) });
    } finally { raw?.fill(0); }
  }
}
