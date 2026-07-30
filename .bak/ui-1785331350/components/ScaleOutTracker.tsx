// ============================================================
// ABBI DeskLive — Scale-Out Tracker (UI Scale-Out)
// ============================================================

import { useState, useEffect } from 'react';
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTradingStore } from '@core/store';
import { scaleOutEngine } from '@core/engine/ScaleOutEngine';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { formatPercent, getPnlColor } from '@core/utils';
import type { Position } from '@core/types';

export function ScaleOutTracker() {
  const { positions } = useTradingStore();
  const [updatedPositions, setUpdatedPositions] = useState<Position[]>(positions);

  useEffect(() => {
    const interval = setInterval(async () => {
      for (const pos of positions) {
        if (pos.status === 'fully_exited') continue;
        try {
          const ticker = await indodaxClient.fetchTicker(pos.symbol);
          await scaleOutEngine.checkPosition(pos, ticker.price);
        } catch (err) {
          console.warn(err);
        }
      }
      setUpdatedPositions([...positions]);
    }, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  const activePositions = updatedPositions.filter((p) => p.status !== 'fully_exited');

  return (
    <div className="abbi-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
          <Target className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Scale-Out Tracker</h2>
          <p className="text-xs text-slate-400">TP1: 50% | TP2: Trailing -8%</p>
        </div>
      </div>

      {activePositions.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Tidak ada posisi aktif</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activePositions.map((pos) => {
            const progressToTP1 = ((pos.currentValue / pos.totalInvested - 1) / 0.15) * 100;
            const isNearTP1 = progressToTP1 >= 80 && !pos.tp1Triggered;

            return (
              <div
                key={pos.symbol}
                className={`p-4 rounded-xl border ${pos.tp1Triggered ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-700/20 border-slate-700/30'} ${isNearTP1 ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{pos.symbol}</span>
                  <span className={`text-sm font-medium ${getPnlColor(pos.unrealizedPnlPercent)}`}>
                    {formatPercent(pos.unrealizedPnlPercent)}
                  </span>
                </div>

                <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute h-full rounded-full transition-all duration-500 ${pos.tp1Triggered ? 'bg-emerald-400' : 'bg-abbi-400'}`}
                    style={{ width: `${Math.min(100, Math.max(0, progressToTP1))}%` }}
                  />
                  <div className="absolute h-full w-0.5 bg-white/50" style={{ left: '100%' }} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Entry: {pos.avgEntryPrice.toFixed(2)}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-abbi-400">TP1: {pos.tp1Price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pos.tp1Triggered ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> TP1 Done
                      </span>
                    ) : isNearTP1 ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="w-3 h-3" /> Near TP1
                      </span>
                    ) : (
                      <span className="text-slate-500">Accumulating</span>
                    )}
                  </div>
                </div>

                {pos.tp1Triggered && (
                  <div className="mt-2 pt-2 border-t border-emerald-500/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Trailing Stop</span>
                      <span className="text-emerald-400">
                        Peak: {pos.tp2PeakPrice.toFixed(2)} (-8% = {(pos.tp2PeakPrice * 0.92).toFixed(2)})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
