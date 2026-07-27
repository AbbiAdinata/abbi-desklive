// ============================================================
// ABBI DeskLive — Backend Trade Executor (Node.js)
// ============================================================
// SEC-001 FIXED: File ini hanya berjalan di backend.
// Tidak ada VITE_ prefix. Secret aman di process.env.
//
// FEATURES:
// - HMAC-SHA512 signing dengan Node crypto
// - Sequential nonce queue (SEC-009 FIXED)
// - Retry logic dengan exponential backoff
// - Rate limiting (max 6 req/detik ke Indodax)
// - Logging semua trade ke file
// ============================================================

import crypto from 'crypto';
import axios, { AxiosError } from 'axios';

const INDODAX_API_BASE = 'https://indodax.com/tapi';
const API_KEY = process.env.INDODAX_API_KEY || '';
const API_SECRET = process.env.INDODAX_API_SECRET || '';

interface TradeResult {
  success: boolean;
  orderId?: string;
  executedPrice?: number;
  executedAmount?: number;
  remaining?: number;
  error?: string;
}

interface BalanceInfo {
  idr: number;
  coins: Record<string, number>;
}

export class TradeExecutor {
  private nonceQueue: number[] = [];
  private nonceLock = false;
  private lastRequestTime = 0;
  private minRequestInterval = 170; // ms (max ~6 req/s)
  private retryAttempts = 3;

  // ─── PUBLIC METHODS ──────────────────────────────────────

  async buy(pair: string, amountIdr: number): Promise<TradeResult> {
    return this.executeTrade('buy', pair, amountIdr);
  }

  async sell(pair: string, amount: number): Promise<TradeResult> {
    return this.executeTrade('sell', pair, amount);
  }

  async getBalance(): Promise<BalanceInfo | null> {
    try {
      const res = await this.privateRequest({ method: 'getInfo' });
      if (res?.success !== 1) return null;

      const balance: BalanceInfo = { idr: 0, coins: {} };
      const funds = res.return?.balance || {};
      const hold = res.return?.balance_hold || {};

      for (const [asset, val] of Object.entries(funds)) {
        const available = parseFloat(val as string) || 0;
        const onHold = parseFloat(hold[asset] as string) || 0;
        const total = available + onHold;

        if (asset === 'idr') {
          balance.idr = total;
        } else if (total > 0) {
          balance.coins[asset.toUpperCase()] = total;
        }
      }
      return balance;
    } catch (err) {
      console.error('[TradeExecutor] getBalance error:', err);
      return null;
    }
  }

  async getOpenOrders(pair?: string): Promise<any[]> {
    try {
      const params: any = { method: 'openOrders' };
      if (pair) params.pair = pair;
      const res = await this.privateRequest(params);
      return res?.return?.orders || [];
    } catch (err) {
      console.error('[TradeExecutor] getOpenOrders error:', err);
      return [];
    }
  }

  async cancelOrder(pair: string, orderId: string, type: 'buy' | 'sell'): Promise<boolean> {
    try {
      const res = await this.privateRequest({
        method: 'cancelOrder',
        pair,
        order_id: orderId,
        type,
      });
      return res?.success === 1;
    } catch (err) {
      console.error('[TradeExecutor] cancelOrder error:', err);
      return false;
    }
  }

  // ─── CORE EXECUTION ──────────────────────────────────────

  private async executeTrade(
    side: 'buy' | 'sell',
    pair: string,
    amount: number
  ): Promise<TradeResult> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.rateLimit();

        const params: any = {
          method: side === 'buy' ? 'trade' : 'trade',
          pair: pair.toLowerCase(),
          type: side,
          [side === 'buy' ? 'idr' : side]: amount.toString(),
        };

        const res = await this.privateRequest(params);

        if (res?.success === 1 && res.return) {
          const ret = res.return;
          this.logTrade(side, pair, amount, ret);

          return {
            success: true,
            orderId: ret.order_id?.toString(),
            executedPrice: parseFloat(ret.receive) / parseFloat(ret.spend),
            executedAmount: parseFloat(ret.receive),
            remaining: parseFloat(ret.remain),
          };
        }

        throw new Error(res?.error || 'Unknown API error');
      } catch (err: any) {
        console.error(`[TradeExecutor] ${side} attempt ${attempt}/${this.retryAttempts} failed:`, err.message);

        if (attempt === this.retryAttempts) {
          return { success: false, error: err.message };
        }

        // Exponential backoff: 1s, 2s, 4s
        await this.sleep(1000 * Math.pow(2, attempt - 1));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  // ─── PRIVATE API REQUEST ─────────────────────────────────

  private async privateRequest(params: Record<string, any>): Promise<any> {
    const nonce = await this.getNextNonce();
    const body = new URLSearchParams({ ...params, nonce: nonce.toString() });

    const sign = crypto
      .createHmac('sha512', API_SECRET)
      .update(body.toString())
      .digest('hex');

    const response = await axios.post(INDODAX_API_BASE, body.toString(), {
      headers: {
        'Key': API_KEY,
        'Sign': sign,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    });

    return response.data;
  }

  // ─── SEQUENTIAL NONCE (SEC-009 FIXED) ────────────────────

  private async getNextNonce(): Promise<number> {
    // Tunggu kalau queue sedang diproses
    while (this.nonceLock) {
      await this.sleep(5);
    }

    this.nonceLock = true;
    try {
      const now = Date.now();
      // Pastikan nonce selalu naik
      const lastNonce = this.nonceQueue.length > 0 ? this.nonceQueue[this.nonceQueue.length - 1] : 0;
      const nonce = Math.max(now, lastNonce + 1);
      this.nonceQueue.push(nonce);

      // Cleanup queue lama
      if (this.nonceQueue.length > 100) {
        this.nonceQueue = this.nonceQueue.slice(-50);
      }

      return nonce;
    } finally {
      this.nonceLock = false;
    }
  }

  // ─── RATE LIMITING ───────────────────────────────────────

  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── LOGGING ─────────────────────────────────────────────

  private logTrade(side: string, pair: string, amount: number, result: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      side,
      pair,
      amount,
      result,
    };
    console.log('[TRADE]', JSON.stringify(logEntry));
    // TODO: Simpan ke file atau database
  }
}

export const tradeExecutor = new TradeExecutor();