// ============================================================
// ABBI DeskLive — Dashboard (Lengkap + Auto Trade Toggle)
// ============================================================

import { useEffect } from 'react';
import { SmartAccumulatorPanel } from './SmartAccumulatorPanel';
import { RotationPoolPanel } from './RotationPoolPanel';
import { ScaleOutTracker } from './ScaleOutTracker';
import { PortfolioSummary } from './PortfolioSummary';
import { AIAnalysisPanel } from './AIAnalysisPanel';
import { MarketOverview } from './MarketOverview';
import { AutoTradeToggle } from './AutoTradeToggle';
import { useSystemStore, useTradingStore } from '@core/store';
import { smartAccumulator } from '@core/engine/SmartAccumulator';
import { indodaxClient } from '@core/engine/IndodaxClient';

export function Dashboard() {
  const { status, setRunning } = useSystemStore();
  const { setEntrySignals } = useTradingStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const tickers = await indodaxClient.fetchAllTickers();
        await smartAccumulator.scan();
      } catch (err) {
        console.error('Initial load error:', err);
      }
    };

    loadData();

    if (!status.isRunning) {
      smartAccumulator.start();
      setRunning(true);
    }

    return () => {
      smartAccumulator.stop();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Auto Trade Toggle — Paling Atas */}
      <AutoTradeToggle />

      {/* Top Row: Portfolio Summary */}
      <PortfolioSummary />

      {/* Middle Row: Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SmartAccumulatorPanel />
        </div>
        <div className="space-y-6">
          <ScaleOutTracker />
          <RotationPoolPanel />
        </div>
      </div>

      {/* Bottom Row: AI Analysis + Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIAnalysisPanel />
        <MarketOverview />
      </div>
    </div>
  );
}