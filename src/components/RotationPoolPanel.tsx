// ============================================================
// ABBI DeskLive — Rotation Pool Panel (UI Rotation Pool)
// ============================================================

import { Wallet, Smartphone, Info, ArrowRightLeft } from 'lucide-react';
import { useRotationPoolStore } from '@core/store';
import { rotationPoolEngine } from '@core/engine/RotationPool';
import { formatIdr } from '@core/utils';

export function RotationPoolPanel() {
  const { pool } = useRotationPoolStore();
  const recommendation = rotationPoolEngine.getRecommendation();

  return (
    <div className="abbi-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30">
          <Wallet className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Rotation Pool</h2>
          <p className="text-xs text-slate-400">USDT/Stablecoin Reserve</p>
        </div>
      </div>

      <div className="text-center mb-5 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-slate-700/20 border border-blue-500/20">
        <p className="text-sm text-slate-400 mb-1">Saldo Tersedia</p>
        <p className="text-3xl font-bold text-white">{formatIdr(pool.stablecoinBalance)}</p>
        <p className="text-sm text-slate-500 mt-1">Target: {pool.targetPercent}% | Current: {pool.currentPercent.toFixed(1)}%</p>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">Mode Manual Aktif</p>
            <p className="text-xs text-slate-400 mt-0.5">{pool.note}</p>
          </div>
        </div>
      </div>

      <div className={`p-3 rounded-lg border mb-4 ${
        recommendation.action === 'increase_stable' ? 'bg-emerald-500/10 border-emerald-500/30' :
        recommendation.action === 'decrease_stable' ? 'bg-abbi-500/10 border-abbi-500/30' :
        'bg-slate-700/20 border-slate-700/30'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft className={`w-4 h-4 ${
            recommendation.action === 'increase_stable' ? 'text-emerald-400' :
            recommendation.action === 'decrease_stable' ? 'text-abbi-400' :
            'text-slate-400'
          }`} />
          <span className={`text-sm font-medium ${
            recommendation.action === 'increase_stable' ? 'text-emerald-400' :
            recommendation.action === 'decrease_stable' ? 'text-abbi-400' :
            'text-slate-400'
          }`}>
            {recommendation.action === 'increase_stable' ? 'Profit Taking → USDT' :
             recommendation.action === 'decrease_stable' ? 'Beli Coin Diskon' :
             'Maintain Position'}
          </span>
        </div>
        <p className="text-xs text-slate-400">{recommendation.reason}</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <p>Rotation pool dikelola manual melalui aplikasi Indodax di HP Anda. ABBI hanya memberikan rekomendasi.</p>
      </div>
    </div>
  );
}
