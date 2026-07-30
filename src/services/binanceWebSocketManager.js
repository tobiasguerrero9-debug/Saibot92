/**
 * binanceWebSocketManager.js
 * High-performance WebSocket stream manager for Binance USD-M Futures streams.
 * Handles automatic stream switching, cleanly closes previous sockets,
 * and maintains connection status without memory leaks.
 */

const WS_BASE_URL = 'wss://fstream.binance.com/stream?streams=';

export class BinanceWebSocketManager {
  constructor() {
    this.socket = null;
    this.currentStreams = [];
    this.onMessageCallback = null;
    this.onStatusChangeCallback = null;
    this.reconnectTimer = null;
    this.isManualClose = false;
    this.status = 'DISCONNECTED'; // CONNECTING | CONNECTED | RECONNECTING | DISCONNECTED
  }

  setStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus);
    }
  }

  /**
   * Connect to specified array of stream strings (e.g. ['btcusdt@miniTicker', 'btcusdt@aggTrade', '!forceOrder@arr'])
   */
  connect(streams, onMessage, onStatusChange) {
    // 1. Unsubscribe/close any active socket
    this.disconnect();

    if (!streams || streams.length === 0) return;

    this.currentStreams = streams;
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
    this.isManualClose = false;

    const streamUrl = `${WS_BASE_URL}${streams.join('/')}`;
    this.setStatus('CONNECTING');

    try {
      this.socket = new WebSocket(streamUrl);

      this.socket.onopen = () => {
        this.setStatus('CONNECTED');
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Combined stream format: { stream: "btcusdt@miniTicker", data: {...} }
          if (this.onMessageCallback) {
            this.onMessageCallback(payload.stream, payload.data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WebSocket encountered an error:', err);
        this.setStatus('RECONNECTING');
      };

      this.socket.onclose = () => {
        if (!this.isManualClose) {
          this.setStatus('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };
    } catch (err) {
      console.error('Failed to instantiate WebSocket:', err);
      this.setStatus('RECONNECTING');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentStreams.length > 0 && !this.isManualClose) {
        this.connect(this.currentStreams, this.onMessageCallback, this.onStatusChangeCallback);
      }
    }, 4000);
  }

  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
  }
}

// Export singleton instance for app-wide stream management
export const wsManager = new BinanceWebSocketManager();
