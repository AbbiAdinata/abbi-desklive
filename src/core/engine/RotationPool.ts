// ============================================================
// ABBI DeskLive — Rotation Pool (USDT/Stablecoin)
// ============================================================

import type { RotationPool } from '../types';
import { useRotationPoolStore, useNotificationStore } from '../store';

export class RotationPoolEngine {
  // Manual mode — user mengelola via HP/Indodax
  // Engine ini hanya memberikan rekomendasi & tracking

  getStatus(): RotationPool {
    return useRotationPoolStore.getState().pool;
  }

  updateBalance(amount: number) {
    useRotationPoolStore.getState().updateBalance(amount);
  }

  // Rekomendasi rotasi berdasarkan kondisi market
  getRecommendation(): {
    action: 'increase_stable' | 'decrease_stable' | 'maintain';
    reason: string;
    targetPercent: number;
  } {
    const { pool } = useRotationPoolStore.getState();

    // Jika stablecoin di bawah target → kurangi (beli crypto)
    if (pool.currentPercent < pool.targetPercent - 5) {
      return {
        action: 'decrease_stable',
        reason: 'Stablecoin di bawah target — pertimbangkan jual USDT untuk beli coin diskon',
        targetPercent: pool.targetPercent,
      };
    }

    // Jika stablecoin di atas target → tambah (profit taking)
    if (pool.currentPercent > pool.targetPercent + 5) {
      return {
        action: 'increase_stable',
        reason: 'Stablecoin di atas target — waktu bagus untuk profit taking ke USDT',
        targetPercent: pool.targetPercent,
      };
    }

    return {
      action: 'maintain',
      reason: 'Alokasi stablecoin dalam rentang target',
      targetPercent: pool.targetPercent,
    };
  }

  // Alert jika perlu rotasi manual
  checkAndNotify() {
    const rec = this.getRecommendation();

    if (rec.action !== 'maintain') {
      useNotificationStore.getState().addNotification({
        type: 'warning',
        title: 'Rotation Pool Alert',
        message: rec.reason,
      });
    }
  }
}

export const rotationPoolEngine = new RotationPoolEngine();
