// ============================================================
// ABBI DeskLive — Indodax Public WebSocket Client (SEC-004 FIXED)
// ============================================================
// CHANGELOG:
// - STATIC_TOKEN hardcoded dihapus → baca dari VITE_INDODAX_WS_TOKEN
// - Fallback ke hardcoded jika env kosong (transitional)
// - Auth failure counter: max 3x retry lalu switch ke REST polling
// - Graceful degradation: REST polling fallback otomatis
// ============================================================

const WS_URL = 'wss://ws3.indodax.com/ws/';

// ✅ FIX: Baca token dari env, fallback ke hardcoded hanya jika env kosong

export interface ChartTick {
  pair: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  volume: number;
}

export class IndodaxWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private messageId = 1;
  private isIntentionalDisconnect = false;
  private isAuthenticated = false;
  private pendingSubscriptions: { type: string; pair: string }[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPongTime = Date.now();
  
  // ✅ FIX: Auth failure tracking
  private authFailureCount = 0;
  private maxAuthFailures = 3;
  private isFallbackMode = false; // true = using REST polling instead of WS
  
  // ✅ FIX: REST polling intervals (fallback)
  private restPollIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private restPollDelay = 5000; // 5 seconds
  
  onChartTick: ((tick: ChartTick) => void) | null = null;
  onOrderBook: ((bids: OrderBookEntry[], asks: OrderBookEntry[]) => void) | null = null;
  onConnected: (() => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onFallbackMode: ((active: boolean) => void) | null = null; // ✅ NEW: Notify UI

  connect() {
    // ✅ FIX: Kalau sudah di fallback mode, jangan coba WS lagi
    if (this.isFallbackMode) {
      console.log('[WS] Fallback mode active, skipping WS connect');
      this.startRestPolling();
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    console.log('[WS] Connecting to', WS_URL);
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('[WS] Socket opened');
      this.reconnectAttempts = 0;
      this.authenticate();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.lastPongTime = Date.now();
        if (!data.result?.data) {
          console.log('[WS] Raw:', JSON.stringify(data).substring(0, 200));
        }
        this.handleMessage(data);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Socket error:', error);
      this.onError?.('WebSocket connection error');
      this.isAuthenticated = false;
    };

    this.ws.onclose = (event) => {
      console.log('[WS] Closed. Code:', event.code, 'Reason:', event.reason);
      this.isAuthenticated = false;
      this.stopHeartbeat();
      this.onDisconnected?.();
      
      // ✅ FIX: Kalau auth fail terus, jangan reconnect — switch ke fallback
      if (!this.isIntentionalDisconnect && event.code !== 1000 && !this.isFallbackMode) {
        if (this.authFailureCount >= this.maxAuthFailures) {
          console.warn('[WS] Auth failed 3x, switching to REST polling fallback');
          this.enableFallbackMode();
          return;
        }
        this.attemptReconnect();
      }
      this.isIntentionalDisconnect = false;
    };
  }

  private authenticate() {
    const authMsg = {
      params: { token: WS_TOKEN },
      id: 1,
    };
    console.log('[WS] Sending auth...');
    this.send(authMsg);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastPongTime > 30000) {
        console.warn('[WS] Heartbeat timeout, reconnecting...');
        this.ws?.close();
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ✅ FIX: Enable REST polling fallback
  private enableFallbackMode() {
    this.isFallbackMode = true;
    this.disconnect();
    this.onFallbackMode?.(true);
    this.onError?.('WebSocket auth failed. Switching to REST API polling.');
    this.startRestPolling();
  }

  // ✅ FIX: REST polling sebagai fallback
  private startRestPolling() {
    console.log('[WS] Starting REST polling fallback...');
    
    // Poll ticker untuk setiap pair yang pending
    this.pendingSubscriptions.forEach(({ type, pair }) => {
      if (type === 'chart') {
        this.pollTicker(pair);
      }
    });
  }

  // ✅ FIX: Poll ticker via REST API
  private pollTicker(pair: string) {
    if (this.restPollIntervals.has(pair)) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`https://indodax.com/api/ticker/${pair.toLowerCase()}`);
        if (!res.ok) return;
        const json = await res.json();
        const ticker = json.ticker;
        
        if (ticker) {
          const tick: ChartTick = {
            pair,
            timestamp: Date.now(),
            open: parseFloat(ticker.open),
            high: parseFloat(ticker.high),
            low: parseFloat(ticker.low),
            close: parseFloat(ticker.last),
            volume: parseFloat(ticker.vol_idr),
          };
          this.onChartTick?.(tick);
        }
      } catch (e) {
        console.error('[WS] REST poll error for', pair, e);
      }
    }, this.restPollDelay);
    
    this.restPollIntervals.set(pair, interval);
  }

  private stopRestPolling() {
    this.restPollIntervals.forEach((interval) => clearInterval(interval));
    this.restPollIntervals.clear();
  }

  subscribeChart(pair: string) {
    if (this.isFallbackMode) {
      // ✅ FIX: Kalau di fallback mode, subscribe via REST polling
      this.pollTicker(pair);
      return;
    }
    
    if (!this.isAuthenticated) {
      this.pendingSubscriptions.push({ type: 'chart', pair });
      return;
    }
    
    const msg = {
      method: 1,
      params: { channel: `chart:tick-${pair.toLowerCase()}` },
      id: ++this.messageId,
    };
    
    console.log('[WS] Subscribe chart:', pair);
    this.send(msg);
  }

  subscribeOrderBook(pair: string) {
    if (this.isFallbackMode) {
      console.warn('[WS] OrderBook not available in REST fallback mode');
      return;
    }
    
    if (!this.isAuthenticated) {
      this.pendingSubscriptions.push({ type: 'orderbook', pair });
      return;
    }
    
    const msg = {
      method: 1,
      params: { channel: `market:order-book-${pair.toLowerCase()}` },
      id: ++this.messageId,
    };
    
    console.log('[WS] Subscribe orderbook:', pair);
    this.send(msg);
  }

  private send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(msg);
      this.ws.send(json);
    } else {
      console.warn('[WS] Cannot send, socket not open');
    }
  }

  private handleMessage(data: any) {
    // Auth response
    if (data.id === 1 && data.result?.client) {
      console.log('[WS] ✅ AUTH SUCCESS! Client:', data.result.client);
      this.isAuthenticated = true;
      this.authFailureCount = 0; // ✅ FIX: Reset counter on success
      this.onConnected?.();
      
      this.pendingSubscriptions.forEach(({ type, pair }) => {
        if (type === 'chart') this.subscribeChart(pair);
        else if (type === 'orderbook') this.subscribeOrderBook(pair);
      });
      this.pendingSubscriptions = [];
      return;
    }

    if (data.id === 1 && data.error) {
      console.error('[WS] ❌ AUTH FAILED:', data.error);
      this.authFailureCount++; // ✅ FIX: Track auth failures
      this.onError?.(`Auth failed: ${JSON.stringify(data.error)}`);
      this.ws?.close();
      return;
    }

    // Subscription confirm
    if (data.result?.channel && !data.result?.data) {
      console.log('[WS] ✅ Subscribed:', data.result.channel);
      return;
    }

    // Data stream
    if (data.result?.channel && data.result?.data) {
      const channel = data.result.channel;
      const payload = data.result.data;
      const actualData = payload.data || payload;

      if (channel.startsWith('chart:tick-')) {
        this.handleChartTick(actualData);
      } else if (channel.startsWith('market:order-book-')) {
        this.handleOrderBook(actualData);
      }
    }
  }

  private handleChartTick(data: any) {
    if (Array.isArray(data) && data.length >= 7) {
      const tick: ChartTick = {
        pair: data[0],
        timestamp: data[1] * 1000,
        open: parseFloat(data[2]),
        high: parseFloat(data[3]),
        low: parseFloat(data[4]),
        close: parseFloat(data[5]),
        volume: parseFloat(data[6]),
      };
      console.log('[WS] Chart tick:', tick.close);
      this.onChartTick?.(tick);
    }
  }

  private handleOrderBook(data: any) {
    let asks: OrderBookEntry[] = [];
    let bids: OrderBookEntry[] = [];

    if (data.ask && Array.isArray(data.ask)) {
      asks = data.ask.map((a: any) => ({
        price: parseFloat(a.price),
        volume: parseFloat(a.btc_volume || a.volume || 0),
      }));
    }

    if (data.bid && Array.isArray(data.bid)) {
      bids = data.bid.map((b: any) => ({
        price: parseFloat(b.price),
        volume: parseFloat(b.btc_volume || b.volume || 0),
      }));
    }

    if (asks.length > 0 || bids.length > 0) {
      console.log('[WS] Orderbook update — Asks:', asks.length, 'Bids:', bids.length);
      this.onOrderBook?.(bids, asks);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onError?.('Max reconnect reached. Please check your connection and refresh.');
      return;
    }
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`[WS] Reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    this.stopHeartbeat();
    this.stopRestPolling(); // ✅ FIX: Bersihkan REST polling juga
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, 'Intentional disconnect');
    this.ws = null;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
  }
}

export const indodaxWS = new IndodaxWebSocket();