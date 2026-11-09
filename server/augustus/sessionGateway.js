import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { sizePosition } from '../../src/augustus/risk/positionSizer.js';
import { parseExecutionResponse, parseOrderStatus } from '../../src/augustus/execution/responseParser.js';
import { SESSION_LIMITS } from './sessionPolicy.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export class SessionGateway {
  constructor({ exchange, info, snapshot, delay = wait }) { Object.assign(this, { exchange, info, snapshot, delay }); }
  async read(owner) {
    const [account, markets] = await Promise.all([this.info.account(owner), this.info.markets()]);
    const market = markets.find(m => m.name === 'ETH');
    if (!market || !Number.isFinite(Number(market.markPx)) || Number(market.markPx) <= 0 || !Number.isInteger(market.szDecimals)) throw new Error('ETH metadata unavailable.');
    if (!account.positions.every(p => Number.isFinite(Number(p.szi)) && Number.isFinite(Number(p.entryPx)) && Number(p.entryPx) > 0 && Number.isFinite(Number(p.leverage?.value)) && Number(p.leverage.value) > 0)) throw new Error('Invalid position size/entry/leverage.');
    return { account, market, position: account.positions.find(p => p.coin === 'ETH') || null };
  }
  async movements(owner, startTime) { return this.info.request({ type: 'userNonFundingLedgerUpdates', user: owner, startTime }); }
  prepare(session, snapshot, side) {
    const config = session.config, market = snapshot.markets.find(m => m.name === 'ETH');
    const entry = Number(formatPrice(Number(market.markPx) * (side === 'LONG' ? 1 + SESSION_LIMITS.slippage : 1 - SESSION_LIMITS.slippage), market.szDecimals));
    const stop = Number(formatPrice(config.stopLoss, market.szDecimals));
    const target = config.takeProfit === null ? null : Number(formatPrice(config.takeProfit, market.szDecimals));
    if ((side === 'LONG' && stop >= Number(market.markPx)) || (side === 'SHORT' && stop <= Number(market.markPx))) throw new Error('Protective stop must be on the protective side of the current mark.');
    if ((side === 'LONG' && (stop >= entry || (target !== null && target <= entry))) || (side === 'SHORT' && (stop <= entry || (target !== null && target >= entry)))) throw new Error('Stop/target is on the wrong side for the eligible direction.');
    if (config.maxLeverage > market.maxLeverage) throw new Error('Exchange leverage ceiling exceeded.');
    const remainingRisk = session.lossBudgetUsd - Math.max(0, session.startEquity - snapshot.account.equity);
    const sizing = sizePosition({ accountEquity: snapshot.account.equity, availableMargin: snapshot.account.availableMargin, entry, stop, riskPercent: remainingRisk / snapshot.account.equity * 100, leverage: config.maxLeverage, maxNotional: config.maxPositionUsd, szDecimals: market.szDecimals, costBufferPercent: SESSION_LIMITS.costRate * 100 });
    if (sizing.maxLoss > remainingRisk + 1e-8 || sizing.positionNotional > config.maxPositionUsd + 1e-8) throw new Error('Rounded proposal exceeds armed envelope.');
    return { symbol: 'ETH', side, entry, stop, target, leverage: config.maxLeverage, asset: market.asset, szDecimals: market.szDecimals, ...sizing };
  }
  async setLeverage(proposal) { if (!this.exchange) throw new Error('TESTNET signer unavailable.'); return this.exchange.updateLeverage({ asset: proposal.asset, leverage: proposal.leverage, isCross: true }); }
  async submitEntry(proposal, cloid, expiresAt) {
    return parseExecutionResponse(await this.exchange.order({ orders: [{ a: proposal.asset, b: proposal.side === 'LONG', p: formatPrice(proposal.entry, proposal.szDecimals), s: formatSize(proposal.size, proposal.szDecimals), r: false, c: cloid, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }, { expiresAfter: expiresAt }));
  }
  async reconcileEntry(owner, cloid, size) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      const [read, raw] = await Promise.all([this.read(owner), this.info.orderStatus(owner, cloid)]);
      last = { ...read, order: parseOrderStatus(raw, size), rawStatus: raw };
      if (read.position || ['FILLED', 'CANCELED', 'REJECTED'].includes(last.order.status)) return last;
      await this.delay(200);
    }
    return last;
  }
  protection(read, stopPrice, expectedSide) {
    if (!read.position) return null;
    const position = read.position, size = Math.abs(Number(position.szi));
    if (expectedSide && (Number(position.szi) > 0 ? 'LONG' : 'SHORT') !== expectedSide) return null;
    return read.account.orders.find(order => order.coin === 'ETH' && order.reduceOnly === true && order.isTrigger === true && String(order.orderType).includes('Stop') && Number(order.triggerPx) === stopPrice && Number(order.sz) + 1e-9 >= size && order.side === (Number(position.szi) > 0 ? 'A' : 'B')) || null;
  }
  actualRisk(read, stopPrice) {
    if (!read.position) return 0;
    const p = read.position, entry = Number(p.entryPx), size = Math.abs(Number(p.szi));
    return Math.abs(entry - stopPrice) * size + entry * size * SESSION_LIMITS.costRate;
  }
  async submitProtection(read, price, kind, cloid) {
    if (!read.position || !Number.isFinite(price) || price <= 0) throw new Error('No valid position/trigger.');
    const size = Math.abs(Number(read.position.szi)), buy = Number(read.position.szi) < 0;
    if ((kind === 'sl' && (buy ? price <= Number(read.market.markPx) : price >= Number(read.market.markPx))) || (kind === 'tp' && (buy ? price >= Number(read.market.markPx) : price <= Number(read.market.markPx)))) throw new Error('Trigger would fire immediately or is invalid.');
    return parseExecutionResponse(await this.exchange.order({ orders: [{ a: read.market.asset, b: buy, p: formatPrice(price, read.market.szDecimals), s: formatSize(size, read.market.szDecimals), r: true, c: cloid, t: { trigger: { isMarket: true, triggerPx: formatPrice(price, read.market.szDecimals), tpsl: kind } } }], grouping: 'na' }));
  }
  async confirmProtection(owner, price, side) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const read = await this.read(owner), stop = this.protection(read, price, side);
      if (!read.position || stop) return { ...read, stop };
      // Read retries only: an ambiguous write is never replayed.
      await this.delay(200);
    }
    return null;
  }
  async cancelEntries(owner, entryCloid, entryOrderId) {
    const ownOrder = order => order.coin === 'ETH' && !order.reduceOnly && ((entryCloid && order.cloid === entryCloid) || (Number.isSafeInteger(entryOrderId) && order.oid === entryOrderId));
    const read = await this.read(owner), orders = read.account.orders.filter(ownOrder);
    if (orders.length) await this.exchange.cancel({ cancels: orders.map(o => ({ a: read.market.asset, o: o.oid })) });
    const after = await this.read(owner);
    if (after.account.orders.some(ownOrder)) throw new Error('Pending entry cancellation not confirmed.');
    return after;
  }
  async close(owner, cloid) {
    const before = await this.read(owner);
    if (!before.position) return { ...before, closed: true };
    const buy = Number(before.position.szi) < 0;
    let submissionError = false;
    try {
      await this.exchange.order({ orders: [{ a: before.market.asset, b: buy, p: formatPrice(Number(before.market.markPx) * (buy ? 1.005 : 0.995), before.market.szDecimals), s: formatSize(Math.abs(Number(before.position.szi)), before.market.szDecimals), r: true, c: cloid, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' });
    } catch { submissionError = true; }
    const read = await this.reconcileEntry(owner, cloid, Math.abs(Number(before.position.szi)));
    return { ...read, closed: !read.position, submissionError };
  }
  async cleanupFlat(owner, { orderIds = [], cloids = [] } = {}) {
    const read = await this.read(owner);
    if (read.position) throw new Error('Position still open; protection retained.');
    const protective = read.account.orders.filter(o => o.coin === 'ETH' && o.reduceOnly && (orderIds.includes(o.oid) || cloids.includes(o.cloid)));
    if (protective.length) await this.exchange.cancel({ cancels: protective.map(o => ({ a: read.market.asset, o: o.oid })) });
    const after = await this.read(owner);
    return { ...after, clean: !after.position && !after.account.orders.some(o => o.coin === 'ETH') };
  }
}
