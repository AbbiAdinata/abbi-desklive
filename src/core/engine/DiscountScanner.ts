// ============================================================
// ABBI DeskLive — Discount Scanner (Scan 20 Coin)
// FIXED: generateMockPriceHistory → fetchCandles real dari Indodax
// Fallback ke mock hanya kalau API gagal
// ============================================================

import type { EntrySignal, SupportResistanceLevel, TickerData } from '../types';
import { COIN_UNIVERSE, ENTRY_SCORE_MIN } from '../constants';
import { calculateEntryScore, generateAIAnalysis } from '../utils';
import { indodaxClient } from './IndodaxClient';

// ─── Support/Resistance Database (Update berkala) ─────────
export const SUPPORT_RESISTANCE_DB: Record<string, SupportResistanceLevel[]> = {
  BTC: [
    { price: 115000, touches: 5, timeframe: '1D', lastTested: '2026-07-15', strength: 'very_strong' },
    { price: 112000, touches: 3, timeframe: '1W', lastTested: '2026-07-08', strength: 'strong' },
    { price: 108000, touches: 4, timeframe: '1D', lastTested: '2026-07-01', strength: 'strong' },
    { price: 120000, touches: 3, timeframe: '1D', lastTested: '2026-07-18', strength: 'moderate' },
    { price: 125000, touches: 2, timeframe: '1W', lastTested: '2026-07-12', strength: 'weak' },
  ],
  ETH: [
    { price: 3700, touches: 4, timeframe: '1D', lastTested: '2026-07-16', strength: 'strong' },
    { price: 3500, touches: 5, timeframe: '1W', lastTested: '2026-07-05', strength: 'very_strong' },
    { price: 3200, touches: 3, timeframe: '1W', lastTested: '2026-06-20', strength: 'strong' },
    { price: 4000, touches: 3, timeframe: '1D', lastTested: '2026-07-17', strength: 'moderate' },
    { price: 4200, touches: 2, timeframe: '1W', lastTested: '2026-07-10', strength: 'weak' },
  ],
  BNB: [
    { price: 700, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 680, touches: 3, timeframe: '1W', lastTested: '2026-07-02', strength: 'moderate' },
    { price: 750, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  SOL: [
    { price: 155, touches: 5, timeframe: '1D', lastTested: '2026-07-16', strength: 'very_strong' },
    { price: 145, touches: 3, timeframe: '1W', lastTested: '2026-07-04', strength: 'strong' },
    { price: 175, touches: 2, timeframe: '1D', lastTested: '2026-07-19', strength: 'weak' },
  ],
  XRP: [
    { price: 0.60, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 0.55, touches: 3, timeframe: '1W', lastTested: '2026-07-01', strength: 'moderate' },
    { price: 0.65, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  ADA: [
    { price: 0.45, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 0.42, touches: 3, timeframe: '1W', lastTested: '2026-07-03', strength: 'moderate' },
    { price: 0.52, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  AVAX: [
    { price: 27, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 25, touches: 3, timeframe: '1W', lastTested: '2026-07-02', strength: 'moderate' },
    { price: 30, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  LINK: [
    { price: 13.5, touches: 4, timeframe: '1D', lastTested: '2026-07-16', strength: 'strong' },
    { price: 12.8, touches: 3, timeframe: '1W', lastTested: '2026-07-05', strength: 'moderate' },
    { price: 15, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  DOT: [
    { price: 6.5, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 6.2, touches: 3, timeframe: '1W', lastTested: '2026-07-01', strength: 'moderate' },
    { price: 7.2, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  MATIC: [
    { price: 0.55, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 0.52, touches: 3, timeframe: '1W', lastTested: '2026-07-03', strength: 'moderate' },
    { price: 0.62, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  NEAR: [
    { price: 5.5, touches: 4, timeframe: '1D', lastTested: '2026-07-16', strength: 'strong' },
    { price: 5.2, touches: 3, timeframe: '1W', lastTested: '2026-07-04', strength: 'moderate' },
    { price: 6.2, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  ARB: [
    { price: 0.78, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 0.75, touches: 3, timeframe: '1W', lastTested: '2026-07-02', strength: 'moderate' },
    { price: 0.88, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  OP: [
    { price: 1.38, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 1.32, touches: 3, timeframe: '1W', lastTested: '2026-07-01', strength: 'moderate' },
    { price: 1.55, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  SEI: [
    { price: 0.32, touches: 4, timeframe: '1D', lastTested: '2026-07-16', strength: 'strong' },
    { price: 0.30, touches: 3, timeframe: '1W', lastTested: '2026-07-03', strength: 'moderate' },
    { price: 0.38, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  SUI: [
    { price: 0.88, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 0.85, touches: 3, timeframe: '1W', lastTested: '2026-07-02', strength: 'moderate' },
    { price: 0.98, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  INJ: [
    { price: 21, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 20, touches: 3, timeframe: '1W', lastTested: '2026-07-01', strength: 'moderate' },
    { price: 24, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  RENDER: [
    { price: 5.9, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 5.6, touches: 3, timeframe: '1W', lastTested: '2026-07-03', strength: 'moderate' },
    { price: 6.6, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  TIA: [
    { price: 4.6, touches: 4, timeframe: '1D', lastTested: '2026-07-16', strength: 'strong' },
    { price: 4.4, touches: 3, timeframe: '1W', lastTested: '2026-07-04', strength: 'moderate' },
    { price: 5.1, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
  PYTH: [
    { price: 0.26, touches: 4, timeframe: '1D', lastTested: '2026-07-15', strength: 'strong' },
    { price: 0.24, touches: 3, timeframe: '1W', lastTested: '2026-07-02', strength: 'moderate' },
    { price: 0.31, touches: 2, timeframe: '1D', lastTested: '2026-07-17', strength: 'weak' },
  ],
  JUP: [
    { price: 0.74, touches: 4, timeframe: '1D', lastTested: '2026-07-14', strength: 'strong' },
    { price: 0.70, touches: 3, timeframe: '1W', lastTested: '2026-07-01', strength: 'moderate' },
    { price: 0.84, touches: 2, timeframe: '1D', lastTested: '2026-07-18', strength: 'weak' },
  ],
};

// ─── Seeded PRNG untuk deterministik ──────────────────────

function seededRandom(seed: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  let state = seed;
  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

// ─── Calculate Technical Indicators ───────────────────────

function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollinger(prices: number[], period: number = 20, stdDev: number = 2) {
  const ma = calculateMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  const sd = Math.sqrt(variance);

  return {
    upper: ma + stdDev * sd,
    middle: ma,
    lower: ma - stdDev * sd,
    width: (2 * stdDev * sd) / ma,
  };
}

// ─── Discount Scanner Engine ────────────────────────────────

export class DiscountScanner {
  // ─── V5 Compatibility Methods ────────────────────────────

  /** Wrapper untuk indodaxClient.fetchTicker — dipakai SmartAccumulator V5 */
  async getTicker(symbol: string): Promise<TickerData | null> {
    return indodaxClient.fetchTicker(symbol);
  }

  /** V5 memanggil scanAll(regime) — terima parameter opsional */
  async scanAll(regime?: string): Promise<EntrySignal[]> {
    // Parameter regime di-ignore karena DiscountScanner scan independen
    return this.scanAllLegacy();
  }

  /** Method asli (private agar tidak konflik dengan scanAll overload) */
  private async scanAllLegacy(): Promise<EntrySignal[]> {
    const signals: EntrySignal[] = [];

    for (const coin of COIN_UNIVERSE) {
      try {
        const ticker = await indodaxClient.fetchTicker(coin.symbol);
        
        if (!ticker || ticker.price === 0) {
          console.warn(`[DiscountScanner] Skipping ${coin.symbol} — not available on Indodax`);
          continue;
        }
        
        const signal = await this.scanCoin(coin.symbol, ticker.price);
        signals.push(signal);
      } catch (err) {
        console.warn(`Failed to scan ${coin.symbol}:`, err);
      }
    }

    return signals.sort((a, b) => b.score - a.score);
  }

  async scanCoin(symbol: string, currentPrice: number): Promise<EntrySignal> {
    // ✅ FIX: Ambil histori harga real dari Indodax, fallback ke mock
    const prices = await this.getPriceHistory(symbol, currentPrice);

    const ma20 = calculateMA(prices, 20);
    const ma50 = calculateMA(prices, 50);
    const ma200 = calculateMA(prices, 200);
    const rsi = calculateRSI(prices);
    const bb = calculateBollinger(prices);
    const supportLevels = SUPPORT_RESISTANCE_DB[symbol] || [];

    const scoreResult = calculateEntryScore(
      currentPrice, ma20, ma50, ma200, rsi, bb.lower, bb.upper, supportLevels
    );

    const ai = generateAIAnalysis(
      symbol, currentPrice, ma20, ma50, ma200, rsi, bb.upper, bb.middle, bb.lower, supportLevels
    );

    let bollingerStatus: EntrySignal['bollingerStatus'];
    if (currentPrice < bb.lower) bollingerStatus = 'below_lower';
    else if (currentPrice <= bb.lower * 1.02) bollingerStatus = 'at_lower';
    else if (currentPrice > bb.upper) bollingerStatus = 'above_upper';
    else if (currentPrice >= bb.upper * 0.98) bollingerStatus = 'at_upper';
    else bollingerStatus = 'between';

    let maAlignment: EntrySignal['maAlignment'];
    if (ma20 > ma50 && ma50 > ma200) maAlignment = 'bullish';
    else if (ma20 < ma50 && ma50 < ma200) maAlignment = 'bearish';
    else maAlignment = 'mixed';

    return {
      symbol,
      score: scoreResult.total,
      trendPhase: scoreResult.trendPhase,
      rsiStatus: {
        value: rsi,
        timeframe: '4H',
        interpretation: rsi < 30 ? 'deep_discount' : rsi < 38 ? 'discount' : rsi < 55 ? 'fair' : rsi < 70 ? 'premium' : 'overbought',
      },
      bollingerStatus,
      supportConfluence: supportLevels.filter((s) => Math.abs(currentPrice - s.price) / s.price < 0.05),
      maAlignment,
      recommendation: ai.verdict,
      confidence: scoreResult.total,
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ FIX: Ambil data real dari API, fallback ke mock
  private async getPriceHistory(symbol: string, currentPrice: number): Promise<number[]> {
    try {
      const candles = await indodaxClient.fetchCandles(symbol, '1D');
      if (candles.length >= 50) {
        // Cek apakah mock
        if ((candles as any).__isMock) {
          console.warn(`[DiscountScanner] ${symbol}: API returned mock candles, using fallback`);
        } else {
          console.log(`[DiscountScanner] ${symbol}: using ${candles.length} real candles`);
        }
        return candles.map(c => c.close);
      }
    } catch (err) {
      console.warn(`[DiscountScanner] ${symbol}: fetchCandles failed, using mock fallback`);
    }
    return this.generateMockPriceHistory(currentPrice, symbol);
  }

  private generateMockPriceHistory(currentPrice: number, symbol: string): number[] {
    const today = new Date().toISOString().split('T')[0];
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 
                 today.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 997;
    const rand = seededRandom(seed);
    
    const prices: number[] = [];
    let price = currentPrice * 0.85;

    for (let i = 0; i < 250; i++) {
      const change = (rand() - 0.48) * price * 0.025;
      price += change;
      prices.push(price);
    }

    prices[prices.length - 1] = currentPrice;
    return prices;
  }
}

export const discountScanner = new DiscountScanner();
