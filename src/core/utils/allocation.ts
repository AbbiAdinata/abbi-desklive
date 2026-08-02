// ============================================================
// ABBI DeskLive — Market-Cap Weighted Allocation Engine (V5.1)
// FIXED: 
//   1. Position limit murni dari portfolioValue (bukan dicampur cash)
//   2. Guard division by zero (portfolioValue <= 0)
//   3. Hard cap marketCapWeight — single coin tidak boleh melebihi target bobot
//   4. Sort descending by marketCapWeight — BTC/ETH diprioritaskan
//   5. Cooldown 6 jam — prevent re-entry berulang saat sinyal masih di atas threshold
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

interface BoostedItem {
  symbol: string;
  rawAllocation: number;
  marketCapWeight: number;
  signalScore: number;
  signalBoost: number;
  budgetTier: 'LOW' | 'HIGH';
}

// ─── Cooldown tracking (in-memory, reset saat restart) ─────
const entryCooldownMap = new Map<string, number>();
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Cek apakah symbol masih dalam cooldown
 */
function isInCooldown(symbol: string): boolean {
  const lastEntry = entryCooldownMap.get(symbol);
  if (!lastEntry) return false;
  return Date.now() - lastEntry < COOLDOWN_MS;
}

/**
 * Set cooldown untuk symbol
 */
function setCooldown(symbol: string): void {
  entryCooldownMap.set(symbol, Date.now());
}

/**
 * Reset cooldown (untuk testing/debug)
 */
export function resetCooldown(symbol?: string): void {
  if (symbol) {
    entryCooldownMap.delete(symbol);
  } else {
    entryCooldownMap.clear();
  }
}

/**
 * Hitung alokasi pembelian berdasarkan:
 *   1. Signal score → budget tier (300k vs 500k)
 *   2. Market cap weight (hard cap — tidak boleh melebihi)
 *   3. Regime multiplier
 *   4. Position limit (max % of portfolio per coin)
 *   5. Cooldown guard (6 jam)
 */
