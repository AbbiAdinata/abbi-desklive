// ============================================================
// ABBI DeskLive — AI Analysis Panel
// FIXED: $ → Rp, null check ticker
// ============================================================

import React from 'react';
import { useTradingStore } from '../core/store';
import { COIN_UNIVERSE } from '../core/constants';
import { AI_VERDICT_COLORS } from '../core/constants';

export const AIAnalysisPanel: React.FC = () => {
  const { entrySignals } = useTradingStore.getState();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">🤖 AI Analysis</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entrySignals.map((signal) => {
          const coin = COIN_UNIVERSE.find((c) => c.symbol === signal.symbol);
          const colors = AI_VERDICT_COLORS[signal.recommendation] || AI_VERDICT_COLORS.HOLD;
          
          return (
            <div key={signal.symbol} className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${colors.text}`}>{signal.symbol}</span>
                <span className={`text-sm ${colors.text}`}>{colors.icon} {signal.recommendation}</span>
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Score: {signal.score}/100</p>
                <p>RSI: {signal.rsiStatus.value.toFixed(1)} ({signal.rsiStatus.interpretation})</p>
                <p>MA: {signal.maAlignment}</p>
                <p>Bollinger: {signal.bollingerStatus}</p>
                {coin && <p>Target Weight: {(coin.marketCapWeight * 100).toFixed(1)}%</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
