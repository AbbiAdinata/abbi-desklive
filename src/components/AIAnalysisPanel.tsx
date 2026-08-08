// ============================================================
// ABBI DeskLive — AI Analysis Panel with Explanations
// ============================================================

import React, { useState } from 'react';
import { useTradingStore } from '../core/store';
import { COIN_UNIVERSE } from '../core/constants';
import { AI_VERDICT_COLORS } from '../core/constants';
import { ENTRY_SCORE_MIN, ENTRY_SCORE_STRONG } from '../core/constants';

export const AIAnalysisPanel: React.FC = () => {
  const { entrySignals } = useTradingStore.getState();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const getExplanation = (signal: any): string => {
    const { score, rsiStatus, trendPhase, bollingerStatus, recommendation } = signal;
    switch (recommendation) {
      case 'STRONG_BUY':
        return `Score ${score} ≥ ${ENTRY_SCORE_STRONG} (threshold Strong Buy). ${rsiStatus.value < 30 ? `RSI ${rsiStatus.value.toFixed(1)} di zona deep discount — harga sangat murah.` : `RSI ${rsiStatus.value.toFixed(1)} masih dalam zona aman.`} ${bollingerStatus.includes('below') ? 'Harga di bawah Bollinger Lower — rare opportunity.' : 'Momentum Bollinger mendukung kenaikan.'} EA akan entry dengan budget Rp 500.000.`;
      case 'ACCUMULATE':
        return `Score ${score} ≥ ${ENTRY_SCORE_MIN} (threshold entry). ${rsiStatus.value < 38 ? `RSI ${rsiStatus.value.toFixed(1)} di zona discount — ada margin safety.` : `RSI ${rsiStatus.value.toFixed(1)} fair value.`} ${trendPhase.includes('pullback') ? 'Healthy pullback dari uptrend — entry point ideal.' : 'Konsolidasi sehat sebelum potensi breakout.'} EA akan entry dengan budget Rp 300.000-500.000.`;
      case 'HOLD':
        return `Score ${score} di bawah threshold entry (${ENTRY_SCORE_MIN}). ${rsiStatus.value < 55 ? `RSI ${rsiStatus.value.toFixed(1)} masih fair, tapi belum cukup discount.` : `RSI ${rsiStatus.value.toFixed(1)} mulai panas.`} ${trendPhase.includes('overextended') ? 'Harga sudah terlalu tinggi — tunggu koreksi.' : 'Belum ada sinyal konfirmasi yang cukup kuat.'} EA menunggu kesempatan lebih baik.`;
      case 'REDUCE':
        return `Score ${score} rendah. ${rsiStatus.value > 60 ? `RSI ${rsiStatus.value.toFixed(1)} di zona premium — harga mahal.` : `RSI ${rsiStatus.value.toFixed(1)} tidak mendukung entry.`} ${bollingerStatus.includes('above') ? 'Harga di atas Bollinger Upper — overextended.' : 'Momentum lemah, risk/reward tidak ideal.'} Hindari entry.`;
      case 'STRONG_SELL':
        return `Score ${score} sangat rendah${rsiStatus.value >= 80 ? ` dan RSI ekstrem overbought (${rsiStatus.value.toFixed(1)})` : ''}. ${bollingerStatus.includes('above') ? 'Harga jauh di atas Bollinger Upper — reversal risk tinggi.' : 'Kondisi teknikal sangat lemah.'} EA tidak akan entry di zona ini.`;
      default:
        return 'Analisis sedang berlangsung...';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">🤖 AI Analysis — EA Decision Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entrySignals.map((signal) => {
          const coin = COIN_UNIVERSE.find((c) => c.symbol === signal.symbol);
          const colors = AI_VERDICT_COLORS[signal.recommendation] || AI_VERDICT_COLORS.HOLD;
          const isExpanded = expandedCard === signal.symbol;
          return (
            <div key={signal.symbol} className={`p-4 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer transition-all hover:opacity-90`} onClick={() => setExpandedCard(isExpanded ? null : signal.symbol)}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${colors.text}`}>{signal.symbol}</span>
                <span className={`text-sm ${colors.text}`}>{colors.icon} {signal.recommendation}</span>
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Score: <span className="font-bold text-white">{signal.score}/100</span> {signal.score >= ENTRY_SCORE_MIN ? <span className="text-emerald-400 text-xs">✓ Entry eligible</span> : <span className="text-slate-500 text-xs">✗ Below threshold</span>}</p>
                <p>RSI: {signal.rsiStatus.value.toFixed(1)} ({signal.rsiStatus.interpretation})</p>
                <p>MA: <span className="capitalize">{signal.maAlignment}</span></p>
                <p>Bollinger: <span className="capitalize">{signal.bollingerStatus.replace('_', ' ')}</span></p>
                {coin && <p>Target Weight: {(coin.marketCapWeight * 100).toFixed(1)}%</p>}
              </div>
              <div className={`mt-3 pt-3 border-t ${colors.border} transition-all overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <p className="text-xs text-slate-300 leading-relaxed">💡 <span className="font-medium">Kenapa EA beri verdict ini?</span><br /><span className="text-slate-400">{getExplanation(signal)}</span></p>
              </div>
              {!isExpanded && <p className="text-xs text-slate-500 mt-2">Klik untuk lihat penjelasan EA ↓</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
