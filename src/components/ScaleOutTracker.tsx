// ============================================================
// ABBI DeskLive — Scale Out Tracker
// FIXED: Sync positions dari store, null check ticker
// ============================================================

import React, { useEffect, useState } from 'react';
import { useTradingStore } from '../core/store';
import { TP1_TARGET, TP2_TARGET } from '../core/constants';
import type { Position } from '../core/types';

export const ScaleOutTracker: React.FC = () => {
  const { positions } = useTradingStore.getState();
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    // Fetch current prices untuk semua positions
    const fetchPrices = async () => {
      const newPrices: Record<string, number> = {};
      for (const pos of positions) {
        try {
          const res = await fetch(`/api/public/ticker/${pos.symbol.toLowerCase()}_idr`);
          const data = await res.json();
          if (data?.ticker?.last) {
            newPrices[pos.symbol] = parseFloat(data.ticker.last);
          }
        } catch (err) {
          console.warn(`Failed to fetch price for ${pos.symbol}:`, err);
        }
      }
      setPrices(newPrices);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="p-4 text-gray-400">
        No active positions. ABBI will auto-enter when signals are strong.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">📊 Scale Out Tracker</h2>
      <div className="grid grid-cols-1 gap-3">
        {positions.map((pos: Position) => {
          const currentPrice = prices[pos.symbol] || pos.avgEntryPrice;
          const pnlPct = (currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice;
          const tp1Price = pos.avgEntryPrice * (1 + TP1_TARGET);
          const tp2Price = pos.avgEntryPrice * (1 + TP2_TARGET);

          return (
            <div key={pos.symbol} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">{pos.symbol}</span>
                <span className={`text-sm ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnlPct >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Entry: Rp{pos.avgEntryPrice.toLocaleString('id-ID')}</p>
                <p>Current: Rp{currentPrice.toLocaleString('id-ID')}</p>
                <p>Quantity: {pos.quantity.toFixed(6)}</p>
                <p>Value: Rp{(pos.quantity * currentPrice).toLocaleString('id-ID')}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>TP1 (+10%):</span>
                    <span className={pos.tp1Triggered ? 'text-green-400' : 'text-gray-400'}>
                      Rp{tp1Price.toLocaleString('id-ID')} {pos.tp1Triggered ? '✅' : '⏳'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>TP2 (+15%):</span>
                    <span className={pos.status === 'fully_exited' ? 'text-green-400' : 'text-gray-400'}>
                      Rp{tp2Price.toLocaleString('id-ID')} {pos.status === 'fully_exited' ? '✅' : '⏳'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
