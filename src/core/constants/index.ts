// ============================================================
// ABBI DeskLive — Constants & Configuration (V5 FINAL + Backward Compat)
// ============================================================

import type { CoinConfig } from '../types';

export const APP_NAME = 'ABBI DeskLive';
export const APP_VERSION = '5.0.0';
export const APP_TAGLINE = 'Smart Accumulator Portfolio';

// ============================================================
// API CONFIG
// ============================================================
export const INDODAX_API_BASE = 'https://api.indodax.com';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

/** API Key placeholder — frontend tidak menyimpan secret, backend yang handle auth */
export const INDODAX_API_KEY = import.meta.env.VITE_INDODAX_API_KEY || '';

// ============================================================
// 20 COIN UNIVERSE — MARKET CAP WEIGHTED
// ============================================================
export const COIN_UNIVERSE: CoinConfig[] = [
  { symbol: 'BTC', name: 'Bitcoin', marketCapWeight: 0.40, pair: 'btc_idr', category: 'large' },
  { symbol: 'ETH', name: 'Ethereum', marketCapWeight: 0.20, pair: 'eth_idr', category: 'large' },
  { symbol: 'BNB', name: 'BNB', marketCapWeight: 0.10, pair: 'bnb_idr', category: 'large' },
  { symbol: 'SOL', name: 'Solana', marketCapWeight: 0.10, pair: 'sol_idr', category: 'large' },
  { symbol: 'XRP', name: 'Ripple', marketCapWeight: 0.05, pair: 'xrp_idr', category: 'large' },
  { symbol: 'ADA', name: 'Cardano', marketCapWeight: 0.03, pair: 'ada_idr', category: 'mid-large' },
  { symbol: 'AVAX', name: 'Avalanche', marketCapWeight: 0.03, pair: 'avax_idr', category: 'mid-large' },
  { symbol: 'LINK', name: 'Chainlink', marketCapWeight: 0.02, pair: 'link_idr', category: 'mid-large' },
  { symbol: 'DOT', name: 'Polkadot', marketCapWeight: 0.02, pair: 'dot_idr', category: 'mid-large' },
  { symbol: 'MATIC', name: 'Polygon', marketCapWeight: 0.02, pair: 'matic_idr', category: 'mid-large' },
  { symbol: 'NEAR', name: 'NEAR Protocol', marketCapWeight: 0.02, pair: 'near_idr', category: 'mid' },
  { symbol: 'ARB', name: 'Arbitrum', marketCapWeight: 0.015, pair: 'arb_idr', category: 'mid' },
  { symbol: 'OP', name: 'Optimism', marketCapWeight: 0.015, pair: 'op_idr', category: 'mid' },
  { symbol: 'SEI', name: 'Sei', marketCapWeight: 0.015, pair: 'sei_idr', category: 'mid' },
  { symbol: 'SUI', name: 'Sui', marketCapWeight: 0.015, pair: 'sui_idr', category: 'mid' },
  { symbol: 'INJ', name: 'Injective', marketCapWeight: 0.01, pair: 'inj_idr', category: 'growth' },
  { symbol: 'RENDER', name: 'Render', marketCapWeight: 0.01, pair: 'render_idr', category: 'growth' },
  { symbol: 'TIA', name: 'Celestia', marketCapWeight: 0.01, pair: 'tia_idr', category: 'growth' },
  { symbol: 'PYTH', name: 'Pyth Network', marketCapWeight: 0.01, pair: 'pyth_idr', category: 'growth' },
  { symbol: 'JUP', name: 'Jupiter', marketCapWeight: 0.01, pair: 'jup_idr', category: 'growth' },
];

