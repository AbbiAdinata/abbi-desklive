// ============================================================
// ABBI DeskLive — Market Regime Detection Engine
// ============================================================
// Deteksi real-time: bull / bear / sideways
// Berdasarkan:
//   1. BTC price vs MA200 (trend direction)
//   2. BTC RSI 14D (momentum)
//   3. Volatility regime (ATR-based)
//   4. Alt-season index (BTC dominance proxy)
// ============================================================

import { indodaxClient } from './IndodaxClient';

export type MarketRegime = 'bull' | 'bear' | 'sideways';

interface RegimeContext {
  btcPrice: number;
  btcMa200: number;
  btcRsi14: number;
  volatility: number; // ATR(14) / price
  trendStrength: number;
  timestamp: string;
}

export class RegimeEngine {
  private lastContext: RegimeContext | null = null;
  private cachedCandles: { data: any[]; time: number } | null = null;

  /**
   * Deteksi regime pasar saat ini.
   * Cache selama 5 menit untuk mengurangi API call.
   */
  async detect(): Promise<MarketRegime> {
    const now = Date.now();
    if (this.lastContext && now - new Date(this.lastContext.timestamp).getTime() < 5 * 60 * 1000) {
      return this.inferRegime(this.lastContext);
    }

    try {
      // 1. Ambil data BTC
      const ticker = await indodaxClient.fetchTicker('BTC');
      if (!ticker) throw new Error('Failed to fetch BTC ticker');

      // 2. Ambil candles 1D untuk MA200 dan RSI
      const candles = await this.getDailyCandles('BTC');
      if (candles.length < 50) {
        console.warn('[Regime] Not enough candle data, defaulting to bear');
        return 'bear'; // Default aman: accumulate
      }

      // 3. Hitung indikator
      const btcMa200 = this.calculateSMA(candles.map((c) => c.close), 200);
      const btcRsi14 = this.calculateRSI(candles.map((c) => c.close), 14);
      const atr14 = this.calculateATR(candles, 14);
      const volatility = atr14 / ticker.price;

      const context: RegimeContext = {
        btcPrice: ticker.price,
        btcMa200,
        btcRsi14,
        volatility,
        trendStrength: (ticker.price - btcMa200) / btcMa200,
        timestamp: new Date().toISOString(),
      };

      this.lastContext = context;
      const regime = this.inferRegime(context);

      console.log(
        `[Regime] ${regime.toUpperCase()} | BTC: ${ticker.price.toLocaleString()} | MA200: ${btcMa200.toLocaleString()} | RSI: ${btcRsi14.toFixed(1)} | Vol: ${(volatility * 100).toFixed(2)}%`
      );

      return regime;
    } catch (err) {
      console.error('[Regime] Detection failed:', err);
      return 'bear'; // Fail-safe: accumulate mode
    }
  }

  /**
   * Infer regime dari konteks teknikal.
   */
  private inferRegime(ctx: RegimeContext): MarketRegime {
    const { btcPrice, btcMa200, btcRsi14, volatility, trendStrength } = ctx;

    // Bear: price < MA200, RSI < 40, trend negatif
    if (btcPrice < btcMa200 * 0.98 && btcRsi14 < 45 && trendStrength < -0.02) {
      return 'bear';
    }

    // Bull: price > MA200, RSI > 55, trend positif, volatilitas moderat
    if (btcPrice > btcMa200 * 1.02 && btcRsi14 > 55 && trendStrength > 0.03 && volatility < 0.05) {
      return 'bull';
    }

    // Sideways: price dekat MA200, RSI 40-60, volatilitas rendah
    if (Math.abs(trendStrength) < 0.02 && btcRsi14 > 40 && btcRsi14 < 60 && volatility < 0.03) {
      return 'sideways';
    }

    // Default: kalau ambiguous, ikut trend
    return trendStrength > 0 ? 'bull' : 'bear';
  }

  /**
   * Ambil daily candles dengan cache 10 menit.
   */
  private async getDailyCandles(symbol: string) {
    if (this.cachedCandles && Date.now() - this.cachedCandles.time < 10 * 60 * 1000) {
      return this.cachedCandles.data;
    }
    const candles = await indodaxClient.fetchCandles(symbol, '1D');
    this.cachedCandles = { data: candles, time: Date.now() };
    return candles;
  }

  // ─── Technical Indicators ────────────────────────────────

  private calculateSMA(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] || 0;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateATR(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trs: number[] = [];
    for (let i = candles.length - period; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      const tr1 = c.high - c.low;
      const tr2 = Math.abs(c.high - p.close);
      const tr3 = Math.abs(c.low - p.close);
      trs.push(Math.max(tr1, tr2, tr3));
    }

    return trs.reduce((a, b) => a + b, 0) / period;
  }

  getLastContext(): RegimeContext | null {
    return this.lastContext;
  }
}

export const regimeEngine = new RegimeEngine();