// ============================================================
// ABBI DeskLive — Utility Functions
// ============================================================

import type { EntrySignal, Position, AIAnalysis, SupportResistanceLevel, RSIReading } from '../types';
import {
  RSI_DEEP_DISCOUNT,
  RSI_DISCOUNT_MAX,
  RSI_FAIR_MAX,
  RSI_PREMIUM_MIN,
  RSI_OVERBOUGHT,
  ENTRY_SCORE_MIN,
  ENTRY_SCORE_STRONG,
  TP1_TARGET,
  TP2_TRAILING,
} from '../constants';

// ─── Formatters ───────────────────────────────────────────

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function getPnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

export function getPnlBgColor(value: number): string {
  if (value > 0) return 'bg-emerald-500/10';
  if (value < 0) return 'bg-red-500/10';
  return 'bg-slate-500/10';
}

// ─── RSI Interpretation ─────────────────────────────────────

export function interpretRSI(rsi: number): RSIReading['interpretation'] {
  if (rsi < RSI_DEEP_DISCOUNT) return 'deep_discount';
  if (rsi < RSI_DISCOUNT_MAX) return 'discount';
  if (rsi < RSI_FAIR_MAX) return 'fair';
  if (rsi < RSI_OVERBOUGHT) return 'premium';
  return 'overbought';
}

export function getRSILabel(rsi: number): string {
  const interp = interpretRSI(rsi);
  const labels: Record<string, string> = {
    deep_discount: 'Deep Discount',
    discount: 'Discount',
    fair: 'Fair Value',
    premium: 'Premium',
    overbought: 'Overbought',
  };
  return labels[interp];
}

// ─── Entry Score Calculator ─────────────────────────────────

export interface ScoreComponents {
  trendScore: number;      // 0-30
  valuationScore: number;  // 0-40
  supportScore: number;    // 0-30
}

export function calculateEntryScore(
  price: number,
  ma20: number,
  ma50: number,
  ma200: number,
  rsi: number,
  bbLower: number,
  bbUpper: number,
  supportLevels: SupportResistanceLevel[]
): { total: number; components: ScoreComponents; trendPhase: EntrySignal['trendPhase'] } {
  // ── Trend Analysis (0-30) ──
  let trendScore = 0;
  let trendPhase: EntrySignal['trendPhase'] = 'neutral';

  const belowMA200 = price < ma200;
  const ma50Falling = ma50 < ma200 * 1.02;
  const belowMA20 = price < ma20;
  const ma200Rising = ma200 > ma200 * 0.98; // Simplified

  if (belowMA200 && ma50Falling) {
    trendScore = 28;
    trendPhase = 'structural_discount';
  } else if (belowMA20 && ma200Rising) {
    trendScore = 20;
    trendPhase = 'healthy_pullback';
  } else if (price > ma20 && price > ma50 && price > ma200) {
    trendScore = 5;
    trendPhase = 'overextended';
  } else {
    trendScore = 12;
    trendPhase = 'neutral';
  }

  // ── Valuation Analysis (0-40) ──
  let valuationScore = 0;

  if (rsi < RSI_DEEP_DISCOUNT) {
    valuationScore = 38;
  } else if (rsi < RSI_DISCOUNT_MAX) {
    valuationScore = 32;
  } else if (rsi < RSI_FAIR_MAX) {
    valuationScore = 20;
  } else if (rsi < RSI_OVERBOUGHT) {
    valuationScore = 8;
  } else {
    valuationScore = 0;  // FIX#4: RSI > 80 = 0 poin (tidak bisa entry)
  }

  // FIX#4: Cap total score kalau RSI overbought
  // RSI > 70 (premium/overbought) = max score 40 (tidak eligible entry)
  // RSI > 80 (overbought) = max score 20 (strong sell territory)

  // Bonus jika Bollinger lower tersentuh
  const bbTouchBonus = price <= bbLower * 1.02 ? 4 : 0;
  valuationScore = Math.min(40, valuationScore + bbTouchBonus);

  // ── Support Confluence (0-30) ──
  let supportScore = 0;

  const nearSupport = supportLevels.filter((s) => {
    const distance = Math.abs(price - s.price) / s.price;
    return distance < 0.05; // Within 5%
  });

  if (nearSupport.length > 0) {
    const strongest = nearSupport.reduce((a, b) => (a.touches > b.touches ? a : b));
    supportScore = Math.min(30, strongest.touches * 6 + 10);
  }

  const total = trendScore + valuationScore + supportScore;

  return {
    total: Math.min(100, Math.round(total)),
    components: { trendScore, valuationScore, supportScore },
    trendPhase,
  };
}

// ─── Exit Level Calculator ──────────────────────────────────

export function calcExitLevels(entryPrice: number): {
  tp1Price: number;
  tp2TrailingPercent: number;
} {
  return {
    tp1Price: entryPrice * (1 + TP1_TARGET),
    tp2TrailingPercent: TP2_TRAILING,
  };
}