export function calculateAllocations(
  signals: EntrySignal[],
  regime: 'bull' | 'bear' | 'sideways',
  portfolioValue: number,
  positionValues: Record<string, number>,
  dailyBudgetRemaining: number,
  cashAvailable: number
): AllocationResult[] {
  // ─── Guard 1: Portfolio value harus positif ─────────────
  if (portfolioValue <= 0) {
    console.log('[Allocation] SKIP: portfolioValue <= 0, waiting for baseline');
    return [];
  }

  // ─── Guard 2: Cash harus cukup untuk minimal 1 trade ─────
  if (cashAvailable < MIN_TRADE) {
    console.log(`[Allocation] SKIP: cashAvailable Rp${cashAvailable.toLocaleString('id-ID')} < MIN_TRADE`);
    return [];
  }

  const eligible = signals.filter((s) => {
    const threshold = getThreshold(s.symbol, regime);
    return s.score >= threshold;
  });

  if (eligible.length === 0) return [];

  const regimeMult = REGIME_MULTIPLIER[regime] || 1.0;
  if (regimeMult === 0) return [];

  // ─── Build boosted array dengan marketCapWeight ───────────
  const boosted: BoostedItem[] = [];

  for (const signal of eligible) {
    const coin = COIN_UNIVERSE.find((c) => c.symbol === signal.symbol);
    if (!coin) continue;

    // Budget tier based on signal score
    const budgetTier: 'LOW' | 'HIGH' = signal.score >= 85 ? 'HIGH' : 'LOW';
    const baseBudget = budgetTier === 'HIGH' ? BUDGET_HIGH : BUDGET_LOW;

    // Signal boost: score 70→0.85, 85→1.0, 100→1.15
    const signalBoost = Math.max(0.5, Math.min(1.3, 0.85 + (signal.score - 70) / 100));

    const rawAllocation = baseBudget * coin.marketCapWeight * signalBoost * regimeMult;

    boosted.push({
      symbol: signal.symbol,
      rawAllocation,
      marketCapWeight: coin.marketCapWeight,
      signalScore: signal.score,
      signalBoost,
      budgetTier,
    });
  }

  if (boosted.length === 0) return [];

  // ─── FIX 4: Sort descending by marketCapWeight ──────────
  // BTC (0.40) diprioritaskan, then ETH (0.20), etc.
  boosted.sort((a: BoostedItem, b: BoostedItem) => b.marketCapWeight - a.marketCapWeight);

  // Normalize
  const totalRaw = boosted.reduce((sum: number, b: BoostedItem) => sum + b.rawAllocation, 0);
  const scaleFactor = totalRaw > dailyBudgetRemaining ? dailyBudgetRemaining / totalRaw : 1;

  const results: AllocationResult[] = [];

  for (const item of boosted) {
    // ─── FIX 5: Cooldown check ───────────────────────────
    if (isInCooldown(item.symbol)) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - (entryCooldownMap.get(item.symbol) || 0))) / 60000);
      console.log(`[Allocation] Skip ${item.symbol}: in cooldown (${remaining} min remaining)`);
      continue;
    }

    let amount = Math.floor(item.rawAllocation * scaleFactor);

    // ─── FIX 1: Position limit — murni dari portfolioValue ─
    // Bukan Math.max(portfolioValue, cashAvailable)
    const limitPct = POSITION_LIMITS[item.symbol] || 0.02;
    const maxAllowedValue = portfolioValue * limitPct;
    const currentValue = positionValues[item.symbol] || 0;
    const roomRemaining = maxAllowedValue - currentValue;

    if (roomRemaining <= 0) {
      // FIX: Guard division by zero — portfolioValue sudah dicek di atas
      const currentPct = portfolioValue > 0 ? (currentValue / portfolioValue * 100).toFixed(1) : 'N/A';
      const limitPctDisplay = (limitPct * 100).toFixed(0);
      console.log(`[Allocation] Skip ${item.symbol}: at position limit (${currentPct}% / ${limitPctDisplay}%)`);
      continue;
    }

    // ─── FIX 2: Hard cap marketCapWeight ──────────────────
    // Single coin tidak boleh melebihi target bobot market cap-nya
    // meski position limit teknis masih ada ruang
    const targetWeightValue = portfolioValue * item.marketCapWeight;
    const weightRoomRemaining = targetWeightValue - currentValue;

    if (weightRoomRemaining <= 0) {
      console.log(`[Allocation] Skip ${item.symbol}: at marketCapWeight limit (${(item.marketCapWeight * 100).toFixed(1)}% of portfolio)`);
      continue;
    }

    // Gunakan yang lebih ketat: position limit vs market cap weight
    const effectiveRoom = Math.min(roomRemaining, weightRoomRemaining);

    amount = Math.min(amount, Math.floor(effectiveRoom), MAX_PER_TRADE, cashAvailable);

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

    // ─── FIX 5: Set cooldown setelah allocate ─────────────
    setCooldown(item.symbol);

    // Deduct from available cash for next coin
    cashAvailable -= amount;
  }

  const finalTotal = results.reduce((sum: number, r: AllocationResult) => sum + r.amountIdr, 0);
  console.log(
    `[Allocation] ${results.length} allocations, total Rp${finalTotal.toLocaleString('id-ID')}`
  );
  return results;
}

export function getThreshold(symbol: string, regime: string): number {
  const thresholds: Record<string, Record<string, number>> = {
    BTC: { bear: 50, bull: 75, sideways: 85 },
    ETH: { bear: 45, bull: 70, sideways: 85 },
    BNB: { bear: 45, bull: 70, sideways: 85 },
    SOL: { bear: 45, bull: 70, sideways: 85 },
    XRP: { bear: 40, bull: 65, sideways: 85 },
    ADA: { bear: 40, bull: 65, sideways: 85 },
    AVAX: { bear: 40, bull: 65, sideways: 85 },
    LINK: { bear: 40, bull: 65, sideways: 85 },
    DOT: { bear: 40, bull: 65, sideways: 85 },
    MATIC: { bear: 40, bull: 65, sideways: 85 },
    NEAR: { bear: 38, bull: 62, sideways: 85 },
    ARB: { bear: 38, bull: 62, sideways: 85 },
    OP: { bear: 38, bull: 62, sideways: 85 },
    SEI: { bear: 38, bull: 62, sideways: 85 },
    SUI: { bear: 38, bull: 62, sideways: 85 },
    INJ: { bear: 35, bull: 60, sideways: 85 },
    RENDER: { bear: 35, bull: 60, sideways: 85 },
    TIA: { bear: 35, bull: 60, sideways: 85 },
    PYTH: { bear: 35, bull: 60, sideways: 85 },
    JUP: { bear: 35, bull: 60, sideways: 85 },
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
    .reduce((sum: number, t) => sum + t.total, 0);
  return Math.max(0, dailyBudget - spentToday);
}
