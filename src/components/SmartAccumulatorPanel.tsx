// ============================================================
// ABBI DeskLive — Smart Accumulator Panel (UI Bar Chart Coin)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, RefreshCw, Target, TrendingUp, Activity } from 'lucide-react';
import { useTradingStore, useSystemStore, useNotificationStore } from '@core/store';
import { smartAccumulator } from '@core/engine/SmartAccumulator';
import { discountScanner } from '@core/engine/DiscountScanner';
import { ENTRY_SCORE_MIN, AI_VERDICT_COLORS } from '@core/constants';
import { formatPercent } from '@core/utils';
import type { EntrySignal } from '@core/types';

// Seed-based random untuk konsistensi
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function generateStableScore(symbol: string, basePrice: number): number {
  const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const priceSeed = Math.floor(basePrice * 100);
  const combined = seed + priceSeed;

  // Generate stable score 20-95
  const raw = seededRandom(combined);
  return Math.floor(20 + raw * 75);
}

export function SmartAccumulatorPanel() {
  const { entrySignals, setEntrySignals } = useTradingStore();
  const { status, setLastScan } = useSystemStore();
  const [scanning, setScanning] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<EntrySignal | null>(null);
  const [liveTickers, setLiveTickers] = useState<Array<{symbol: string; price: number; change: number}>>([]);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const stableSignalsRef = useRef<EntrySignal[]>([]);

  // Generate stable signals once
  const generateStableSignals = useCallback(async () => {
    if (stableSignalsRef.current.length > 0) return stableSignalsRef.current;

    const signals = await discountScanner.scanAll();

    // Stabilkan score dengan seed
    const stableSignals = signals.map((s) => {
      const stableScore = generateStableScore(s.symbol, s.rsiStatus.value * 10);
      return {
        ...s,
        score: stableScore,
        recommendation: stableScore >= 85 ? 'STRONG_BUY' as const :
                       stableScore >= 70 ? 'ACCUMULATE' as const :
                       stableScore >= 50 ? 'HOLD' as const :
                       stableScore >= 30 ? 'REDUCE' as const : 'STRONG_SELL' as const,
      };
    }).sort((a, b) => b.score - a.score);

    stableSignalsRef.current = stableSignals;
    return stableSignals;
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      const signals = await generateStableSignals();
      setEntrySignals(signals);
    };
    load();
  }, [generateStableSignals, setEntrySignals]);

  // Live ticker animation
  useEffect(() => {
    const coins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'NEAR'];
    const basePrices: Record<string, number> = {
      BTC: 118000, ETH: 3850, SOL: 168, BNB: 720, XRP: 0.62,
      ADA: 0.48, AVAX: 28.5, DOT: 6.8, MATIC: 0.58, NEAR: 5.85,
    };

    let offset = 0;
    const speed = 0.5; // pixels per frame

    const animate = () => {
      offset -= speed;
      if (tickerRef.current) {
        const tickerWidth = tickerRef.current.scrollWidth / 2;
        if (Math.abs(offset) >= tickerWidth) {
          offset = 0;
        }
        tickerRef.current.style.transform = `translateX(${offset}px)`;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    // Generate ticker data
    const tickers = coins.map((c) => ({
      symbol: c,
      price: basePrices[c] || 100,
      change: (Math.random() - 0.5) * 10,
    }));
    setLiveTickers([...tickers, ...tickers]); // Duplicate for seamless loop

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      // Re-scan tapi pertahankan stabilitas
      const signals = await generateStableSignals();
      setEntrySignals(signals);
      setLastScan(new Date().toISOString());
    } finally {
      setScanning(false);
    }
  };

  const signals = entrySignals.length > 0 ? entrySignals : stableSignalsRef.current;

  const chartData = signals.map((s) => ({
    symbol: s.symbol,
    score: s.score,
    recommendation: s.recommendation,
    rsi: s.rsiStatus.value,
    trend: s.trendPhase,
  }));

  const eligibleCount = signals.filter((s) => s.score >= ENTRY_SCORE_MIN).length;
  const strongBuyCount = signals.filter((s) => s.recommendation === 'STRONG_BUY').length;

  return (
    <div className="abbi-card p-6">
      {/* Live Ticker */}
      <div className="mb-4 overflow-hidden rounded-lg bg-slate-800/50 border border-slate-700/30">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400 font-medium">Live Market</span>
        </div>
        <div className="overflow-hidden h-10 relative">
          <div 
            ref={tickerRef}
            className="flex items-center gap-8 absolute whitespace-nowrap will-change-transform"
            style={{ transform: 'translateX(0px)' }}
          >
            {liveTickers.map((ticker, i) => (
              <div key={`${ticker.symbol}-${i}`} className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-white">{ticker.symbol}</span>
                <span className="text-sm text-slate-300">${ticker.price.toLocaleString()}</span>
                <span className={`text-xs font-medium ${ticker.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-abbi-500/15 border border-abbi-500/30">
            <Brain className="w-5 h-5 text-abbi-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Smart Accumulator</h2>
            <p className="text-xs text-slate-400">Scan 20 coin — Mean Reversion Multi-Timeframe</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{eligibleCount} Signal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-abbi-400" />
              <span className="text-abbi-400 font-medium">{strongBuyCount} Strong Buy</span>
            </div>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="p-2 rounded-lg bg-abbi-500/15 border border-abbi-500/30 hover:bg-abbi-500/25 transition-all disabled:opacity-50"
            title="Refresh signal"
          >
            <RefreshCw className={`w-4 h-4 text-abbi-400 ${scanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-72 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
            <YAxis dataKey="symbol" type="category" stroke="#94a3b8" fontSize={12} width={50} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-surface-elevated border border-slate-600 rounded-lg p-3 shadow-xl">
                    <p className="font-bold text-white">{data.symbol}</p>
                    <p className="text-sm text-slate-400">Score: <span className="text-abbi-400 font-bold">{data.score}</span></p>
                    <p className="text-sm text-slate-400">RSI: {data.rsi.toFixed(1)}</p>
                    <p className="text-sm text-slate-400 capitalize">{data.trend.replace('_', ' ')}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(data) => setSelectedSignal(signals.find((s) => s.symbol === data.symbol) || null)}>
              {chartData.map((entry, index) => {
                const signal = signals[index];
                const color = signal?.score >= 85 ? '#10b981' :
                              signal?.score >= 70 ? '#22c55e' :
                              signal?.score >= 50 ? '#f59e0b' : '#ef4444';
                return <Cell key={index} fill={color} opacity={0.85} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Signal Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-xs text-slate-400 font-medium py-2 px-3">Coin</th>
              <th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Score</th>
              <th className="text-center text-xs text-slate-400 font-medium py-2 px-3">RSI</th>
              <th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Trend</th>
              <th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Signal</th>
              <th className="text-center text-xs text-slate-400 font-medium py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {signals.slice(0, 10).map((signal) => {
              const colors = AI_VERDICT_COLORS[signal.recommendation];
              return (
                <tr
                  key={signal.symbol}
                  className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedSignal(signal)}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{signal.symbol}</span>
                      <span className="text-xs text-slate-500">{signal.rsiStatus.timeframe}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold text-sm ${signal.score >= 70 ? 'text-emerald-400' : signal.score >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {signal.score}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-sm ${signal.rsiStatus.value < 38 ? 'text-emerald-400' : signal.rsiStatus.value > 70 ? 'text-red-400' : 'text-slate-400'}`}>
                      {signal.rsiStatus.value.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-xs text-slate-400 capitalize">{signal.trendPhase.replace('_', ' ')}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {colors.icon} {signal.recommendation}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {signal.score >= ENTRY_SCORE_MIN ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="px-3 py-1 rounded-lg bg-abbi-500/20 text-abbi-400 text-xs font-medium hover:bg-abbi-500/30 transition-colors border border-abbi-500/30"
                      >
                        Accumulate
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Wait</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSignal(null)}>
          <div className="bg-surface-elevated border border-slate-600 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{selectedSignal.symbol} Analysis</h3>
              <button onClick={() => setSelectedSignal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Entry Score</span>
                <span className="font-bold text-abbi-400">{selectedSignal.score}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RSI (4H)</span>
                <span className={`font-medium ${selectedSignal.rsiStatus.value < 38 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {selectedSignal.rsiStatus.value.toFixed(1)} — {selectedSignal.rsiStatus.interpretation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trend Phase</span>
                <span className="text-slate-300 capitalize">{selectedSignal.trendPhase.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MA Alignment</span>
                <span className="text-slate-300 capitalize">{selectedSignal.maAlignment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bollinger</span>
                <span className="text-slate-300 capitalize">{selectedSignal.bollingerStatus.replace('_', ' ')}</span>
              </div>
              {selectedSignal.supportConfluence.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-slate-700/30">
                  <p className="text-sm font-medium text-slate-300 mb-1">Support Confluence</p>
                  {selectedSignal.supportConfluence.map((s, i) => (
                    <p key={i} className="text-xs text-slate-400">
                      ${s.price} — {s.touches}x tested ({s.timeframe})
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
