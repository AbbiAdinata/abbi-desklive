// ============================================================
// ABBI DeskLive — Trading Route (Entry Execution)
// ============================================================

import { useState } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTradingStore } from '@core/store';
import { smartAccumulator } from '@core/engine/SmartAccumulator';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { ENTRY_SCORE_MIN } from '@core/constants';
import { formatIdr } from '@core/utils';

export function TradingView() {
  const { entrySignals, positions } = useTradingStore();
  const [selectedCoin, setSelectedCoin] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedSignal = entrySignals.find((s) => s.symbol === selectedCoin);
  const hasPosition = positions.some((p) => p.symbol === selectedCoin);

  const handleBuy = async () => {
    if (!selectedCoin || !amount || !selectedSignal) return;

    setLoading(true);
    try {
      const ticker = await indodaxClient.fetchTicker(selectedCoin);
      const amountNum = parseFloat(amount);
      smartAccumulator.executeEntry(selectedCoin, amountNum, ticker.price);
      setAmount('');
      setSelectedCoin('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-6 h-6 text-abbi-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Manual Entry</h1>
          <p className="text-sm text-slate-400">Eksekusi beli berdasarkan signal ABBI</p>
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
                  onClick={() => setSelectedCoin(signal.symbol)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCoin === signal.symbol
                      ? 'bg-abbi-500/10 border-abbi-500/50'
                      : 'bg-slate-700/20 border-slate-700/30 hover:bg-slate-700/30'
                  }`}
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

      {selectedSignal && (
        <div className="abbi-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-abbi-400" />
            <h2 className="text-lg font-bold text-white">Execute Entry: {selectedCoin}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Jumlah Investasi (IDR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min. Rp 100.000"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-abbi-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-700/30 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Entry Score</span>
                <span className="text-abbi-400 font-medium">{selectedSignal.score}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RSI</span>
                <span className="text-slate-300">{selectedSignal.rsiStatus.value.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TP1 Target</span>
                <span className="text-emerald-400">+15%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TP2 Trailing</span>
                <span className="text-amber-400">-8% from peak</span>
              </div>
            </div>

            <button
              onClick={handleBuy}
              disabled={loading || !amount || parseFloat(amount) < 100000}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-abbi-600 to-abbi-500 text-white font-bold hover:from-abbi-500 hover:to-abbi-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : `Beli ${selectedCoin}`}
            </button>

            {hasPosition && (
              <p className="text-xs text-amber-400 text-center">
                ⚠️ Anda sudah memiliki posisi {selectedCoin}. Ini akan menambah posisi (DCA).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