export function checkScaleOut(
  position: Position,
  currentPrice: number
): { action: 'none' | 'tp1' | 'tp2'; reason: string } {
  // Check TP1
  if (!position.tp1Triggered && currentPrice >= position.tp1Price) {
    return {
      action: 'tp1',
      reason: `Harga ${currentPrice} mencapai TP1 (${position.tp1Price.toFixed(2)})`,
    };
  }

  // Check TP2 Trailing
  if (position.tp1Triggered) {
    const newPeak = Math.max(position.tp2PeakPrice, currentPrice);
    const trailingStop = newPeak * (1 - TP2_TRAILING);

    if (currentPrice <= trailingStop && position.tp2PeakPrice > 0) {
      return {
        action: 'tp2',
        reason: `Trailing stop triggered di ${currentPrice} (peak: ${position.tp2PeakPrice.toFixed(2)})`,
      };
    }
  }

  return { action: 'none', reason: '' };
}

// ─── AI Analysis Generator ─────────────────────────────────

export function generateAIAnalysis(
  symbol: string,
  currentPrice: number,
  ma20: number,
  ma50: number,
  ma200: number,
  rsi: number,
  bbUpper: number,
  bbMiddle: number,
  bbLower: number,
  supportLevels: SupportResistanceLevel[]
): AIAnalysis {
  const score = calculateEntryScore(currentPrice, ma20, ma50, ma200, rsi, bbLower, bbUpper, supportLevels);

  // Calculate price zones
  const volatility = (bbUpper - bbLower) / bbMiddle;
  const discountPrice = bbLower * 0.98;
  const fairValue = bbMiddle;
  const resistancePrice = bbUpper * 1.02;
  const supportPrice = supportLevels.length > 0
    ? Math.max(...supportLevels.map((s) => s.price))
    : bbLower * 0.95;

  // Verdict
  let verdict: AIAnalysis['verdict'];
  
  // FIX#4: Guard clause — RSI overbought = selalu SELL/REDUCE
  if (rsi >= RSI_OVERBOUGHT) {
    verdict = 'STRONG_SELL';
  } else if (rsi >= RSI_PREMIUM_MIN && score.total < ENTRY_SCORE_MIN) {
    verdict = 'REDUCE';
  } else if (score.total >= ENTRY_SCORE_STRONG && rsi < RSI_DEEP_DISCOUNT) {
    verdict = 'STRONG_BUY';
  } else if (score.total >= ENTRY_SCORE_MIN && rsi < RSI_DISCOUNT_MAX) {
    verdict = 'ACCUMULATE';
  } else if (rsi < RSI_DEEP_DISCOUNT) {
    verdict = 'ACCUMULATE';
  } else if (score.total >= 50 && rsi < RSI_FAIR_MAX) {
    verdict = 'HOLD';
  } else if (rsi >= RSI_PREMIUM_MIN) {
    verdict = 'REDUCE';
  } else {
    verdict = 'HOLD';
  }

  // Reasoning
  const reasoning: string[] = [];

  if (score.trendPhase === 'structural_discount') {
    reasoning.push('Harga di bawah MA-200 dengan MA-50 turun = diskon struktural');
  } else if (score.trendPhase === 'healthy_pullback') {
    reasoning.push('Pullback sehat di atas MA-200, tren bullish tetap intact');
  }

  if (rsi < RSI_DEEP_DISCOUNT) {
    reasoning.push(`RSI ${rsi.toFixed(1)} di zona deep discount (<30)`);
  } else if (rsi < RSI_DISCOUNT_MAX) {
    reasoning.push(`RSI ${rsi.toFixed(1)} di zona discount (30-38)`);
  }

  if (currentPrice <= bbLower * 1.02) {
    reasoning.push('Harga menyentuh lower Bollinger Band — zona akumulasi');
  }

  const nearSupport = supportLevels.filter((s) => Math.abs(currentPrice - s.price) / s.price < 0.03);
  if (nearSupport.length > 0) {
    reasoning.push(`Dekat support historis kuat di ${formatNumber(nearSupport[0].price)} (${nearSupport[0].touches}x tested)`);
  }

  if (reasoning.length === 0) {
    reasoning.push('Kondisi netral, tunggu diskon lebih dalam untuk akumulasi');
  }

  // Risk & Return
  const riskLevel: AIAnalysis['riskLevel'] = score.total >= 80 ? 'low' : score.total >= 60 ? 'medium' : 'high';
  const upside = ((resistancePrice - currentPrice) / currentPrice * 100);
  const expectedReturn = upside > 20 ? '20-40%' : upside > 10 ? '10-20%' : '5-10%';

  return {
    symbol,
    currentPrice,
    fairValue,
    discountPrice,
    resistancePrice,
    supportPrice,
    verdict,
    reasoning,
    riskLevel,
    expectedReturn,
    timestamp: new Date().toISOString(),
  };
}

// ─── Date/Time Helpers ──────────────────────────────────────

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

// ─── Rebalance Calculator ──────────────────────────────────

export function calculateRebalanceAllocation(
  totalCash: number,
  entrySignals: EntrySignal[]
): Array<{ symbol: string; amount: number; reason: string }> {
  const eligibleSignals = entrySignals.filter((s) => s.score >= ENTRY_SCORE_MIN);

  if (eligibleSignals.length === 0) return [];

  const totalScore = eligibleSignals.reduce((sum, s) => sum + s.score, 0);
  const allocations: Array<{ symbol: string; amount: number; reason: string }> = [];

  for (const signal of eligibleSignals) {
    const weight = signal.score / totalScore;
    const amount = totalCash * weight;
    allocations.push({
      symbol: signal.symbol,
      amount: Math.floor(amount),
      reason: `Score ${signal.score} — ${signal.recommendation}`,
    });
  }

  return allocations;
}
