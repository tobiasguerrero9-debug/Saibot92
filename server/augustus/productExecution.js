import { MainnetCanary } from './mainnetCanary.js';

// Tested bridge from exact user proposal to the existing one-entry/protection
// lifecycle. Real adapters cannot construct this executor in this release.
export class ProductExecution {
  constructor({ gateway, audit, clock = Date.now }) {
    if (gateway.network !== 'SIMULATION') throw Error('Live execution is disabled in this release.');
    this.network = 'SIMULATION'; this.gateway = gateway; this.audit = audit; this.clock = clock;
    this.controller = new MainnetCanary({ gateway, audit, clock, simulation: true, env: { AUGUSTUS_MODE: 'MAINNET_CANARY', AUGUSTUS_ACK_MAINNET: 'true', AUGUSTUS_ENABLE_MAINNET_EXECUTION: 'true' } });
  }
  async run(proposal, risk) {
    this.controller.configure({ MAX_NOTIONAL_USD: risk.maxNotionalUsd, MAX_LOSS_USD: risk.maxLossUsd });
    await this.controller.arm();
    const bound = await this.controller.propose(proposal);
    await this.controller.approveAndExecute({ approved: true, proposalHash: bound.proposalHash });
    if (this.controller.state !== 'PROTECTED') throw Error('Position protection is not confirmed.');
    return { status: 'PROTECTED', proposal: bound.proposal, startedAt: this.clock(), position: (await this.gateway.read()).positions.find(p => p.coin === 'ETH') };
  }
  async cancelOwnedEntries() { const p = this.controller.proposal && JSON.parse(this.controller.proposal); if (p) await this.gateway.cancelEntries(p.entryCloid); }
  async emergencyClose({ reduceOnly }) {
    if (reduceOnly !== true || !this.controller.proposal) throw Error('Owned position and reduce-only close required.');
    const p = JSON.parse(this.controller.proposal); await this.gateway.emergencyClose({ ...p, reduceOnly: true });
    if ((await this.gateway.read()).positions.some(x => x.coin === 'ETH')) throw Error('Close is unconfirmed.');
  }
  async monitor() {
    const state = await this.gateway.read(), p = this.controller.proposal && JSON.parse(this.controller.proposal);
    if (!p) return { protected: false, position: null };
    const position = state.positions.find(x => x.coin === 'ETH');
    if (!position) { this.controller.stopped = true; return { protected: false, position: null }; }
    if (!await this.gateway.stopConfirmed(p)) {
      await this.emergencyClose({ reduceOnly: true }); this.controller.stopped = true; throw Error('Unprotected position emergency-closed.');
    }
    return { protected: true, position };
  }
}
