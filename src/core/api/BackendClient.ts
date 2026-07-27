// ============================================================
// ABBI DeskLive — Backend API Client (Frontend → Backend Proxy)
// ============================================================
// PERUBAHAN v2:
// - Frontend TIDAK lagi membaca API_SECRET.
// - Semua private API calls di-forward ke backend proxy.
// - Backend yang melakukan HMAC signing dengan secret.
// - ✅ FIX: Response format cocok dengan backend server.js
// ============================================================

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

// ─── Types ─────────────────────────────────────────────────

export interface TradeResult {
  success: boolean;
  orderId?: string;
  message: string;
  executedPrice?: number;
  executedAmount?: number;
  remainingBalance?: number;
  error?: string;
}

export interface BalanceResult {
  success: boolean;
  idr: number;
  coins: Record<string, number>;
  error?: string;
}

// ─── Helper: Fetch with timeout ────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════════════
// BACKEND CLIENT CLASS
// ═══════════════════════════════════════════════════════════

export class BackendClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BACKEND_URL;
  }

  // ─── PUBLIC API (proxy through backend for CORS) ────────

  async fetchTicker(pair: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/public/ticker/${pair}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchAllTickers(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/public/ticker_all`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchDepth(pair: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/public/depth/${pair}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // ─── PRIVATE API (backend does HMAC signing) ────────────

  async getInfo(): Promise<BalanceResult> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/private/info`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      const data = await response.json();
      console.log('[BackendClient] getInfo raw response:', data);

      // ✅ FIX: Backend server.js return format:
      // { success: true, idr: number, coins: {...}, raw: {...} }
      // BUKAN format lama Indodax: { success: 1, return: { balance: {...} } }
      if (data.success === true && data.coins) {
        return {
          success: true,
          idr: parseFloat(data.idr || 0),
          coins: data.coins,
        };
      }

      // Kalau backend return error format
      if (data.success === false && data.error) {
        return {
          success: false,
          idr: 0,
          coins: {},
          error: data.error,
        };
      }

      return {
        success: false,
        idr: 0,
        coins: {},
        error: data.error || 'Unexpected response from backend',
      };
    } catch (err: any) {
      console.error('[BackendClient] getInfo error:', err);
      return {
        success: false,
        idr: 0,
        coins: {},
        error: err.message || 'Network error — is backend running?',
      };
    }
  }

  async trade(
    pair: string,
    type: 'buy' | 'sell',
    options: { price?: number; amountIdr?: number; quantity?: number }
  ): Promise<TradeResult> {
    try {
      const body: any = { pair, type, price: options.price || 0 };
      if (type === 'buy' && options.amountIdr) body.amountIdr = options.amountIdr;
      if (type === 'sell' && options.quantity) body.quantity = options.quantity;

      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/private/trade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      console.log('[BackendClient] trade raw response:', data);

      // ✅ FIX: Cocok dengan backend response format
      if (data.success === true) {
        return {
          success: true,
          orderId: data.orderId,
          message: `Berhasil ${type} ${pair}`,
          executedPrice: parseFloat(data.raw?.return?.price || 0),
          executedAmount: options.amountIdr || options.quantity || 0,
        };
      }

      return {
        success: false,
        message: `Gagal ${type} ${pair}`,
        error: data.error || 'Trade failed',
      };
    } catch (err: any) {
      console.error('[BackendClient] trade error:', err);
      return {
        success: false,
        message: `Gagal ${type} ${pair}`,
        error: err.message || 'Network error — is backend running?',
      };
    }
  }

  async getOpenOrders(pair?: string): Promise<any[]> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/private/openOrders`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pair ? { pair } : {}),
        }
      );

      const data = await response.json();
      return data.orders || data.return?.orders || [];
    } catch (err: any) {
      console.error('[BackendClient] getOpenOrders error:', err);
      return [];
    }
  }

  async cancelOrder(pair: string, orderId: string, type: 'buy' | 'sell'): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/api/private/cancelOrder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pair, order_id: orderId, type }),
        }
      );

      const data = await response.json();
      return data.success === true || data.success === 1;
    } catch (err: any) {
      console.error('[BackendClient] cancelOrder error:', err);
      return false;
    }
  }

  // ─── HEALTH CHECK ────────────────────────────────────────
  async healthCheck(): Promise<{ status: string; apiKeyConfigured: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { timeout: 5000 } as any);
      return await response.json();
    } catch {
      return { status: 'down', apiKeyConfigured: false };
    }
  }
}

// Singleton instance
export const backendClient = new BackendClient();