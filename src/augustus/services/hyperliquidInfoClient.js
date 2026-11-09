import { TESTNET_INFO_URL, TESTNET_WS_URL } from '../config.js';
import { isAddress } from './holderAccessService.js';

export class HyperliquidInfoClient {
  constructor({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) { this.fetch = fetchImpl; }
  async request(body) {
    const response = await this.fetch(TESTNET_INFO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Hyperliquid TESTNET HTTP ${response.status}`);
    return response.json();
  }
  async markets() {
    const data = await this.request({ type: 'metaAndAssetCtxs' });
    if (!Array.isArray(data) || !Array.isArray(data[0]?.universe) || !Array.isArray(data[1]) || data[0].universe.length !== data[1].length) throw new Error('Inconsistent market metadata.');
    return data[0].universe.map((meta, index) => ({ ...meta, asset: index, ...data[1][index], receivedAt: Date.now() })).filter(m => !m.isDelisted);
  }
  async account(user) {
    if (!isAddress(user)) throw new Error('Valid master account address required.');
    const [state, orders, fills] = await Promise.all([
      this.request({ type: 'clearinghouseState', user }), this.request({ type: 'frontendOpenOrders', user }), this.request({ type: 'userFills', user }),
    ]);
    const equity = Number(state?.marginSummary?.accountValue);
    const used = Number(state?.marginSummary?.totalMarginUsed);
    if (!Number.isFinite(equity) || equity < 0 || !Number.isFinite(used) || used < 0 || !Array.isArray(state?.assetPositions) || !Array.isArray(orders) || !Array.isArray(fills)) throw new Error('Inconsistent account response.');
    return { address: user, equity, availableMargin: Math.max(0, equity - used), positions: state.assetPositions.map(p => p.position).filter(p => Number(p.szi) !== 0), orders, fills, receivedAt: Date.now(), state };
  }
  book(coin) { return this.request({ type: 'l2Book', coin }); }
  orderStatus(user, oid) { return this.request({ type: 'orderStatus', user, oid }); }
  // Socket is read-only. REST remains the authoritative snapshot for proposals.
  watchMarket(coin, onUpdate, onStatus, WebSocketImpl = globalThis.WebSocket) {
    let stopped = false, retry, socket, heartbeat;
    const connect = () => {
      if (stopped) return;
      onStatus('CONNECTING'); socket = new WebSocketImpl(TESTNET_WS_URL);
      socket.onopen = () => {
        onStatus('CONNECTED');
        socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'activeAssetCtx', coin } }));
        heartbeat = setInterval(() => { if (socket.readyState === 1) socket.send(JSON.stringify({ method: 'ping' })); }, 20000);
      };
      socket.onmessage = event => { try { const message = JSON.parse(event.data); if (message.channel === 'activeAssetCtx' && message.data?.coin === coin) onUpdate(message.data.ctx); } catch { onStatus('INVALID_MESSAGE'); } };
      socket.onerror = () => onStatus('RECONNECTING');
      socket.onclose = () => { clearInterval(heartbeat); if (!stopped) { onStatus('RECONNECTING'); retry = setTimeout(connect, 4000); } };
    };
    connect();
    return () => { stopped = true; clearInterval(heartbeat); clearTimeout(retry); if (socket) { socket.onclose = null; socket.close(); } };
  }
}
