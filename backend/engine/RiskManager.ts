// ============================================================
// ABBI DeskLive — Risk Manager (Backend)
// ============================================================
// Menjaga portofolio dari kerugian besar:
//   1. Daily investment limit
//   2. Per-trade maximum
//   3. Circuit breaker (drawdown 12%)
//   4. Cooldown setelah circuit breaker trigger
//   5. Blacklist coin yang turun >30% dari entry
// ============================================================

import { tradeExecutor } from './TradeExecutor';

interface RiskState {
  dailyInvested: number;
  lastResetDate: string;
  circuitBreakerActive: boolean;
  circuitBreakerTriggeredAt: string | null;
  cooldownUntil: string | null;
  blacklist: string[]; // symbol yang sedang cooldown
}

const CIRCUIT_BREAKER_DRAWDOWN = 0.12;
const COOLDOWN_HOURS = 24;
const MAX_DAILY_INVESTMENT = parseInt(process.env.MAX_DAILY_INVESTMENT || '5000000');
const MAX_PER_TRADE = parseInt(process.env.MAX_PER_TRADE || '2000000');
const MIN_TRADE = parseInt(process.env.MIN_TRADE || '50000');

export class RiskManager {
  private state: RiskState = {
    dailyInvested: 0,
    lastResetDate: new Date().toDateString(),
    circuitBreakerActive: false,
    circuitBreakerTriggeredAt: null,
    cooldownUntil: null,
    blacklist: [],
  };

  /**
   * Cek apakah trade diperbolehkan.
   */
  async canTrade(symbol: string, amountIdr: number, portfolioValue: number, portfolioCost: number): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Reset harian
    this.checkDailyReset();

    // 2. Circuit breaker aktif?
    if (this.state.circuitBreakerActive) {
      if (this.state.cooldownUntil && new Date() < new Date(this.state.cooldownUntil)) {
        return {
          allowed: false,
          reason: `Circuit breaker active. Cooldown until ${this.state.cooldownUntil}`,
        };
      }
      // Cooldown selesai, reset
      this.resetCircuitBreaker();
    }

    // 3. Cek drawdown
    if (portfolioCost > 0) {
      const drawdown = (portfolioCost - portfolioValue) / portfolioCost;
      if (drawdown >= CIRCUIT_BREAKER_DRAWDOWN) {
        this.triggerCircuitBreaker('portfolio_drawdown', drawdown);
        return {
          allowed: false,
          reason: `Circuit breaker triggered! Drawdown ${(drawdown * 100).toFixed(1)}%`,
        };
      }
    }

    // 4. Blacklist?
    if (this.state.blacklist.includes(symbol)) {
      return { allowed: false, reason: `${symbol} is blacklisted (recent heavy loss)` };
    }

    // 5. Daily limit?
    if (this.state.dailyInvested + amountIdr > MAX_DAILY_INVESTMENT) {
      const remaining = MAX_DAILY_INVESTMENT - this.state.dailyInvested;
      return {
        allowed: false,
        reason: `Daily limit reached. Remaining: Rp${remaining.toLocaleString('id-ID')}`,
      };
    }

    // 6. Min/max trade?
    if (amountIdr < MIN_TRADE) {
      return { allowed: false, reason: `Minimum trade is Rp${MIN_TRADE.toLocaleString('id-ID')}` };
    }
    if (amountIdr > MAX_PER_TRADE) {
      return { allowed: false, reason: `Maximum per trade is Rp${MAX_PER_TRADE.toLocaleString('id-ID')}` };
    }

    return { allowed: true };
  }

  /**
   * Record trade setelah sukses.
   */
  recordTrade(amountIdr: number) {
    this.checkDailyReset();
    this.state.dailyInvested += amountIdr;
    console.log(`[Risk] Daily invested: Rp${this.state.dailyInvested.toLocaleString('id-ID')} / Rp${MAX_DAILY_INVESTMENT.toLocaleString('id-ID')}`);
  }

  /**
   * Blacklist coin yang turun >30%.
   */
  checkAndBlacklist(symbol: string, avgEntry: number, currentPrice: number) {
    if (currentPrice < avgEntry * 0.7) {
      if (!this.state.blacklist.includes(symbol)) {
        this.state.blacklist.push(symbol);
        console.warn(`[Risk] Blacklisted ${symbol}: down ${((1 - currentPrice / avgEntry) * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Trigger circuit breaker.
   */
  private triggerCircuitBreaker(reason: string, drawdown: number) {
    const cooldownUntil = new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    this.state.circuitBreakerActive = true;
    this.state.circuitBreakerTriggeredAt = new Date().toISOString();
    this.state.cooldownUntil = cooldownUntil;

    console.error(`[Risk] 🚨 CIRCUIT BREAKER TRIGGERED!`);
    console.error(`[Risk] Reason: ${reason}`);
    console.error(`[Risk] Drawdown: ${(drawdown * 100).toFixed(1)}%`);
    console.error(`[Risk] Cooldown until: ${cooldownUntil}`);

    // TODO: Kirim alert ke Telegram/Discord
  }

  private resetCircuitBreaker() {
    this.state.circuitBreakerActive = false;
    this.state.circuitBreakerTriggeredAt = null;
    this.state.cooldownUntil = null;
    console.log('[Risk] Circuit breaker reset. Trading resumed.');
  }

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.state.lastResetDate) {
      this.state.dailyInvested = 0;
      this.state.lastResetDate = today;
      this.state.blacklist = []; // Reset blacklist harian
      console.log('[Risk] Daily stats reset.');
    }
  }

  getStatus() {
    return {
      ...this.state,
      maxDaily: MAX_DAILY_INVESTMENT,
      maxPerTrade: MAX_PER_TRADE,
      minTrade: MIN_TRADE,
    };
  }
}

export const riskManager = new RiskManager();