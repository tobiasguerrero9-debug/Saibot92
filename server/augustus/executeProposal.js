import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { checkProposal } from './domain.js';
import { parseExecutionResponse, parseOrderStatus } from '../../src/augustus/execution/responseParser.js';

// Called only inside the server's single-use approval guard. Adapters are injectable for tests.
export async function executeApprovedProposal({ stored, address, snapshot, exchange, info, audit, setUncertain, executionEnabled, uncertain }) {
  const { proposal: p, settings } = stored;
  if (!executionEnabled || uncertain) throw new Error('Execution disabled or prior submission requires reconciliation.');
  const snap = await snapshot(address), risk = checkProposal(p, snap, settings);
  if (risk.decision !== 'ALLOW') return { status: 'REJECTED', risk };
  const m = snap.markets.find(market => market.name === p.symbol);
  await exchange.updateLeverage({ asset: m.asset, isCross: true, leverage: p.leverage });
  const fresh = await snapshot(address), finalRisk = checkProposal(p, fresh, settings);
  if (finalRisk.decision !== 'ALLOW') return { status: 'REJECTED', risk: finalRisk };
  const isBuy = p.side === 'LONG', px = value => formatPrice(value, m.szDecimals), sz = formatSize(p.size, m.szDecimals);
  const entry = { a: m.asset, b: isBuy, p: px(p.entry), s: sz, r: false, t: { limit: { tif: p.orderType === 'market' ? 'Ioc' : 'Gtc' } }, c: p.cloid };
  const trigger = (price, kind) => ({ a: m.asset, b: !isBuy, p: px(price), s: sz, r: true, t: { trigger: { isMarket: true, triggerPx: px(price), tpsl: kind } } });
  audit({ proposalId: p.id, symbol: p.symbol, side: p.side, entry: p.entry, size: p.size, risk: p.maxLoss, userApproval: true, cloid: p.cloid, status: 'SUBMITTED' });
  setUncertain(true);
  // SDK-supported expiry limits delayed acceptance of an approved proposal.
  const response = parseExecutionResponse(await exchange.order({ orders: [entry, trigger(p.stop, 'sl'), trigger(p.target, 'tp')], grouping: 'normalTpsl' }, { expiresAfter: p.expiresAt }));
  const verified = parseOrderStatus(await info.orderStatus(address, p.cloid), p.size);
  const account = await info.account(address);
  const position = account.positions.find(item => item.coin === p.symbol);
  const protective = account.orders.filter(order => order.coin === p.symbol && order.reduceOnly);
  const protectionVerified = !position || protective.some(order => order.isTrigger && Number(order.triggerPx) === p.stop);
  const isUncertain = ['FAILED', 'REJECTED', 'SUBMITTED'].includes(verified.status) || response.status === 'FAILED' || response.orders?.length !== 3 || !protectionVerified;
  setUncertain(isUncertain);
  audit({ proposalId: p.id, status: verified.status, orderId: verified.orderId, uncertain: isUncertain });
  return { proposalId: p.id, status: verified.status, orderId: verified.orderId, response, verified, account, protectionVerified, uncertain: isUncertain };
}
