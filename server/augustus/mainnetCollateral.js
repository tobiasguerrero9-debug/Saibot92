import * as v from 'valibot';
import { UsdClassTransferRequest } from '@nktkas/hyperliquid/api/exchange';
import { MAINNET } from './mainnetCanary.js';
export function prepareCollateralTransfer(amount, availableSpot, now = Date.now(), accountMode) {
  if (accountMode !== 'disabled') throw Error('Collateral transfer preparation requires verified Standard mode; Unified/unknown accounts must not use this path.');
  if (typeof amount !== 'string' || !/^\d+(\.\d{1,8})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !Number.isFinite(Number(availableSpot)) || Number(amount) > Number(availableSpot) || !Number.isSafeInteger(now)) throw Error('Explicit valid USDC amount within available spot balance required.');
  const action = { type: 'usdClassTransfer', hyperliquidChain: 'Mainnet', signatureChainId: '0xa4b1', amount, toPerp: true, nonce: now };
  v.parse(UsdClassTransferRequest.entries.action, action);
  return { master: MAINNET.master, endpoint: MAINNET.exchange, network: 'Mainnet', action, nonce: now, internalTransfer: true, externalDeposit: false, trade: false, signed: false, submitted: false, approvalRequired: true };
}
export function collateralTemplate(accountMode) {
  if (accountMode !== 'disabled') return { action: null, readyToSign: false, required: accountMode === 'unifiedAccount' ? false : null, amountChosen: false, reason: 'No transfer prepared for Unified or unknown account modes.' };
  return { master: MAINNET.master, endpoint: MAINNET.exchange, action: { type: 'usdClassTransfer', hyperliquidChain: 'Mainnet', signatureChainId: '0xa4b1', amount: '<USER_SELECTED_USDC_AMOUNT>', toPerp: true, nonce: '<FRESH_NUMERIC_TIMESTAMP>' }, readyToSign: false, amountChosen: false, approvalRequired: true, internalTransfer: true, externalDeposit: false, trade: false, fees: 'No trading or external bridge withdrawal occurs. The action schema specifies no transfer-fee field; no separate internal-transfer fee was established from official documentation.' };
}
