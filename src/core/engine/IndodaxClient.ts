// ============================================================
// ABBI DeskLive — Indodax Public API Client (Browser-Safe)
// ============================================================
// PERUBAHAN: Method getInfo() DIHAPUS — private API pindah ke backend.
// File ini hanya untuk public API: ticker, candles, depth.
// Tidak ada lagi akses ke API_SECRET.
// ============================================================

import type { TickerData, CandleData } from '../types';

const INDODAX_PUBLIC_API = '/api/indodax';

// ─── Helper: Generate Realistic Mock Candles ────────────
function generateRealisticCandles(basePrice: number, high24: number, low24: number, timeframe: string, count: number = 30): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice * 0.97;
  const now = Date.now();

  let interval: number;
  switch (timeframe) {
    case '1M': interval = 30 * 24 * 60 * 60 * 1000; break;
    case '1W': interval = 7 * 24 * 60 * 60 * 1000; break;
    case '1D': interval = 24 * 60 * 60 * 1000; break;
    case '4H': interval = 4 * 60 * 60 * 1000; break;
    case '1H': interval = 60 * 60 * 1000; break;
    case '15M': interval = 15 * 60 * 1000; break;
    default: interval = 24 * 60 * 60 * 1000;
  }

  const range = (high24 || basePrice * 1.02) - (low24 || basePrice * 0.98);
  const minPrice = low24 || basePrice * 0.95;
  const maxPrice = high24 || basePrice * 1.05;

  for (let i = count; i >= 0; i--) {
    const progress = 1 - (i / count);
    const targetPrice = basePrice * (0.95 + progress * 0.1);
    const trend = (targetPrice - price) * 0.3;
    const volatility = range * 0.4;
    const change = (Math.random() - 0.5) * volatility + trend;

    let open = price;
    let close = Math.max(minPrice * 0.98, Math.min(maxPrice * 1.02, price + change));
    let high = Math.max(open, close) + Math.random() * volatility * 0.3;
    let low = Math.min(open, close) - Math.random() * volatility * 0.3;

    high = Math.min(high, maxPrice * 1.03);
    low = Math.max(low, minPrice * 0.97);

    candles.push({
      timestamp: now - i * interval,
      open, high, low, close,
      volume: Math.random() * basePrice * 30000 + basePrice * 5000,
    });
    price = close;
  }

  return candles;
}

// ═══════════════════════════════════════════════════════════
// INDODAX CLIENT CLASS (Public API Only)
// ═══════════════════════════════════════════════════════════

export class IndodaxClient {
  private cachedTicker: Map<string, { data: TickerData; time: number }> = new Map();
  private priceTracking: Map<string, { price: number; time: number }> = new Map();

  // ─── PUBLIC API ─────────────────────────────────────────

