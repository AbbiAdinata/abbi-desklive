// ============================================================
// ABBI DeskLive — Core Types
// ============================================================

export interface CoinConfig {
  symbol: string;
  name: string;
  marketCapWeight: number;
  pair: string;
  category: 'large' | 'mid-large' | 'mid' | 'growth';
}

export interface TickerData {
  symbol: string;
  price: number;
  priceIdr: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MALevels {
  ma20: number;
  ma50: number;
  ma200: number;
}

export interface RSIReading {
  value: number;
  timeframe: Timeframe;
  interpretation: 'deep_discount' | 'discount' | 'fair' | 'premium' | 'overbought';
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

export interface SupportResistanceLevel {
  price: number;
  touches: number;
  timeframe: '1D' | '1W' | '1M';
  lastTested: string;
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
}

export type Timeframe = '1M' | '1W' | '1D' | '4H' | '1H' | '15M';

export interface EntrySignal {
  symbol: string;
  score: number;
  trendPhase: 'structural_discount' | 'healthy_pullback' | 'neutral' | 'overextended';
  rsiStatus: RSIReading;
  bollingerStatus: 'below_lower' | 'at_lower' | 'between' | 'at_upper' | 'above_upper';
  supportConfluence: SupportResistanceLevel[];
  maAlignment: 'bullish' | 'mixed' | 'bearish';
  recommendation: 'STRONG_BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'STRONG_SELL';
  confidence: number; // 0-100
  timestamp: string;
}

export interface Position {
  symbol: string;
  avgEntryPrice: number;
  totalInvested: number;
  currentValue: number;
  quantity: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  tp1Triggered: boolean;
  tp1Price: number;
  tp2Trailing: number;
  tp2PeakPrice: number;
  status: 'accumulating' | 'tp1_hit' | 'tp2_trailing' | 'fully_exited';
  entryDate: string;
  lastUpdated: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  allocatedPercent: number;
  cashPercent: number;
  dayChange: number;
  dayChangePercent: number;
  bestPerformer: { symbol: string; pnlPercent: number } | null;
  worstPerformer: { symbol: string; pnlPercent: number } | null;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL_TP1' | 'SELL_TP2';
  price: number;
  quantity: number;
  total: number;
  pnl?: number;
  pnlPercent?: number;
  timestamp: string;
  note: string;
}

export interface CircuitBreakerStatus {
  isActive: boolean;
  triggeredAt: string | null;
  triggeredBy: 'portfolio_drawdown' | 'btc_crash' | 'manual' | null;
  drawdownPercent: number;
  cooldownUntil: string | null;
}

export interface AIAnalysis {
  symbol: string;
  currentPrice: number;
  fairValue: number;
  discountPrice: number;
  resistancePrice: number;
  supportPrice: number;
  verdict: 'STRONG_BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'STRONG_SELL';
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
  expectedReturn: string;
  timestamp: string;
}

export interface RotationPool {
  stablecoinBalance: number;
  targetPercent: number;
  currentPercent: number;
  lastRebalanced: string | null;
  isManualMode: boolean;
  note: string;
}

export interface SystemStatus {
  isRunning: boolean;
  lastScan: string | null;
  nextScan: string | null;
  mode: 'mock' | 'live';
  version: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export type ThemeMode = 'dark' | 'light';
