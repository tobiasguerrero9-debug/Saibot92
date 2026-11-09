// Public configuration only. No signing keys belong in this module or VITE_*.
export const TOKEN_CONTRACT_ADDRESS = '0x7673a00106c99d1e00b85496f9f495076873b654';
export const TOKEN_CHAIN_ID = 4663;
export const TOKEN_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
export const MIN_HOLDER_BALANCE = '1';
export const TESTNET_INFO_URL = 'https://api.hyperliquid-testnet.xyz/info';
export const TESTNET_WS_URL = 'wss://api.hyperliquid-testnet.xyz/ws';
export const DEFAULT_RISK = Object.freeze({
  maxRiskPerTradePercent: 0.5, maxLeverage: 3, maxDailyLossPercent: 2,
  maxConcurrentPositions: 1, allowedMarkets: ['BTC', 'ETH'],
  stopLossRequired: true, maxPositionNotional: 100, maxPriceAgeMs: 10000,
  maxSlippagePercent: 0.1, costBufferPercent: 0.2,
});
