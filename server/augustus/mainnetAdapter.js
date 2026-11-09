import { ExchangeClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { MAINNET, validateCanaryProposal } from './mainnetCanary.js';
import { validateLiveContext } from './mainnetContext.js';
import { isAddress } from 'viem';
import { reconcileCollateral, assertCrossLeverage } from './mainnetAccountState.js';
import { isExecutionClient } from './executionCapability.js';

const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const idOK = x => /^0x[0-9a-f]{32}$/i.test(x || '');
export function roundEthOrder(input, market, { reduceOnly = false } = {}) {
  if (input.symbol !== 'ETH-PERP' || !['LONG', 'SHORT'].includes(input.side) || !positive(input.estimatedEntry) || !positive(input.size)) throw Error('Malformed ETH price/size/side.');
  if (market?.name !== 'ETH' || market.isDelisted || !Number.isInteger(market.asset) || market.asset < 0 || !Number.isInteger(market.szDecimals) || market.szDecimals < 0 || market.szDecimals > 6 || !positive(market.maxLeverage)) throw Error('Invalid ETH metadata.');
  if (!Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > Math.min(5, market.maxLeverage)) throw Error('Leverage exceeds ETH canary/exchange cap.');
  const price = formatPrice(input.estimatedEntry, market.szDecimals), size = formatSize(input.size, market.szDecimals);
  if (!positive(Number(price)) || !positive(Number(size)) || Number(size) > input.size || (!reduceOnly && Number(price) * Number(size) < 10)) throw Error('Rounded order is dust or below minimum notional.');
  const stop = input.stopLoss == null ? null : formatPrice(input.stopLoss, market.szDecimals);
  const target = input.takeProfit == null ? null : formatPrice(input.takeProfit, market.szDecimals);
  if (!reduceOnly && (!positive(Number(stop)) || (input.side === 'LONG' ? Number(stop) >= Number(price) : Number(stop) <= Number(price)))) throw Error('Rounded protective stop invalid.');
  if (target !== null && (input.side === 'LONG' ? Number(target) <= Number(price) : Number(target) >= Number(price))) throw Error('Rounded take profit invalid.');
  return { ...input, asset: market.asset, szDecimals: market.szDecimals, estimatedEntry: Number(price), size: Number(size), notionalUsd: Number(price) * Number(size), stopLoss: stop === null ? null : Number(stop), takeProfit: target === null ? null : Number(target), wirePrice: price, wireSize: size };
}

export class MainnetAdapter {
  constructor({ master = MAINNET.master, agent = MAINNET.agent, tenantScoped = false, fetchImpl = globalThis.fetch, clock = Date.now, mockExchange = null, sandbox = false, journal = null, executionClient = null } = {}) {
    if (!isAddress(master) || !isAddress(agent) || master.toLowerCase() === agent.toLowerCase()) throw Error('Invalid account/agent mapping.');
    if (!tenantScoped && (master.toLowerCase() !== MAINNET.master.toLowerCase() || agent.toLowerCase() !== MAINNET.agent.toLowerCase())) throw Error('Dedicated master/agent mismatch.');
    if (mockExchange && !sandbox) throw Error('Mock exchange requires explicit sandbox mode.');
    if (executionClient && (!tenantScoped || !isExecutionClient(executionClient))) throw Error('Verified server execution capability required.');
    this.executionClient = executionClient;
    this.master = master; this.agent = agent; this.fetch = fetchImpl; this.clock = clock; this.sandbox = sandbox === true && !!mockExchange; this.network = this.sandbox ? 'SIMULATION' : 'Mainnet';
    this.used = new Map(); this.entryUsed = false; this.stopped = false; this.journal = journal;
    if (journal?.corrupt) throw Error('Corrupt execution journal.');
    if (journal?.events?.some(e => e.action === 'ADAPTER_WRITE_RESERVED')) { this.entryUsed = true; this.stopped = true; }
    this.exchange = executionClient || mockExchange || new ExchangeClient({
      transport: { isTestnet: false, request() { throw Error('Mainnet exchange writes are build-disabled.'); } },
      wallet: { address: agent, signTypedData() { throw Error('Mainnet signing is disabled.'); } },
    });
  }
  writeGate() { if (!this.sandbox && !isExecutionClient(this.executionClient)) throw Error('Mainnet writes disabled; read-only adapter.'); }
  async info(type, extra = {}) {
    if (!['metaAndAssetCtxs', 'clearinghouseState', 'frontendOpenOrders', 'userFills', 'extraAgents', 'orderStatus', 'spotClearinghouseState', 'userRole', 'activeAssetData', 'userAbstraction'].includes(type)) throw Error('Info request not allowlisted.');
    const response = await this.fetch(MAINNET.info, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...extra }), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw Error('Mainnet read HTTP ' + response.status);
    return response.json();
  }
  async read() {
    const started = this.clock();
    const [meta, account, orders, fills, agents, accountMode, spot, activeAsset] = await Promise.all([this.info('metaAndAssetCtxs'), this.info('clearinghouseState', { user: this.master }), this.info('frontendOpenOrders', { user: this.master }), this.info('userFills', { user: this.master }), this.info('extraAgents', { user: this.master }), this.info('userAbstraction', { user: this.master }), this.info('spotClearinghouseState', { user: this.master }), this.info('activeAssetData', { user: this.master, coin: 'ETH' })]);
    if (!Array.isArray(meta?.[0]?.universe) || !Array.isArray(meta[1]) || meta[0].universe.length !== meta[1].length || !Array.isArray(account?.assetPositions) || !Array.isArray(orders) || !Array.isArray(fills) || !Array.isArray(agents)) throw Error('Incomplete exchange state.');
    const asset = meta[0].universe.findIndex(m => m.name === 'ETH'); const market = { ...meta[0].universe[asset], ...meta[1][asset], asset };
    if (asset < 0 || market.isDelisted || !positive(Number(market.markPx)) || !Number.isInteger(market.szDecimals)) throw Error('ETH metadata unavailable.');
    if (activeAsset?.coin !== 'ETH' || activeAsset.user?.toLowerCase() !== this.master.toLowerCase()) throw Error('ETH active-asset account mismatch.');
    const collateral = reconcileCollateral(accountMode, spot, account, activeAsset);
    const marginMode = ['cross', 'isolated'].includes(activeAsset.leverage?.type) ? activeAsset.leverage.type : 'unknown';
    const currentLeverage = Number.isInteger(activeAsset.leverage?.value) && activeAsset.leverage.value > 0 ? activeAsset.leverage.value : null;
    const positions = account.assetPositions.map(p => p.position);
    if (positions.some(p => !p || !Number.isFinite(Number(p.szi)) || (Number(p.szi) !== 0 && !positive(Number(p.entryPx))))) throw Error('Invalid position state.');
    return { network: 'Mainnet', master: this.master, agent: this.agent, executionEnabled: false, accountAt: started, ordersAt: started, marketAt: started, modeAt: started, activeAssetAt: started, reconciled: true, uncertain: false, accountMode, accountModeSupported: collateral.modeSupported, collateralKnown: collateral.collateralKnown, collateral, equity: collateral.equity, availableMargin: collateral.availableMargin, withdrawable: collateral.reportedPerpWithdrawable, marginMode, currentLeverage, positions: positions.filter(p => Number(p.szi) !== 0), orders, fills, market, account, spot, activeAsset, agentAuthorized: agents.some(a => a.address?.toLowerCase() === this.agent.toLowerCase() && (a.validUntil === null || a.validUntil > this.clock())) };
  }
  async roundedProposal(input, caps) {
    if (!positive(input.emergencySlippageBps) || input.emergencySlippageBps >= 10000) throw Error('Explicit emergency slippage bound required.');
    const state = await this.read(), proposal = roundEthOrder(input, state.market);
    assertCrossLeverage(state, input.leverage);
    validateLiveContext(proposal.context, this.clock());
    if (Math.abs(proposal.estimatedEntry - Number(state.market.markPx)) * proposal.size > proposal.slippageReserveUsd) throw Error('Entry price drift exceeds explicit slippage reserve.');
    validateCanaryProposal(proposal, caps, state, this.clock(), { master: this.master, agent: this.agent }); return proposal;
  }
  reserve(cloid, kind) {
    this.writeGate();
    if (!idOK(cloid) || this.used.has(cloid)) throw Error('Invalid or duplicate CLOID; reconcile instead of replaying.');
    this.journal?.append({ action: 'ADAPTER_WRITE_RESERVED', timestamp: this.clock(), cloid, kind });
    this.used.set(cloid, { kind, uncertain: true });
  }
  async setLeverage(p) {
    this.writeGate(); if (this.stopped) throw Error('STOP AUGUSTUS active.');
    const s = await this.read(); roundEthOrder(p, s.market);
    const result = await this.exchange.updateLeverage({ asset: s.market.asset, leverage: p.leverage, isCross: true });
    if (result?.status !== 'ok') throw Error('Leverage update failed.');
    const active = await this.info('activeAssetData', { user: this.master, coin: 'ETH' });
    if (active?.leverage?.type !== 'cross' || active.leverage.value !== p.leverage) throw Error('Configured CROSS ETH leverage not confirmed.');
    return result;
  }
  async entry(p, caps) {
    this.writeGate(); if (this.entryFlight || this.stopped || this.entryUsed) throw Error('Entry stopped or one-entry slot exhausted.');
    this.entryFlight = true;
    try {
    const s = await this.read(), rounded = roundEthOrder(p, s.market);
    assertCrossLeverage(s, p.leverage);
    if (s.currentLeverage !== p.leverage) throw Error('Approved proposal leverage differs from the reconciled exchange setting.');
    validateLiveContext(p.context, this.clock());
    validateCanaryProposal(p, caps, s, this.clock(), { master: this.master, agent: this.agent });
    if (rounded.estimatedEntry !== p.estimatedEntry || rounded.size !== p.size || rounded.stopLoss !== p.stopLoss || rounded.takeProfit !== (p.takeProfit ?? null)) throw Error('Proposal must be rounded before approval.');
    this.reserve(p.entryCloid, 'entry'); this.entryUsed = true;
    // Leverage normalization is a separate explicitly reviewed infrastructure
    // action, never an implicit mutation inside trade submission.
    const final = await this.read(); validateCanaryProposal(p, caps, final, this.clock(), { master: this.master, agent: this.agent });
    assertCrossLeverage(final, p.leverage);
    if (final.currentLeverage !== p.leverage) throw Error('ETH leverage changed after approval.');
    validateLiveContext(p.context, this.clock());
    if (Math.abs(p.estimatedEntry - Number(final.market.markPx)) * p.size > p.slippageReserveUsd) throw Error('Final entry price drift exceeds reserve.');
    if (this.stopped || final.market.asset !== s.market.asset) throw Error('STOP or changed ETH metadata.');
    this.proposal = structuredClone(p);
    const result = await this.exchange.order({ orders: [{ a: s.market.asset, b: p.side === 'LONG', p: rounded.wirePrice, s: rounded.wireSize, r: false, c: p.entryCloid, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }, { expiresAfter: this.clock() + 10000 });
    if (result?.status !== 'ok' || !Array.isArray(result.response?.data?.statuses) || result.response.data.statuses.some(x => x?.error)) throw Error('Entry rejected/unknown; reconcile CLOID.');
    return result;
    } finally { this.entryFlight = false; }
  }
  async reconcile(cloid) {
    if (!idOK(cloid)) throw Error('Invalid CLOID.');
    const [s, status] = await Promise.all([this.read(), this.info('orderStatus', { user: this.master, oid: cloid })]);
    const order = status?.order?.order, terminal = status?.order?.status;
    if (status?.status !== 'order' || !Number.isSafeInteger(order?.oid) || order.coin !== 'ETH' || !/^(filled|.*[Cc]anceled|.*[Rr]ejected)$/.test(terminal || '')) throw Error('Order outcome uncertain; do not replay.');
    const fills = s.fills.filter(f => f.oid === order.oid && f.coin === 'ETH');
    const identities = new Set(); let size = 0, value = 0;
    for (const f of fills) { if (!positive(Number(f.sz)) || !positive(Number(f.px))) throw Error('Malformed fill.'); const identity = f.tid ?? `${f.hash}:${f.time}:${f.oid}:${f.sz}:${f.px}`; if (identities.has(identity)) continue; identities.add(identity); size += Number(f.sz); value += Number(f.sz) * Number(f.px); }
    const position = s.positions.find(p => p.coin === 'ETH');
    if (!positive(size) || !position || Math.abs(Math.abs(Number(position.szi)) - size) > 1e-9) throw Error('Fill/position mismatch or no fill; reconcile manually.');
    const side = Number(position.szi) > 0 ? 'LONG' : 'SHORT';
    if (fills.some(f => f.side !== (side === 'LONG' ? 'B' : 'A'))) throw Error('Fill side mismatch.');
    return { symbol: 'ETH-PERP', side, size, price: value / size, partial: this.proposal ? size < this.proposal.size : false, terminal, orderId: order.oid };
  }
  async stopConfirmed(p) {
    const s = await this.read(), position = s.positions.find(x => x.coin === 'ETH'); if (!position) return false;
    if (s.positions.length !== 1 || (Number(position.szi) > 0 ? 'LONG' : 'SHORT') !== p.side) return false;
    return s.orders.some(o => o.coin === 'ETH' && o.cloid === p.stopCloid && o.reduceOnly === true && o.isTrigger === true && /Stop/.test(o.orderType || '') && o.side === (Number(position.szi) > 0 ? 'A' : 'B') && Number(o.triggerPx) === p.stopLoss && Math.abs(Number(o.sz) - Math.abs(Number(position.szi))) < 1e-9);
  }
  async protect(p) {
    this.writeGate(); const s = await this.read(), position = s.positions.find(x => x.coin === 'ETH');
    if (!position || s.positions.length !== 1 || (Number(position.szi) > 0 ? 'LONG' : 'SHORT') !== p.side) throw Error('Unexpected ETH exposure.');
    await this.executionClient?.assertManagedPosition(position);
    if (await this.stopConfirmed(p)) return { alreadyProtected: true };
    if (this.used.has(p.stopCloid)) throw Error('Stop outcome already submitted/uncertain; reconcile only.');
    const rounded = roundEthOrder({ ...p, size: Math.abs(Number(position.szi)) }, s.market, { reduceOnly: true });
    if (Number(rounded.wireSize) !== Math.abs(Number(position.szi)) || rounded.stopLoss !== p.stopLoss || (p.side === 'LONG' ? p.stopLoss >= Number(s.market.markPx) : p.stopLoss <= Number(s.market.markPx))) throw Error('Stop rounding, size or trigger invalid.');
    this.reserve(p.stopCloid, 'stop');
    return this.exchange.order({ orders: [{ a: s.market.asset, b: Number(position.szi) < 0, p: formatPrice(p.stopLoss, s.market.szDecimals), s: rounded.wireSize, r: true, c: p.stopCloid, t: { trigger: { isMarket: true, triggerPx: formatPrice(p.stopLoss, s.market.szDecimals), tpsl: 'sl' } } }], grouping: 'na' });
  }
  async cancelEntries(cloid) {
    this.writeGate(); const s = await this.read(); const own = s.orders.filter(o => o.coin === 'ETH' && o.cloid === cloid && o.reduceOnly !== true);
    if (own.some(o => !Number.isSafeInteger(o.oid))) throw Error('Invalid cancel order ID.');
    if (own.length) await this.exchange.cancel({ cancels: own.map(o => ({ a: s.market.asset, o: o.oid })) });
    const after = await this.read(); if (after.orders.some(o => o.cloid === cloid && !o.reduceOnly)) throw Error('Entry cancellation unconfirmed.');
  }
  async emergencyClose(p) {
    this.writeGate(); const s = await this.read(), position = s.positions.find(x => x.coin === 'ETH'); if (!position) return { closed: true };
    if (s.positions.length !== 1 || (Number(position.szi) > 0 ? 'LONG' : 'SHORT') !== p.side) throw Error('Unrelated exposure; close rejected.');
    await this.executionClient?.assertManagedPosition(position);
    const size = formatSize(Math.abs(Number(position.szi)), s.market.szDecimals); if (Number(size) !== Math.abs(Number(position.szi))) throw Error('Close size cannot represent actual position.');
    if (!positive(p.emergencySlippageBps) || p.emergencySlippageBps >= 10000) throw Error('Explicit emergency slippage bound required.');
    this.reserve(p.exitCloid, 'exit'); const buy = Number(position.szi) < 0;
    try { await this.exchange.order({ orders: [{ a: s.market.asset, b: buy, p: formatPrice(Number(s.market.markPx) * (1 + (buy ? 1 : -1) * p.emergencySlippageBps / 10000), s.market.szDecimals), s: size, r: true, c: p.exitCloid, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }); } catch { /* Never replay an ambiguous close. Exchange state decides. */ }
    const after = await this.read(); if (after.positions.some(x => x.coin === 'ETH')) throw Error('Emergency close partial or uncertain; new entries stopped.');
    let closeOrder = null;
    try { closeOrder = await this.info('orderStatus', { user: this.master, oid: p.exitCloid }); } catch { /* Flat state is independently confirmed; do not invent fill attribution. */ }
    const oid = closeOrder?.order?.order?.oid;
    return { closed: true, cloid: p.exitCloid, orderStatus: closeOrder?.order?.status || 'UNCONFIRMED', fills: Number.isSafeInteger(oid) ? after.fills.filter(f => f.coin === 'ETH' && f.oid === oid) : [], flatObservedAt: this.clock() };
  }
  async cleanupProtection(p) {
    this.writeGate(); const state = await this.read();
    if (state.positions.some(x => x.coin === 'ETH')) throw Error('Cannot remove protection while ETH exposure exists');
    const owned = state.orders.filter(o => o.coin === 'ETH' && o.cloid === p.stopCloid && o.reduceOnly === true);
    if (owned.some(o => !Number.isSafeInteger(o.oid))) throw Error('Invalid stop order identity');
    if (owned.length) await this.exchange.cancel({ cancels: owned.map(o => ({ a: state.market.asset, o: o.oid })) });
    const after = await this.read(); if (after.positions.some(x => x.coin === 'ETH') || after.orders.some(o => o.cloid === p.stopCloid)) throw Error('Flat protection cleanup unconfirmed');
  }
  async stop() { this.stopped = true; try { await this.cancelEntries(this.proposal?.entryCloid); } finally { if (this.proposal && !await this.stopConfirmed(this.proposal)) await this.emergencyClose(this.proposal); } }
}
