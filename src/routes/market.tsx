// ============================================================
// ABBI DeskLive — Market Route
// ============================================================

import { createFileRoute } from '@tanstack/react-router';
import { MarketView } from '@components/MarketView';

export const Route = createFileRoute('/market')({
  component: MarketView,
});
