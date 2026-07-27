// ============================================================
// ABBI DeskLive — Trading Route
// ============================================================

import { createFileRoute } from '@tanstack/react-router';
import { TradingView } from '@components/TradingView';

export const Route = createFileRoute('/trading')({
  component: TradingView,
});
