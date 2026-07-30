// ============================================================
// ABBI DeskLive — Trading Signals (Auto-Mode Monitor)
// ============================================================

import { Radar, AlertCircle } from 'lucide-react';
import { useTradingStore } from '@core/store';
import { ENTRY_SCORE_MIN } from '@core/constants';

export function TradingView() {
  const { entrySignals } = useTradingStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Radar className="w-6 h-6 text-abbi-400" />
n        <div>
          <h1 className="text-2xl font-bold text-white">Auto Trading Signals</h1>
          <p className="text-sm text-slate-400">Signal yang sedang dipantau dan dieksekusi oleh bot ABBI</p>
        </div>
      </div>

      <div className="abbi-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Active Signals</h2>
        <div className="space-y-2">
          {entrySignals.filter((s) => s.score >= ENTRY_SCORE_MIN).length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tidak ada signal aktif saat ini</p>
            </div>
          ) : (
            entrySignals
              .filter((s) => s.score >= ENTRY_SCORE_MIN)
              .map((signal) => (
                <div
                  key={signal.symbol}
                  className="p-3 rounded-lg border bg-slate-700/20 border-slate-700/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{signal.symbol}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        signal.recommendation === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-abbi-500/20 text-abbi-400'
                      }`}>
                        {signal.recommendation}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-abbi-400">Score: {signal.score}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span>RSI: {signal.rsiStatus.value.toFixed(1)}</span>
                    <span>{signal.trendPhase.replace('_', ' ')}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="abbi-card p-4 bg-abbi-500/5 border-abbi-500/20">
        <p className="text-sm text-slate-300">
          🤖 <span className="font-semibold text-abbi-400">Auto-Trade Aktif:</span>{' '}
          ABBI mengeksekusi entry dan exit secara otomatis berdasarkan signal di atas.
          Tidak diperlukan intervensi pengguna.
        </p>
      </div>
    </div>
  );
}
