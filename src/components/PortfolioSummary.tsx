// ============================================================
// ABBI DeskLive — Portfolio Summary Card
// ============================================================

import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTradingStore, useRotationPoolStore } from '@core/store';
import { formatIdr, formatPercent, getPnlColor, getPnlBgColor } from '@core/utils';

export function PortfolioSummary() {
  const { positions } = useTradingStore();
  const { pool } = useRotationPoolStore();

  const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const allocatedPercent = totalValue > 0 ? (totalValue / (totalValue + pool.stablecoinBalance)) * 100 : 0;

  const stats = [
    {
      label: 'Total Portfolio',
      value: formatIdr(totalValue + pool.stablecoinBalance),
      icon: Wallet,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Unrealized P&L',
      value: formatPercent(totalPnlPercent),
      subvalue: formatIdr(totalPnl),
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
      bg: totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Allocated',
      value: `${allocatedPercent.toFixed(1)}%`,
      subvalue: formatIdr(totalValue),
      icon: ArrowUpRight,
      color: 'text-abbi-400',
      bg: 'bg-abbi-500/10',
    },
    {
      label: 'Rotation Pool',
      value: formatIdr(pool.stablecoinBalance),
      subvalue: `${pool.currentPercent.toFixed(1)}%`,
      icon: PiggyBank,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="abbi-card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            {stat.subvalue && (
              <p className="text-sm text-slate-500 mt-1">{stat.subvalue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
