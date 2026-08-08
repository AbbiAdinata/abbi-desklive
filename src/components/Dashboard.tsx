// ============================================================
// ABBI DeskLive — Dashboard (EA Screening)
// ============================================================

import { useEffect } from 'react';
import { SmartAccumulatorPanel } from './SmartAccumulatorPanel';
import { AIAnalysisPanel } from './AIAnalysisPanel';
import { TopMoversPanel } from './TopMoversPanel';
import { useSystemStore, useTradingStore } from '@core/store';
import { smartAccumulator } from '@core/engine/SmartAccumulator';
import { indodaxClient } from '@core/engine/IndodaxClient';

export function Dashboard() {
  const { status, setRunning } = useSystemStore();
  const { setEntrySignals } = useTradingStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        await indodaxClient.fetchAllTickers();
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
      <SmartAccumulatorPanel />
      <AIAnalysisPanel />
      <TopMoversPanel />
    </div>
  );
}
