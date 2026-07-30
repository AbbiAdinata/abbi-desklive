// ============================================================
// TradeExecutor versi CommonJS — dipakai oleh server.js & AutoScanner.js
// ============================================================

const crypto = require('crypto');
const axios = require('axios');

const INDODAX_API_BASE = 'https://indodax.com/tapi';
const API_KEY = process.env.INDODAX_API_KEY || '';
const API_SECRET = process.env.INDODAX_API_SECRET || '';

class TradeExecutorCJS {
  constructor() {
    this.lastNonce = 0;
    this.nonceLock = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 170;
    this.retryAttempts = 3;
  }

  async buy(pair, amountIdr) {
    return this.executeTrade('buy', pair, amountIdr);
  }

  async sell(pair, quantity) {
    return this.executeTrade('sell', pair, quantity);
  }

  async getBalance() {
    try {
      const res = await this.privateRequest({ method: 'getInfo' });
      if (res?.success !== 1) return null;
      const balance = { idr: 0, coins: {} };
      const funds = res.return?.balance || {};
      for (const [asset, val] of Object.entries(funds)) {
        const amt = parseFloat(val) || 0;
        if (asset === 'idr') balance.idr = amt;
        else if (amt > 0) balance.coins[asset.toUpperCase()] = amt;
      }
      return balance;
    } catch (err) {
      console.error('[TradeExecutorCJS] getBalance error:', err.message);
      return null;
    }
  }

  async executeTrade(side, pair, amount) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.rateLimit();
        const params = {
          method: 'trade',
          pair: pair.toLowerCase(),
          type: side,
        };
        if (side === 'buy') params.idr = amount.toString();
        else params[pair.split('_')[0]] = amount.toString();

        const res = await this.privateRequest(params);

        if (res?.success === 1 && res.return) {
          const ret = res.return;
          console.log('[TRADE EXECUTED]', JSON.stringify({ side, pair, amount, ret }));
          return {
            success: true,
            orderId: ret.order_id?.toString(),
            raw: ret,
          };
        }
        throw new Error(res?.error || 'Unknown API error');
      } catch (err) {
        console.error(`[TradeExecutorCJS] ${side} attempt ${attempt}/${this.retryAttempts} gagal:`, err.message);
        if (attempt === this.retryAttempts) {
          return { success: false, error: err.message };
        }
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    return { success: false, error: 'Max retries exceeded' };
  }

  async privateRequest(params) {
    const nonce = this.getNextNonce();
    const body = new URLSearchParams({ ...params, nonce: nonce.toString() });
    const sign = crypto.createHmac('sha512', API_SECRET).update(body.toString()).digest('hex');

    const response = await axios.post(INDODAX_API_BASE, body.toString(), {
      headers: {
        'Key': API_KEY,
        'Sign': sign,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
      validateStatus: () => true,
    });
    return response.data;
  }

  getNextNonce() {
    const now = Date.now();
    this.lastNonce = Math.max(now, this.lastNonce + 1);
    return this.lastNonce;
  }

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(r => setTimeout(r, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

const tradeExecutorCJS = new TradeExecutorCJS();
module.exports = { tradeExecutorCJS };
