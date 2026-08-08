// ============================================================
// ABBI DeskLive — EA Screening Panel
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, RefreshCw, Target, TrendingUp, Info } from 'lucide-react';
import { useTradingStore, useSystemStore } from '@core/store';
import { smartAccumulator } from '@core/engine/SmartAccumulator';
import { discountScanner } from '@core/engine/DiscountScanner';
import { ENTRY_SCORE_MIN, AI_VERDICT_COLORS } from '@core/constants';
import type { EntrySignal } from '@core/types';

export function SmartAccumulatorPanel() {
  const { entrySignals, setEntrySignals } = useTradingStore();
  const { setLastScan } = useSystemStore();
  const [scanning, setScanning] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<EntrySignal | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const generateSignals = useCallback(async () => {
    const signals = await discountScanner.scanAll();
    return signals.sort((a, b) => b.score - a.score);
  }, []);

  useEffect(() => {
    const load = async () => {
      const signals = await generateSignals();
      setEntrySignals(signals);
    };
    load();
  }, [generateSignals, setEntrySignals]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const signals = await generateSignals();
      setEntrySignals(signals);
      setLastScan(new Date().toISOString());
    } finally {
      setScanning(false);
    }
  };

  const signals = entrySignals.length > 0 ? entrySignals : [];
  const chartData = signals.map((s) => ({ symbol: s.symbol, score: s.score, recommendation: s.recommendation, rsi: s.rsiStatus.value, trend: s.trendPhase }));
  const eligibleCount = signals.filter((s) => s.score >= ENTRY_SCORE_MIN).length;
  const strongBuyCount = signals.filter((s) => s.recommendation === 'STRONG_BUY').length;
  const accumulateCount = signals.filter((s) => s.recommendation === 'ACCUMULATE').length;
  const holdCount = signals.filter((s) => s.recommendation === 'HOLD').length;
  const reduceCount = signals.filter((s) => s.recommendation === 'REDUCE').length;
  const strongSellCount = signals.filter((s) => s.recommendation === 'STRONG_SELL').length;

  return (
    <div className="abbi-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-abbi-500/15 border border-abbi-500/30">
            <Brain className="w-5 h-5 text-abbi-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">EA Screening</h2>
            <p className="text-xs text-slate-400">Scan 20 coin — Mean Reversion Multi-Timeframe</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowExplainer(!showExplainer)} className="p-2 rounded-lg bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50 transition-all" title="Cara EA menilai coin">
            <Info className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 font-medium">{eligibleCount} Signal</span></div>
            <div className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-abbi-400" /><span className="text-abbi-400 font-medium">{strongBuyCount} Strong Buy</span></div>
          </div>
          <button onClick={handleScan} disabled={scanning} className="p-2 rounded-lg bg-abbi-500/15 border border-abbi-500/30 hover:bg-abbi-500/25 transition-all disabled:opacity-50" title="Refresh signal">
            <RefreshCw className={`w-4 h-4 text-abbi-400 ${scanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showExplainer && (
        <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <h3 className="text-sm font-bold text-white mb-3">📋 Cara EA Menilai Coin (Screening)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="space-y-2">
              <p className="font-medium text-emerald-400">1. Trend Analysis (0-30 poin)</p>
              <p>• Di bawah MA200 + MA50 turun = Structural Discount (28)</p>
              <p>• Di bawah MA20 tapi MA200 naik = Healthy Pullback (20)</p>
              <p>• Di atas semua MA = Overextended (5)</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-emerald-400">2. Valuation Analysis (0-40 poin)</p>
              <p>• RSI &lt; 30 (Deep Discount) = 38 poin</p>
              <p>• RSI 30-38 (Discount) = 32 poin</p>
              <p>• RSI 38-55 (Fair) = 20 poin</p>
              <p>• RSI &gt; 70 (Overbought) = 0-8 poin</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-emerald-400">3. Support Confluence (0-30 poin)</p>
              <p>• Dekat support historis = Tinggi</p>
              <p>• Jauh dari support = Rendah</p>
              <p>• Total Score = max 100</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
            <p><b>Threshold:</b> Score ≥ 75 = Entry (300k-500k) | ≥ 85 = Strong Buy | &lt; 30 atau RSI&gt;80 = Strong Sell</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {strongBuyCount > 0 && <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs"><span className="text-emerald-400 font-bold">{strongBuyCount}</span><span className="text-emerald-400 ml-1">Strong Buy</span></div>}
        {accumulateCount > 0 && <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs"><span className="text-emerald-400 font-bold">{accumulateCount}</span><span className="text-emerald-400 ml-1">Accumulate</span></div>}
        {holdCount > 0 && <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs"><span className="text-amber-400 font-bold">{holdCount}</span><span className="text-amber-400 ml-1">Hold</span></div>}
        {reduceCount > 0 && <div className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-xs"><span className="text-orange-400 font-bold">{reduceCount}</span><span className="text-orange-400 ml-1">Reduce</span></div>}
        {strongSellCount > 0 && <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs"><span className="text-red-400 font-bold">{strongSellCount}</span><span className="text-red-400 ml-1">Strong Sell</span></div>}
      </div>

      <div className="h-72 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
            <YAxis dataKey="symbol" type="category" stroke="#94a3b8" fontSize={12} width={50} />
            <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const data = payload[0].payload; return (<div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl"><p className="font-bold text-white">{data.symbol}</p><p className="text-sm text-slate-400">Score: <span className="text-emerald-400 font-bold">{data.score}</span></p><p className="text-sm text-slate-400">RSI: {data.rsi.toFixed(1)}</p></div>); }} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(data) => setSelectedSignal(signals.find((s) => s.symbol === data.symbol) || null)}>
              {chartData.map((entry, index) => { const signal = signals[index]; const color = signal?.score >= 85 ? '#10b981' : signal?.score >= 70 ? '#22c55e' : signal?.score >= 50 ? '#f59e0b' : signal?.score >= 30 ? '#f97316' : '#ef4444'; return <Cell key={index} fill={color} opacity={0.85} />; })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-700/50"><th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Coin</th><th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Score</th><th className="text-center text-xs text-slate-400 font-medium py-2 px-3">RSI</th><th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Trend</th><th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Signal</th><th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Action</th></tr></thead>
          <tbody>
            {signals.slice(0, 10).map((signal) => { const colors = AI_VERDICT_COLORS[signal.recommendation] || AI_VERDICT_COLORS.HOLD; return (<tr key={signal.symbol} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedSignal(signal)}><td className="py-2.5 px-3"><div className="flex items-center gap-2"><span className="font-bold text-white text-sm">{signal.symbol}</span><span className="text-xs text-slate-500">{signal.rsiStatus.timeframe}</span></div></td><td className="py-2.5 px-3 text-center"><span className={`font-bold text-sm ${signal.score >= 70 ? 'text-emerald-400' : signal.score >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>{signal.score}</span></td><td className="py-2.5 px-3 text-center"><span className={`text-sm ${signal.rsiStatus.value < 38 ? 'text-emerald-400' : signal.rsiStatus.value > 70 ? 'text-red-400' : 'text-slate-400'}`}>{signal.rsiStatus.value.toFixed(1)}</span></td><td className="py-2.5 px-3 text-center"><span className="text-xs text-slate-400 capitalize">{signal.trendPhase.replace('_', ' ')}</span></td><td className="py-2.5 px-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.icon} {signal.recommendation}</span></td><td className="py-2.5 px-3 text-center">{signal.score >= ENTRY_SCORE_MIN ? (<button onClick={(e) => { e.stopPropagation(); }} className="px-3 py-1 rounded-lg bg-abbi-500/20 text-abbi-400 text-xs font-medium hover:bg-abbi-500/30 transition-colors border border-abbi-500/30">Accumulate</button>) : (<span className="text-xs text-slate-500">Wait</span>)}</td></tr>); })}
          </tbody>
        </table>
      </div>

      {selectedSignal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSignal(null)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-white">{selectedSignal.symbol} Analysis</h3><button onClick={() => setSelectedSignal(null)} className="text-slate-400 hover:text-white">✕</button></div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-400">Entry Score</span><span className="font-bold text-emerald-400">{selectedSignal.score}/100</span></div>
              <div className="flex justify-between"><span className="text-slate-400">RSI (4H)</span><span className={`font-medium ${selectedSignal.rsiStatus.value < 38 ? 'text-emerald-400' : 'text-slate-300'}`}>{selectedSignal.rsiStatus.value.toFixed(1)} — {selectedSignal.rsiStatus.interpretation}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Trend Phase</span><span className="text-slate-300 capitalize">{selectedSignal.trendPhase.replace('_', ' ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">MA Alignment</span><span className="text-slate-300 capitalize">{selectedSignal.maAlignment}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Bollinger</span><span className="text-slate-300 capitalize">{selectedSignal.bollingerStatus.replace('_', ' ')}</span></div>
              <div className="mt-4 p-3 rounded-lg bg-slate-700/30">
                <p className="text-sm font-medium text-slate-300 mb-2">💡 Kenapa EA beri verdict ini?</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedSignal.recommendation === 'STRONG_BUY' && `✅ EXCELLENT! Score ${selectedSignal.score} ≥ 85. ${selectedSignal.rsiStatus.value < 30 ? 'RSI deep discount + score tinggi = entry ideal!' : 'Semua indikator hijau!'} EA akan entry Rp 500.000 di scan berikutnya.`}
                  {selectedSignal.recommendation === 'ACCUMULATE' && `⚠️ PERHATIAN: Score ${selectedSignal.score} di BAWAH threshold entry (≥75). Tapi RSI ${selectedSignal.rsiStatus.value.toFixed(1)} di deep discount (<30) jadi EA menandai ini. TIDAK akan auto-entry — tunggu score naik ke ≥75 atau konfirmasi tambahan.`}
                  {selectedSignal.recommendation === 'HOLD' && `⏸️ TUNGGU: Score ${selectedSignal.score} belum cukup (butuh ≥75). ${selectedSignal.rsiStatus.value < 55 ? 'RSI masih fair — belum murah.' : 'RSI mulai panas — harga kemahalan.'} EA tidak beli di sini.`}
                  {selectedSignal.recommendation === 'REDUCE' && `❌ JANGAN ENTRY: Score ${selectedSignal.score} rendah + ${selectedSignal.rsiStatus.value > 60 ? 'RSI premium (' + selectedSignal.rsiStatus.value.toFixed(1) + ') — harga kemahalan.' : 'momentum lemah.'} Risk/reward jelek.`}
                  {selectedSignal.recommendation === 'STRONG_SELL' && `Score ${selectedSignal.score} sangat rendah${selectedSignal.rsiStatus.value >= 80 ? ` dan RSI ekstrem overbought (${selectedSignal.rsiStatus.value.toFixed(1)})` : ''}. Harga berpotensi reversal. EA tidak akan entry.`}
                </p>
              </div>
              {selectedSignal.supportConfluence.length > 0 && (<div className="mt-3 p-3 rounded-lg bg-slate-700/30"><p className="text-sm font-medium text-slate-300 mb-1">Support Confluence</p>{selectedSignal.supportConfluence.map((s, i) => (<p key={i} className="text-xs text-slate-400">{s.price} — {s.touches}x tested ({s.timeframe})</p>))}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
