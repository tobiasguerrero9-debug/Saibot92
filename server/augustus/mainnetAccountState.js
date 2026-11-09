import * as v from 'valibot';
import { UpdateLeverageRequest } from '@nktkas/hyperliquid/api/exchange';
import { MAINNET } from './mainnetCanary.js';
import { validateLiveContext } from './mainnetContext.js';
const nonnegative = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
export function reconcileCollateral(mode, spot, account, active) {
  if (!Array.isArray(spot?.balances)) throw Error('Spot balances unavailable.');
  const usdc = spot.balances.find(b => b.coin === 'USDC' && b.token === 0);
  const total = usdc ? Number(usdc.total) : 0, hold = usdc ? Number(usdc.hold) : 0;
  if (usdc && (!nonnegative(usdc.total) || !nonnegative(usdc.hold))) throw Error('Invalid spot USDC total/hold.');
  const assetAvailable = Array.isArray(active?.availableToTrade) && active.availableToTrade.length === 2 && active.availableToTrade.every(nonnegative) ? active.availableToTrade.map(Number) : null;
  const maintenanceRow = spot.tokenToAvailableAfterMaintenance?.find(row => Array.isArray(row) && row[0] === 0);
  const maintenanceAvailable = maintenanceRow && nonnegative(maintenanceRow[1]) ? Number(maintenanceRow[1]) : null;
  const perpEquity = nonnegative(account?.marginSummary?.accountValue) ? Number(account.marginSummary.accountValue) : null;
  const perpUsed = nonnegative(account?.marginSummary?.totalMarginUsed) ? Number(account.marginSummary.totalMarginUsed) : null;
  const rawPerpWithdrawable = nonnegative(account?.withdrawable) ? Number(account.withdrawable) : null;
  const supported = mode === 'unifiedAccount' || mode === 'disabled';
  const known = supported && !!assetAvailable && (mode === 'unifiedAccount' ? maintenanceAvailable !== null : [perpEquity, perpUsed, rawPerpWithdrawable].every(x => x !== null));
  const free = Math.max(0, total - hold);
  const available = !known ? 0 : mode === 'unifiedAccount' ? Math.min(free, maintenanceAvailable, ...assetAvailable) : Math.max(0, Math.min(perpEquity - perpUsed, rawPerpWithdrawable, ...assetAvailable));
  return { mode, modeSupported: supported, collateralKnown: known, collateralSource: mode === 'unifiedAccount' ? 'spotClearinghouseState + tokenToAvailableAfterMaintenance + ETH activeAssetData' : mode === 'disabled' ? 'standard perpetual margin + ETH activeAssetData' : 'Unsupported mode; fail closed without falling back to standard accounting', spotUSDC: total, spotHoldUSDC: hold, spotFreeUSDC: free, maintenanceAvailableUSDC: maintenanceAvailable, ethAvailableToTrade: assetAvailable, reportedPerpEquity: perpEquity, reportedPerpWithdrawable: rawPerpWithdrawable, equity: mode === 'unifiedAccount' ? total : perpEquity ?? 0, availableMargin: available, transferRequired: mode === 'unifiedAccount' ? false : null };
}
export function assertCrossLeverage(snapshot, userCap = 5) {
  if (!Number.isInteger(userCap) || userCap < 1 || userCap > 5) throw Error('User leverage cap must be 1–5x.');
  if (snapshot.marginMode !== 'cross' || !Number.isInteger(snapshot.currentLeverage) || snapshot.currentLeverage < 1 || snapshot.currentLeverage > userCap || snapshot.currentLeverage > 5) throw Error('ETH CROSS leverage must be known and at or below the user cap and 5x.');
}
export function authorizationReadiness(snapshot, context, userCap = 5, now = Date.now(), identity = MAINNET) {
  const reasons = [];
  if (snapshot.network !== 'Mainnet' || snapshot.master?.toLowerCase() !== identity.master.toLowerCase() || snapshot.agent?.toLowerCase() !== identity.agent.toLowerCase() || snapshot.market?.name !== 'ETH') reasons.push('Mainnet ETH account mapping mismatch.');
  if (!snapshot.collateralKnown || !snapshot.accountModeSupported || !(snapshot.availableMargin > 0)) reasons.push('Known supported account mode and positive usable collateral required.');
  try { assertCrossLeverage(snapshot, userCap); } catch (e) { reasons.push(e.message); }
  if (!Array.isArray(snapshot.positions) || !Array.isArray(snapshot.orders) || snapshot.positions.length || snapshot.orders.length) reasons.push('Flat account with no open orders required.');
  if (snapshot.reconciled !== true || snapshot.uncertain || [snapshot.accountAt, snapshot.ordersAt, snapshot.marketAt, snapshot.modeAt, snapshot.activeAssetAt].some(t => !Number.isFinite(t) || t > now || now - t > 10000)) reasons.push('Fresh reconciled account, mode, leverage and market state required.');
  try { validateLiveContext(context, now); } catch (e) { reasons.push(e.message); }
  if (snapshot.executionEnabled !== false) reasons.push('Execution must remain explicitly disabled.');
  return { authorizationReady: reasons.length === 0, reasons, userLeverageCap: userCap, executionEnabled: false };
}
export function prepareCrossLeverageUpdate(snapshot, userCap = 5, now = Date.now()) {
  if (!Number.isInteger(userCap) || userCap < 1 || userCap > 5 || snapshot.market?.name !== 'ETH' || !Number.isInteger(snapshot.market.asset) || userCap > snapshot.market.maxLeverage || snapshot.network !== 'Mainnet' || snapshot.master?.toLowerCase() !== MAINNET.master.toLowerCase() || !Number.isSafeInteger(now)) throw Error('Invalid ETH leverage normalization review.');
  const action = { type: 'updateLeverage', asset: snapshot.market.asset, isCross: true, leverage: userCap };
  v.parse(UpdateLeverageRequest.entries.action, action);
  return { master: MAINNET.master, agent: MAINNET.agent, intendedSigner: MAINNET.master, network: 'Mainnet', endpoint: MAINNET.exchange, symbol: 'ETH-PERP', currentMarginMode: snapshot.marginMode, currentLeverage: snapshot.currentLeverage, targetMarginMode: 'cross', targetLeverage: userCap, action, nonce: now, approvalRequired: true, signed: false, submitted: false, orders: false, transfers: false, executionEnabled: false };
}
