// ============================================================
// ABBI DeskLive — Smart Accumulator (OTAK UTAMA — V5 FINAL)
// FIXED: 1 entry per coin guard + data real dari DiscountScanner
// ============================================================

import type { EntrySignal, Position, TradeHistory } from '../types';
import {
  COIN_UNIVERSE,
  POSITION_LIMITS,
  BUDGET_LOW,
  BUDGET_HIGH,
  MIN_TRADE,
  MAX_PER_TRADE,
  TP1_TARGET,
  TP2_TARGET,
  REGIME_MULTIPLIER,
  SCAN_INTERVAL_MINUTES,
} from '../constants';
import { useTradingStore, useNotificationStore, useSystemStore } from '../store';
import { discountScanner } from './DiscountScanner';
import { scaleOutEngine } from './ScaleOutEngine';
import { regimeEngine, type MarketRegime } from './RegimeEngine';
import { calculateAllocations, getThreshold } from '../utils/allocation';
import { validateSymbol, validatePrice, validateQuantity } from '../utils/validation';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

interface ExecutionResult {
  success: boolean;
  executedPrice?: number;
  orderId?: string;
  error?: string;
}

export class SmartAccumulator {
  private isRunning = false;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private dailyInvested = 0;
  private lastResetDate = new Date().toDateString();

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    useSystemStore.getState().setRunning(true);
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: '🤖 ABBI Aktif 24/7',
      message: 'Smart Accumulator mulai memantau pasar dan mengelola portofolio...',
    });

    await this.scan();
    this.scanInterval = setInterval(() => this.scan(), SCAN_INTERVAL_MINUTES * 60 * 1000);
    console.log('[ABBI] Auto-trading started. Interval:', SCAN_INTERVAL_MINUTES, 'minutes.');
  }

  stop() {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    useSystemStore.getState().setRunning(false);
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: 'ABBI Dihentikan',
      message: 'Bot berhenti. Posisi existing tetap dimonitor.',
    });
  }

  // ============================================================
  // CORE SCAN LOOP
  // ============================================================

  async scan() {
    if (!this.isRunning) return;

    try {
      console.log('[ABBI] ═══════════════════════════════════════');
      console.log('[ABBI] Starting scan cycle...');

      this.checkDailyReset();

      const regime = await regimeEngine.detect();
      useSystemStore.getState().setMode(regime === 'bull' ? 'live' : 'mock');

      const signals = await discountScanner.scanAll(regime);
      useTradingStore.getState().setEntrySignals(signals);
      useSystemStore.getState().setLastScan(new Date().toISOString());

      await this.checkScaleOuts();

      if (regime !== 'sideways') {
        await this.evaluateEntries(signals, regime);
      } else {
        console.log('[ABBI] Sideways regime — skipping new entries');
      }

      await this.checkRebalance(signals);

      console.log('[ABBI] Scan cycle complete. Next scan in', SCAN_INTERVAL_MINUTES, 'minutes.');
      console.log('[ABBI] ═══════════════════════════════════════');

    } catch (err) {
      console.error('[ABBI] Scan error:', err);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Scan Error',
        message: 'Gagal scanning. ABBI akan retry di cycle berikutnya.',
      });
    }
  }

  // ============================================================
  // ENTRY EVALUATION (Auto-Buy)
  // FIXED: 1 entry per coin — skip kalau sudah ada posisi aktif
  // ============================================================

  private async evaluateEntries(signals: EntrySignal[], regime: MarketRegime) {
    const { positions } = useTradingStore.getState();
    const dailyBudget = BUDGET_HIGH;
    const remainingBudget = dailyBudget - this.dailyInvested;

    if (remainingBudget < MIN_TRADE) {
      console.log(`[ABBI] Daily budget exhausted: Rp${this.dailyInvested.toLocaleString('id-ID')}`);
      return;
    }

    const portfolioValue = this.calculatePortfolioValue();
    const positionValues: Record<string, number> = {};
    for (const pos of positions) {
      const ticker = await discountScanner.getTicker(pos.symbol);
      positionValues[pos.symbol] = pos.quantity * (ticker?.price || pos.avgEntryPrice);
    }

    const allocations = calculateAllocations(
      signals,
      regime,
      portfolioValue,
      positionValues,
      remainingBudget,
      portfolioValue * 0.3
    );

    for (const alloc of allocations) {
      // ✅ FIX: 1 entry per coin — skip kalau sudah punya posisi aktif
      const existing = positions.find((p) => p.symbol === alloc.symbol);
      if (existing && existing.status !== 'fully_exited') {
        console.log(`[ABBI] Skip ${alloc.symbol}: already have active position (1 entry per coin rule)`);
        continue;
      }

      // Ambil harga terkini untuk dikirim ke backend
      const ticker = await discountScanner.getTicker(alloc.symbol);
      const currentPrice = ticker?.price || 0;

      if (currentPrice <= 0) {
        console.warn(`[ABBI] Skip ${alloc.symbol}: invalid price ${currentPrice}`);
        continue;
      }

      console.log(`[ABBI] Executing buy: ${alloc.symbol} @ Rp${alloc.amountIdr.toLocaleString('id-ID')} (${alloc.budgetTier}) | Price: ${currentPrice}`);
      const result = await this.executeBuy(alloc.symbol, alloc.amountIdr, currentPrice);

      if (result.success && result.executedPrice) {
        this.recordEntry(alloc.symbol, alloc.amountIdr, result.executedPrice, result.orderId);
        this.dailyInvested += alloc.amountIdr;
      } else {
        console.error(`[ABBI] Buy failed for ${alloc.symbol}:`, result.error);
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: `Buy Failed: ${alloc.symbol}`,
          message: result.error || 'Unknown error',
        });
      }
    }
  }

  // ============================================================
  // SCALE-OUT (Fixed TP 10% / 15%)
  // ============================================================

  private async checkScaleOuts() {
    const { positions } = useTradingStore.getState();

    for (const pos of positions) {
      const ticker = await discountScanner.getTicker(pos.symbol);
      if (!ticker) continue;

      const currentPrice = ticker.price;
      const entryPrice = pos.avgEntryPrice;
      const pnlPct = (currentPrice - entryPrice) / entryPrice;

      if (!pos.tp1Triggered && pnlPct >= TP1_TARGET) {
        const sellQty = pos.quantity * 0.5;
        const result = await this.executeSell(pos.symbol, sellQty, currentPrice, 'TP1');
        if (result.success) {
          useTradingStore.getState().updatePosition(pos.symbol, {
            ...pos,
            tp1Triggered: true,
            quantity: pos.quantity - sellQty,
          });
          useNotificationStore.getState().addNotification({
            type: 'success',
            title: `🎯 TP1 Hit: ${pos.symbol}`,
            message: `Sold 50% @ Rp${currentPrice.toLocaleString('id-ID')} (+${(pnlPct*100).toFixed(1)}%)`,
          });
        }
      }

      if (pos.tp1Triggered && pos.quantity > 0 && pnlPct >= TP2_TARGET) {
        const sellQty = pos.quantity;
        const result = await this.executeSell(pos.symbol, sellQty, currentPrice, 'TP2');
        if (result.success) {
          useTradingStore.getState().removePosition(pos.symbol);
          useNotificationStore.getState().addNotification({
            type: 'success',
            title: `🎯 TP2 Hit: ${pos.symbol}`,
            message: `Sold remaining @ Rp${currentPrice.toLocaleString('id-ID')} (+${(pnlPct*100).toFixed(1)}%)`,
          });
        }
      }
    }
  }

  // ============================================================
  // BACKEND EXECUTION (FIXED: kirim 'price' untuk Indodax legacy)
  // ============================================================

  private async executeBuy(symbol: string, amountIdr: number, price: number): Promise<ExecutionResult> {
    try {
      const pair = `${symbol.toLowerCase()}_idr`;
      const response = await fetch(`${BACKEND_URL}/api/private/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          type: 'buy',
          price,        // ← FIX: harga per unit (wajib untuk Indodax legacy)
          amountIdr,    // ← jumlah rupiah yang dibelanjakan
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Trade failed' };
      }

      return {
        success: true,
        executedPrice: data.raw?.return?.receive 
          ? parseFloat(data.raw.return.receive) / parseFloat(data.raw.return.spend)
          : undefined,
        orderId: data.orderId,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async executeSell(symbol: string, quantity: number, price: number, reason: string): Promise<ExecutionResult> {
    try {
      const pair = `${symbol.toLowerCase()}_idr`;
      const response = await fetch(`${BACKEND_URL}/api/private/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          type: 'sell',
          price,        // ← FIX: harga limit jual (wajib untuk Indodax legacy)
          quantity,     // ← jumlah coin yang dijual
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Trade failed' };
      }

      return {
        success: true,
        executedPrice: data.raw?.return?.receive
          ? parseFloat(data.raw.return.receive) / parseFloat(data.raw.return.spend)
          : undefined,
        orderId: data.orderId,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ============================================================
  // RECORD KEEPING
  // ============================================================

  private recordEntry(symbol: string, amountIdr: number, price: number, orderId?: string) {
    const validSymbol = validateSymbol(symbol, COIN_UNIVERSE.map((c) => c.symbol));
    const validPrice = validatePrice(price);
    const quantity = validateQuantity(amountIdr, validPrice);

    const tp1Price = validPrice * (1 + TP1_TARGET);
    const tp2Price = validPrice * (1 + TP2_TARGET);

    const position: Position = {
      symbol: validSymbol,
      avgEntryPrice: validPrice,
      totalInvested: amountIdr,
      currentValue: amountIdr,
      quantity,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      tp1Triggered: false,
      tp1Price,
      tp2Trailing: TP2_TARGET,
      tp2PeakPrice: validPrice,
      status: 'accumulating',
      entryDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    useTradingStore.getState().addPosition(position);

    const trade: TradeHistory = {
      id: orderId || `trade_${Date.now()}`,
      symbol: validSymbol,
      type: 'BUY',
      price: validPrice,
      quantity,
      total: amountIdr,
      timestamp: new Date().toISOString(),
      note: `Auto-entry via ABBI V5 — TP1: ${(TP1_TARGET*100).toFixed(0)}% | TP2: ${(TP2_TARGET*100).toFixed(0)}%`,
    };
    useTradingStore.getState().addTrade(trade);

    useNotificationStore.getState().addNotification({
      type: 'success',
      title: `🛒 Auto-Entry: ${validSymbol}`,
      message: `${quantity.toFixed(6)} @ Rp${validPrice.toLocaleString('id-ID')} = Rp${amountIdr.toLocaleString('id-ID')}`,
    });
  }

  // ============================================================
  // PORTFOLIO VALUE
  // ============================================================

  private calculatePortfolioValue(): number {
    const { positions } = useTradingStore.getState();
    let value = 0;
    for (const pos of positions) {
      value += pos.currentValue;
    }
    return value || 2_000_000;
  }

  // ============================================================
  // REBALANCE ALERT
  // ============================================================

  private async checkRebalance(signals: EntrySignal[]) {
    const { positions } = useTradingStore.getState();
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    const underweight = signals.filter((s) => {
      const pos = positions.find((p) => p.symbol === s.symbol);
      const targetWeight = COIN_UNIVERSE.find((c) => c.symbol === s.symbol)?.marketCapWeight || 0;
      const currentWeight = totalValue > 0 ? (pos?.currentValue || 0) / totalValue : 0;
      return currentWeight < targetWeight * 0.6 && s.score >= 60;
    });

    if (underweight.length > 0) {
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: '📊 Rebalance Opportunity',
        message: `${underweight.length} coin underweight vs target allocation`,
      });
    }
  }

  // ============================================================
  // DAILY RESET
  // ============================================================

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyInvested = 0;
      this.lastResetDate = today;
      console.log('[ABBI] Daily budget reset.');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      dailyInvested: this.dailyInvested,
      dailyRemaining: BUDGET_HIGH - this.dailyInvested,
      regime: regimeEngine.getLastContext(),
      nextScan: this.scanInterval ? `${SCAN_INTERVAL_MINUTES} minutes` : 'stopped',
    };
  }
}

export const smartAccumulator = new SmartAccumulator();
