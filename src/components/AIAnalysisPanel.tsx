// ============================================================
// ABBI DeskLive — AI Analysis Panel (FIXED: Rupiah)
// ============================================================

import { useState, useEffect } from 'react';
import { Brain, TrendingUp } from 'lucide-react';
import { useTradingStore, useUIStore } from '@core/store';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { generateAIAnalysis } from '@core/utils';
import { AI_VERDICT_COLORS } from '@core/constants';
import type { AIAnalysis } from '@core/types';

export function AIAnalysisPanel() {
  const { entrySignals } = useTradingStore();
  const { selectedCoin, setSelectedCoin } = useUIStore();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCoin && entrySignals.length > 0) {
      setSelectedCoin(entrySignals[0].symbol);
    }
  }, [entrySignals, selectedCoin]);

  useEffect(() => {
    if (!selectedCoin) return;

    const loadAnalysis = async () => {
      setLoading(true);
      try {
        const ticker = await indodaxClient.fetchTicker(selectedCoin);
        const signal = entrySignals.find((s) => s.symbol === selectedCoin);

        if (signal) {
          const mockPrices = Array.from({ length: 100 }, (_, i) =>
            ticker.price * (0.9 + Math.random() * 0.2)
          );
          const ma20 = mockPrices.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const ma50 = mockPrices.slice(-50).reduce((a, b) => a + b, 0) / 50;
          const ma200 = mockPrices.reduce((a, b) => a + b, 0) / 100;
          const rsi = signal.rsiStatus.value;
          const bbUpper = ticker.price * 1.05;
          const bbMiddle = ticker.price;
          const bbLower = ticker.price * 0.95;
          const supportLevels = signal.supportConfluence;

          const ai = generateAIAnalysis(
            selectedCoin, ticker.price, ma20, ma50, ma200, rsi,
            bbUpper, bbMiddle, bbLower, supportLevels
          );
          setAnalysis(ai);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [selectedCoin, entrySignals]);

  const colors = analysis ? AI_VERDICT_COLORS[analysis.verdict] : AI_VERDICT_COLORS.HOLD;
  const fmtIdr = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  return (
    <div className="abbi-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Analysis</h2>
            <p className="text-xs text-slate-400">Rule-based technical analysis</p>
          </div>
        </div>
        <select
          value={selectedCoin || ''}
          onChange={(e) => setSelectedCoin(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-abbi-500"
        >
          {entrySignals.map((s) => (
            <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-abbi-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${colors.bg} ${colors.border} flex items-center gap-3`}>
            <span className="text-2xl">{colors.icon}</span>
            <div>
              <p className={`text-lg font-bold ${colors.text}`}>{analysis.verdict}</p>
              <p className="text-xs text-slate-400">Risk: {analysis.riskLevel} | Expected: {analysis.expectedReturn}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 mb-1">Resistance</p>
              <p className="text-lg font-bold text-white">{fmtIdr(analysis.resistancePrice)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 mb-1">Discount Zone</p>
              <p className="text-lg font-bold text-white">{fmtIdr(analysis.discountPrice)}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 mb-1">Fair Value</p>
              <p className="text-lg font-bold text-white">{fmtIdr(analysis.fairValue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 mb-1">Support</p>
              <p className="text-lg font-bold text-white">{fmtIdr(analysis.supportPrice)}</p>
            </div>
          </div>

          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="absolute h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full" style={{ width: '100%' }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-surface"
              style={{
                left: `${Math.max(0, Math.min(100, ((analysis.currentPrice - analysis.supportPrice) / (analysis.resistancePrice - analysis.supportPrice)) * 100))}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Support</span>
            <span className="text-white font-medium">Current: {fmtIdr(analysis.currentPrice)}</span>
            <span>Resistance</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Analysis:</p>
            {analysis.reasoning.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <TrendingUp className="w-4 h-4 text-abbi-400 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Pilih coin untuk melihat analisis AI</p>
        </div>
      )}
    </div>
  );
}
