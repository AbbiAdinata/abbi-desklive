// ============================================================
// ABBI DeskLive — Top Gainers & Losers Panel (IDR Pair)
// Update: Every 15 minutes
// ============================================================

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { COIN_UNIVERSE } from '@core/constants';

interface MoverData { symbol: string; priceIdr: number; change24h: number; }

export function TopMoversPanel() {
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchMovers = async () => {
    setLoading(true);
    try {
      const tickers = await indodaxClient.fetchAllTickers();
      const universeSymbols = new Set(COIN_UNIVERSE.map(c => c.symbol));
      const validTickers = tickers.filter(t => universeSymbols.has(t.symbol) && t.change24h !== 0).map(t => ({ symbol: t.symbol, priceIdr: t.lastPrice, change24h: t.change24h })).sort((a, b) => b.change24h - a.change24h);
      setGainers(validTickers.filter(t => t.change24h > 0).slice(0, 5));
      setLosers(validTickers.filter(t => t.change24h < 0).sort((a, b) => a.change24h - b.change24h).slice(0, 5));
      setLastUpdate(new Date().toLocaleTimeString('id-ID'));
    } catch (err) { console.error('Failed to fetch movers:', err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchMovers(); const interval = setInterval(fetchMovers, 15 * 60 * 1000); return () => clearInterval(interval); }, []);

  const formatIdr = (value: number): string => { if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(2)}M`; if (value >= 1000) return `Rp ${(value / 1000).toFixed(1)}K`; return `Rp ${value.toFixed(0)}`; };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="abbi-card p-5">
        <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-emerald-400" /><h3 className="text-lg font-bold text-white">📈 Top Gainers (24h)</h3><span className="ml-auto text-xs text-slate-500">{lastUpdate}</span></div>
        {loading && gainers.length === 0 ? (<div className="text-center py-8 text-slate-500 text-sm">Loading...</div>) : gainers.length === 0 ? (<div className="text-center py-8 text-slate-500 text-sm">No gainers data<br /><span className="text-xs">Indodax API may not include 24h change</span></div>) : (<div className="space-y-3">{gainers.map((coin) => (<div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0"><div className="flex items-center gap-3"><span className="font-bold text-white text-sm">{coin.symbol}</span><span className="text-xs text-slate-400">{formatIdr(coin.priceIdr)}</span></div><span className="text-sm font-medium text-emerald-400">+{coin.change24h.toFixed(2)}%</span></div>))}</div>)}
      </div>
      <div className="abbi-card p-5">
        <div className="flex items-center gap-2 mb-4"><TrendingDown className="w-5 h-5 text-red-400" /><h3 className="text-lg font-bold text-white">📉 Top Losers (24h)</h3><span className="ml-auto text-xs text-slate-500">{lastUpdate}</span></div>
        {loading && losers.length === 0 ? (<div className="text-center py-8 text-slate-500 text-sm">Loading...</div>) : losers.length === 0 ? (<div className="text-center py-8 text-slate-500 text-sm">No losers data<br /><span className="text-xs">Indodax API may not include 24h change</span></div>) : (<div className="space-y-3">{losers.map((coin) => (<div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0"><div className="flex items-center gap-3"><span className="font-bold text-white text-sm">{coin.symbol}</span><span className="text-xs text-slate-400">{formatIdr(coin.priceIdr)}</span></div><span className="text-sm font-medium text-red-400">{coin.change24h.toFixed(2)}%</span></div>))}</div>)}
      </div>
    </div>
  );
}