// ============================================================
// POSITION LIMITS (% of total portfolio — prevents altcoin overexposure)
// ============================================================
export const POSITION_LIMITS: Record<string, number> = {
  BTC: 0.40,
  ETH: 0.25,
  BNB: 0.10,
  SOL: 0.10,
  XRP: 0.05,
  ADA: 0.05,
  AVAX: 0.05,
  LINK: 0.05,
  DOT: 0.05,
  MATIC: 0.05,
  NEAR: 0.03,
  ARB: 0.03,
  OP: 0.03,
  SEI: 0.03,
  SUI: 0.03,
  INJ: 0.02,
  RENDER: 0.02,
  TIA: 0.02,
  PYTH: 0.02,
  JUP: 0.02,
};

// ============================================================
// BUDGET TIERS (Signal-based)
// ============================================================
export const BUDGET_LOW = 300_000;   // Score 75-84
export const BUDGET_HIGH = 500_000;  // Score 85-100
export const MIN_TRADE = 50_000;
export const MAX_PER_TRADE = 600_000;

// ============================================================
// EXIT PARAMETERS (V5 — Fixed TP)
// ============================================================
export const TP1_TARGET = 0.10;   // +10% — sell 50%
export const TP2_TARGET = 0.15;   // +15% — sell remaining 50%

// ============================================================
// ENTRY THRESHOLDS (Coin-specific + Regime-aware)
// ============================================================
export const COIN_THRESHOLDS: Record<string, Record<string, number>> = {
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

export const REGIME_MULTIPLIER: Record<string, number> = {
  bear: 1.25,
  bull: 0.75,
  sideways: 0.0,
};

// ============================================================
// CIRCUIT BREAKER
// ============================================================
export const CIRCUIT_BREAKER_DRAWDOWN = 0.12;
export const COOLDOWN_HOURS = 24;

// ============================================================
// SCANNING & TIMING
// ============================================================
export const SCAN_INTERVAL_MINUTES = 15;
export const PRICE_UPDATE_INTERVAL_MS = 30000;

// ============================================================
// REBALANCE SETTINGS
// ============================================================
export const REBALANCE_THRESHOLD = 0.05;

// ============================================================
// UI CONSTANTS
// ============================================================
export const CHART_TIMEFRAMES = [
  { label: '1M', value: '1M' },
  { label: '1W', value: '1W' },
  { label: '1D', value: '1D' },
  { label: '4H', value: '4H' },
  { label: '1H', value: '1H' },
  { label: '15M', value: '15M' },
];

export const AI_VERDICT_COLORS = {
  STRONG_BUY: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50', icon: '🟢' },
  ACCUMULATE: { bg: 'bg-emerald-400/20', text: 'text-emerald-300', border: 'border-emerald-400/50', icon: '🟩' },
  HOLD: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', icon: '🟡' },
  REDUCE: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50', icon: '🟧' },
  STRONG_SELL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', icon: '🔴' },
};

// ============================================================
// ENVIRONMENT
// ============================================================
const envMode = import.meta.env.VITE_API_MODE;
export const API_MODE: 'mock' | 'live' = (envMode === 'live' || envMode === 'mock') ? envMode : 'mock';

export const MAX_DAILY_INVESTMENT = 5_000_000;

// Auto trade — controlled by backend, frontend only displays
export const AUTO_TRADE_ENABLED = true;

// ============================================================
// BACKWARD COMPATIBILITY — digunakan oleh utils/index.ts & engine lama
// ============================================================

/** Minimum entry score untuk filter global & rebalance alert (75-85 range) */
export const ENTRY_SCORE_MIN = 75;

/** Strong entry signal threshold (85+ poin → budget HIGH 500rb) */
export const ENTRY_SCORE_STRONG = 85;

/** V3 trailing stop — ScaleOutEngine lama & utils masih mengimport */
export const TP2_TRAILING = 0.08;

/** RSI thresholds — digunakan oleh utils/index.ts interpretRSI & generateAIAnalysis */
export const RSI_DEEP_DISCOUNT = 30;
export const RSI_DISCOUNT_MAX = 38;
export const RSI_FAIR_MAX = 55;
export const RSI_PREMIUM_MIN = 70;
export const RSI_OVERBOUGHT = 80;