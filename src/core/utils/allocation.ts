// ============================================================
// ABBI DeskLive — Market-Cap Weighted Allocation Engine (V5)
// ============================================================

import {
  COIN_UNIVERSE,
  POSITION_LIMITS,
  BUDGET_LOW,
  BUDGET_HIGH,
  MIN_TRADE,
  MAX_PER_TRADE,
  REGIME_MULTIPLIER,
} from '../constants';
import type { EntrySignal } from '../types';

export interface AllocationResult {
  symbol: string;
  amountIdr: number;
  marketCapWeight: number;
  signalScore: number;
  signalBoost: number;
  budgetTier: 'LOW' | 'HIGH';
  reason: string;
}

/**
 * Hitung alokasi pembelian berdasarkan:
 *   1. Signal score → budget tier (300k vs 500k)
 *   2. Market cap weight
 *   3. Regime multiplier
 *   4. Position limit (max % of portfolio per coin)
 */
export function calculateAllocations(
  signals: EntrySignal[],
  regime: 'bull' | 'bear' | 'sideways',
  portfolioValue: number,
  positionValues: Record<string, number>,
  dailyBudgetRemaining: number,
  cashAvailable: number
): AllocationResult[] {
  const eligible = signals.filter((s) => {
    const threshold = getThreshold(s.symbol, regime);
    return s.score >= threshold;
  });

  if (eligible.length === 0) return [];

  const regimeMult = REGIME_MULTIPLIER[regime] || 1.0;
  if (regimeMult === 0) return [];

  const boosted = eligible.map((signal) => {
    const coin = COIN_UNIVERSE.find((c) => c.symbol === signal.symbol);
    if (!coin) return null;

    // Budget tier based on signal score
    const budgetTier: 'LOW' | 'HIGH' = signal.score >= 85 ? 'HIGH' : 'LOW';
    const baseBudget = budgetTier === 'HIGH' ? BUDGET_HIGH : BUDGET_LOW;

    // Signal boost: score 70→0.85, 85→1.0, 100→1.15
    const signalBoost = Math.max(0.5, Math.min(1.3, 0.85 + (signal.score - 70) / 100));

    const rawAllocation = baseBudget * coin.marketCapWeight * signalBoost * regimeMult;

    return {
      symbol: signal.symbol,
      rawAllocation,
      marketCapWeight: coin.marketCapWeight,
      signalScore: signal.score,
      signalBoost,
      budgetTier,
    };
  }).filter(Boolean) as NonNullable<typeof boosted[0]>[];

  if (boosted.length === 0) return [];

  // Normalize
  const totalRaw = boosted.reduce((sum, b) => sum + b.rawAllocation, 0);
  const scaleFactor = totalRaw > dailyBudgetRemaining ? dailyBudgetRemaining / totalRaw : 1;

  const results: AllocationResult[] = [];

  for (const item of boosted) {
    let amount = Math.floor(item.rawAllocation * scaleFactor);

    // Position limit check
    const limitPct = POSITION_LIMITS[item.symbol] || 0.02;
    const effectivePortfolioValue = Math.max(portfolioValue, cashAvailable);
    const maxAllowedValue = effectivePortfolioValue * limitPct;
    const currentValue = positionValues[item.symbol] || 0;
    const roomRemaining = maxAllowedValue - currentValue;

    if (roomRemaining <= 0) {
      console.log(`[Allocation] Skip ${item.symbol}: at position limit (${(currentValue/portfolioValue*100).toFixed(1)}% / ${(limitPct*100).toFixed(0)}%)`);
      continue;
    }

    amount = Math.min(amount, Math.floor(roomRemaining), MAX_PER_TRADE, cashAvailable);

    if (amount < MIN_TRADE) {
      console.log(`[Allocation] Skip ${item.symbol}: Rp${amount.toLocaleString('id-ID')} < MIN_TRADE`);
      continue;
    }

    results.push({
      symbol: item.symbol,
      amountIdr: amount,
      marketCapWeight: item.marketCapWeight,
      signalScore: item.signalScore,
      signalBoost: item.signalBoost,
      budgetTier: item.budgetTier,
      reason: `${item.symbol}: MCAP ${(item.marketCapWeight * 100).toFixed(0)}% × Score ${item.signalScore} × ${item.budgetTier} × ${regime}`,
    });

    // Deduct from available cash for next coin
    cashAvailable -= amount;
  }

  const finalTotal = results.reduce((sum, r) => sum + r.amountIdr, 0);
  console.log(
    `[Allocation] ${results.length} allocations, total Rp${finalTotal.toLocaleString('id-ID')}`
  );
  return results;
}

export function getThreshold(symbol: string, regime: string): number {
  const thresholds: Record<string, Record<string, number>> = {
    BTC: { bear: 50, bull: 75, sideways: 999 },
    ETH: { bear: 45, bull: 70, sideways: 999 },
    BNB: { bear: 45, bull: 70, sideways: 999 },
    SOL: { bear: 45, bull: 70, sideways: 999 },
    XRP: { bear: 40, bull: 65, sideways: 999 },
    ADA: { bear: 40, bull: 65, sideways: 999 },
    AVAX: { bear: 40, bull: 65, sideways: 999 },
    LINK: { bear: 40, bull: 65, sideways: 999 },
    DOT: { bear: 40, bull: 65, sideways: 999 },
    MATIC: { bear: 40, bull: 65, sideways: 999 },
    NEAR: { bear: 38, bull: 62, sideways: 999 },
    ARB: { bear: 38, bull: 62, sideways: 999 },
    OP: { bear: 38, bull: 62, sideways: 999 },
    SEI: { bear: 38, bull: 62, sideways: 999 },
    SUI: { bear: 38, bull: 62, sideways: 999 },
    INJ: { bear: 35, bull: 60, sideways: 999 },
    RENDER: { bear: 35, bull: 60, sideways: 999 },
    TIA: { bear: 35, bull: 60, sideways: 999 },
    PYTH: { bear: 35, bull: 60, sideways: 999 },
    JUP: { bear: 35, bull: 60, sideways: 999 },
  };
  return thresholds[symbol]?.[regime] || 70;
}

export function getRemainingBudget(
  dailyBudget: number,
  todayTrades: { total: number; timestamp: string }[]
): number {
  const today = new Date().toDateString();
  const spentToday = todayTrades
    .filter((t) => new Date(t.timestamp).toDateString() === today)
    .reduce((sum, t) => sum + t.total, 0);
  return Math.max(0, dailyBudget - spentToday);
}