  async fetchTicker(symbol: string): Promise<TickerData | null> {
    const pair = `${symbol.toLowerCase()}_idr`;

    const cached = this.cachedTicker.get(symbol);
    if (cached && Date.now() - cached.time < 5000) {
      return cached.data;
    }

    try {
      console.log(`[IndodaxClient] Fetching ticker: ${pair}`);
      const response = await fetch(`${INDODAX_PUBLIC_API}/ticker/${pair}`);

      if (response.status === 404) {
        console.warn(`[IndodaxClient] Pair ${pair} not found`);
        return null;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log(`[IndodaxClient] Ticker response:`, JSON.stringify(data).substring(0, 300));

      if (!data.ticker) {
        console.warn(`[IndodaxClient] No ticker data for ${pair}`);
        return null;
      }

      const t = data.ticker;
      const lastPrice = parseFloat(t.last);

      let change24h = parseFloat(t.percent_change_24h) || parseFloat(t.change_24h) || parseFloat(t.change24h) || parseFloat(t.change) || 0;

      if (change24h === 0) {
        const tracked = this.priceTracking.get(symbol);
        const now = Date.now();

        if (tracked && now - tracked.time < 24 * 60 * 60 * 1000 && tracked.price > 0) {
          change24h = ((lastPrice - tracked.price) / tracked.price) * 100;
        }

        if (!tracked || (now - tracked.time) > 24 * 60 * 60 * 1000) {
          this.priceTracking.set(symbol, { price: lastPrice, time: now });
        }
      }

      if (change24h === 0) {
        const buy = parseFloat(t.buy) || 0;
        const sell = parseFloat(t.sell) || 0;
        if (buy > 0 && sell > 0) {
          change24h = ((sell - buy) / buy) * 100;
        }
      }

      const result: TickerData = {
        symbol,
        price: lastPrice,
        priceIdr: lastPrice,
        change24h: change24h,
        change7d: parseFloat(t.percent_change_7d) || parseFloat(t.change_7d) || parseFloat(t.change7d) || 0,
        volume24h: parseFloat(t.vol_idr) || 0,
        high24h: parseFloat(t.high) || 0,
        low24h: parseFloat(t.low) || 0,
        lastUpdated: new Date().toISOString(),
      };

      this.cachedTicker.set(symbol, { data: result, time: Date.now() });
      return result;

    } catch (error) {
      console.warn(`[IndodaxClient] fetchTicker failed:`, error);
      if (cached) return cached.data;
      return null;
    }
  }

  resetPriceTracking(symbol: string) {
    this.priceTracking.delete(symbol);
    console.log(`[IndodaxClient] Reset price tracking for ${symbol}`);
  }

  async fetchAllTickers(): Promise<TickerData[]> {
    try {
      const response = await fetch(`${INDODAX_PUBLIC_API}/ticker_all`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const tickers: TickerData[] = [];

      for (const [pair, ticker] of Object.entries(data.tickers)) {
        const symbol = pair.replace('_idr', '').toUpperCase();
        const t = ticker as any;

        tickers.push({
          symbol,
          price: parseFloat(t.last),
          priceIdr: parseFloat(t.last),
          change24h: parseFloat(t.percent_change_24h) || 0,
          change7d: parseFloat(t.percent_change_7d) || parseFloat(t.change_7d) || parseFloat(t.change7d) || 0,
          volume24h: parseFloat(t.vol_idr) || 0,
          high24h: parseFloat(t.high) || 0,
          low24h: parseFloat(t.low) || 0,
          lastUpdated: new Date().toISOString(),
        });
      }
      return tickers;
    } catch (error) {
      console.error('[IndodaxClient] fetchAllTickers failed:', error);
      return [];
    }
  }

  async fetchCandles(symbol: string, timeframe: string): Promise<CandleData[]> {
    const pair = `${symbol.toLowerCase()}_idr`;
    const ticker = await this.fetchTicker(symbol);
    const basePrice = ticker?.price || 100000000;
    const high24 = ticker?.high24h || basePrice * 1.02;
    const low24 = ticker?.low24h || basePrice * 0.98;

    const resolutionMap: Record<string, string> = {
      '1M': 'M', '1W': 'W', '1D': 'D', '4H': '240', '1H': '60', '15M': '15',
    };
    const resolution = resolutionMap[timeframe] || 'D';
    const to = Math.floor(Date.now() / 1000);
    const from = to - (30 * 24 * 60 * 60);

    const endpoints = [
      `${INDODAX_PUBLIC_API}/tradingview/history_v2?symbol=${pair}&resolution=${resolution}&from=${from}&to=${to}`,
      `${INDODAX_PUBLIC_API}/tradingview/history?symbol=${pair}&resolution=${resolution}&from=${from}&to=${to}`,
      `${INDODAX_PUBLIC_API}/chart?pair=${pair}&period=${resolution}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`[IndodaxClient] Trying: ${url}`);
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const candles = data.map((c: any) => ({
            timestamp: (c.time || c.t || 0) * 1000,
            open: parseFloat(c.open || c.o || 0),
            high: parseFloat(c.high || c.h || 0),
            low: parseFloat(c.low || c.l || 0),
            close: parseFloat(c.close || c.c || 0),
            volume: parseFloat(c.volume || c.v || 0),
          })).filter((c: CandleData) => c.timestamp > 0 && c.close > 0);
          if (candles.length > 0) return candles;
        }

        if (data.t && Array.isArray(data.t) && data.t.length > 0) {
          const candles: CandleData[] = [];
          for (let i = 0; i < data.t.length; i++) {
            candles.push({
              timestamp: data.t[i] * 1000,
              open: parseFloat(data.o[i]),
              high: parseFloat(data.h[i]),
              low: parseFloat(data.l[i]),
              close: parseFloat(data.c[i]),
              volume: parseFloat(data.v[i] || 0),
            });
          }
          if (candles.length > 0) return candles;
        }
      } catch (error) {
        console.warn(`[IndodaxClient] Endpoint error:`, error);
      }
    }

    console.warn(`[IndodaxClient] All endpoints failed, using realistic mock`);
    const mockCandles = generateRealisticCandles(basePrice, high24, low24, timeframe, 30);
    (mockCandles as any).__isMock = true;
    return mockCandles;
  }

  async fetchDepth(symbol: string): Promise<{ bids: [number, number][]; asks: [number, number][] }> {
    const pair = `${symbol.toLowerCase()}_idr`;
    try {
      const response = await fetch(`${INDODAX_PUBLIC_API}/depth/${pair}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        bids: data.buy?.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]) || [],
        asks: data.sell?.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]) || [],
      };
    } catch (error) {
      return { bids: [], asks: [] };
    }
  }

  // ❌ REMOVED: getInfo() — private API moved to backend
  // ❌ REMOVED: getStoredBalance() — no localStorage for sensitive data
  // ❌ REMOVED: setStoredBalance() — no localStorage for sensitive data
}

export const indodaxClient = new IndodaxClient();