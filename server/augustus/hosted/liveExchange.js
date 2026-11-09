import { ExchangeClient } from '@nktkas/hyperliquid';
import { MAINNET } from '../mainnetCanary.js';
import { registerExecutionClient } from '../executionCapability.js';

// Only execution-worker code constructs this client. No arbitrary SDK method,
// endpoint, destination, builder fee or action is accepted from the browser.
export function createLiveExchange({ wallet, record, vault, repository, job, holder, fetchImpl = fetch, clock = Date.now }) {
  async function send(kind, params, cloid) {
    const operation = await repository.reserveOperation(wallet, job.executionId, holder, { kind, cloid });
    try {
      return await vault.withSigner(wallet, record, async signer => {
        if (signer.address.toLowerCase() !== job.agent.toLowerCase()) throw Error('Agent isolation violation');
        const client = new ExchangeClient({ wallet: signer, nonceManager: async () => operation.nonce, defaultExpiresAfter: () => clock() + 5000, transport: {
          isTestnet: false,
          async request(endpoint, payload) {
            if (endpoint !== 'exchange' || !['order', 'cancel'].includes(payload.action?.type) || payload.vaultAddress || payload.action.builder || !payload.expiresAfter || payload.expiresAfter > clock() + 6000) throw Error('Exchange action rejected');
            await repository.beforeSend(wallet, job.executionId, holder, kind);
            const response = await fetchImpl(MAINNET.exchange, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000), redirect: 'error' });
            if (!response.ok) throw Error('Exchange submission uncertain');
            return response.json();
          },
        } });
        return kind === 'cancel' ? client.cancel(params) : client.order(params);
      });
    } catch { throw Error('Exchange action rejected or outcome uncertain; reconcile persisted operation.'); }
  }
  return registerExecutionClient({
    async assertManagedPosition(position) {
      const current = await repository.current(wallet, job.executionId), size = Math.abs(Number(position.szi));
      if (!current.managed || !current.fill || !Number.isFinite(size) || size <= 0 || size > current.fill.size + 1e-9 || (Number(position.szi) > 0 ? 'LONG' : 'SHORT') !== current.proposal.side || Math.abs(Number(position.entryPx) - current.fill.price) > Math.max(1e-8, current.fill.price * 1e-6)) throw Error('Managed position ownership cannot be confirmed');
    },
    async order(params) {
      if (params.grouping !== 'na' || params.builder || params.orders?.length !== 1) throw Error('One ETH order required');
      const o = params.orders[0], current = await repository.current(wallet, job.executionId), p = current.proposal;
      if (o.a !== p.asset || !(Number(o.s) > 0) || !(Number(o.p) > 0)) throw Error('ETH metadata/size/price mismatch');
      let kind;
      if (o.c === p.entryCloid) {
        kind = 'entry';
        if (o.r !== false || o.b !== (p.side === 'LONG') || o.t?.limit?.tif !== 'Ioc' || Number(o.s) !== p.size || Number(o.p) !== p.estimatedEntry) throw Error('Entry differs from approved proposal');
      } else if (o.c === p.stopCloid) {
        kind = 'stop';
        if (o.r !== true || o.b !== (p.side === 'SHORT') || o.t?.trigger?.tpsl !== 'sl' || o.t.trigger.isMarket !== true || Number(o.t.trigger.triggerPx) !== p.stopLoss || Number(o.s) > p.size || !current.managed || Number(o.s) > current.fill.size + 1e-9) throw Error('Invalid protective stop');
      } else if (o.c === (current.retryExitCloid || p.exitCloid)) {
        kind = 'exit';
        if (o.r !== true || o.b !== (p.side === 'SHORT') || o.t?.limit?.tif !== 'Ioc' || Number(o.s) > p.size || !current.managed || Number(o.s) > current.fill.size + 1e-9) throw Error('Invalid reduce-only close');
      } else throw Error('Unknown execution CLOID');
      return send(kind, params, o.c);
    },
    async cancel(params) {
      const owned = await repository.ownedEntryOrders(wallet, job.executionId);
      if (!params.cancels?.length || params.cancels.some(c => c.a !== job.proposal.asset || !owned.includes(c.o))) throw Error('Only owned entry orders may be cancelled');
      return send('cancel', params, 'cancel:' + params.cancels.map(c => c.o).sort().join(','));
    },
  });
}
