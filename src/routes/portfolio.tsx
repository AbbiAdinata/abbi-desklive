// ============================================================
// ABBI DeskLive — Portfolio Route
// ============================================================

import { createFileRoute } from '@tanstack/react-router';
import { PortfolioView } from '@components/PortfolioView';

export const Route = createFileRoute('/portfolio')({
  component: PortfolioView,
});
