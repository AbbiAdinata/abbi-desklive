// ============================================================
// ABBI DeskLive — Market Overview
// ============================================================

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { formatPercent, getPnlColor } from '@core/utils';
import type { TickerData } from '@core/types';

export function MarketOverview() {
  const [tickers, setTickers] = useState<TickerData[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await indodaxClient.fetchAllTickers();
        setTickers(data);
      } catch (err) {
        console.error(err);
      }
    };
    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const topGainers = [...tickers].sort((a, b) => b.change24h - a.change24h).slice(0, 5);
  const topLosers = [...tickers].sort((a, b) => a.change24h - b.change24h).slice(0, 5);

  return (
    <div className="abbi-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30">
          <Activity className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Market Overview</h2>
          <p className="text-xs text-slate-400">20 Coin Universe — Real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Top Gainers (24h)
          </p>
          <div className="space-y-2">
            {topGainers.map((t) => (
              <div key={t.symbol} className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5">
                <span className="text-sm font-medium text-white">{t.symbol}</span>
                <span className="text-sm font-bold text-emerald-400">+{t.change24h.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Top Losers (24h)
          </p>
          <div className="space-y-2">
            {topLosers.map((t) => (
              <div key={t.symbol} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5">
                <span className="text-sm font-medium text-white">{t.symbol}</span>
                <span className="text-sm font-bold text-red-400">{t.change24h.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-[10px] text-slate-500 py-1">Coin</th>
              <th className="text-right text-[10px] text-slate-500 py-1">Price</th>
              <th className="text-right text-[10px] text-slate-500 py-1">24h</th>
              <th className="text-right text-[10px] text-slate-500 py-1">7d</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => (
              <tr key={t.symbol} className="border-b border-slate-700/20 hover:bg-slate-700/10">
                <td className="py-1.5 text-xs font-medium text-white">{t.symbol}</td>
                <td className="py-1.5 text-xs text-right text-slate-300">${t.price.toLocaleString()}</td>
                <td className={`py-1.5 text-xs text-right ${getPnlColor(t.change24h)}`}>
                  {formatPercent(t.change24h)}
                </td>
                <td className={`py-1.5 text-xs text-right ${getPnlColor(t.change7d)}`}>
                  {formatPercent(t.change7d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
