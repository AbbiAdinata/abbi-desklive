// ============================================================
// ABBI DeskLive — Scale-Out Engine (V5 Fixed TP)
// TP1: +10% → sell 50%
// TP2: +15% → sell remaining 50%
// ============================================================

import type { Position, TradeHistory } from '../types';
import { TP1_TARGET, TP2_TARGET } from '../constants';
import { useTradingStore, useNotificationStore } from '../store';
import { indodaxClient } from './IndodaxClient';

export class ScaleOutEngine {
  async checkAllPositions() {
    const { positions } = useTradingStore.getState();

    for (const position of positions) {
      if (position.status === 'fully_exited') continue;

      try {
        const ticker = await indodaxClient.fetchTicker(position.symbol);
        if (!ticker) continue;
        await this.checkPosition(position, ticker.price);
      } catch (err) {
        console.warn(`Failed to check ${position.symbol}:`, err);
      }
    }
  }

  async checkPosition(position: Position, currentPrice: number) {
    const entryPrice = position.avgEntryPrice;
    const pnlPct = (currentPrice - entryPrice) / entryPrice;

    // TP1: +10% → jual 50%
    if (!position.tp1Triggered && pnlPct >= TP1_TARGET) {
      await this.executeTP1(position, currentPrice, pnlPct);
      return;
    }

    // TP2: +15% → jual sisa 50%
    if (position.tp1Triggered && position.quantity > 0 && pnlPct >= TP2_TARGET) {
      await this.executeTP2(position, currentPrice, pnlPct);
      return;
    }

    // Update unrealized PnL
    const currentValue = position.quantity * currentPrice;
    const unrealizedPnl = currentValue - position.totalInvested;
    const unrealizedPnlPercent = (unrealizedPnl / position.totalInvested) * 100;

    useTradingStore.getState().updatePosition(position.symbol, {
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
    });
  }

  private async executeTP1(position: Position, currentPrice: number, pnlPct: number) {
    const sellQuantity = position.quantity * 0.5;
    const sellValue = sellQuantity * currentPrice;
    const costBasis = position.totalInvested * 0.5;
    const pnl = sellValue - costBasis;
    const pnlPercent = (pnl / costBasis) * 100;

    useTradingStore.getState().updatePosition(position.symbol, {
      tp1Triggered: true,
      status: 'tp1_hit',
      quantity: position.quantity - sellQuantity,
      totalInvested: position.totalInvested - costBasis,
      currentValue: sellValue,
    });

    const trade: TradeHistory = {
      id: `trade_${Date.now()}`,
      symbol: position.symbol,
      type: 'SELL_TP1',
      price: currentPrice,
      quantity: sellQuantity,
      total: sellValue,
      pnl,
      pnlPercent,
      timestamp: new Date().toISOString(),
      note: `TP1 fixed — Jual 50% @ +${(TP1_TARGET * 100).toFixed(0)}%`,
    };
    useTradingStore.getState().addTrade(trade);

    useNotificationStore.getState().addNotification({
      type: 'success',
      title: `🎯 TP1 HIT: ${position.symbol}`,
      message: `Jual 50% @ ${currentPrice.toLocaleString('id-ID')} — Profit ${pnlPercent.toFixed(2)}%`,
    });
  }

  private async executeTP2(position: Position, currentPrice: number, pnlPct: number) {
    const sellQuantity = position.quantity;
    const sellValue = sellQuantity * currentPrice;
    const pnl = sellValue - position.totalInvested;
    const pnlPercent = (pnl / position.totalInvested) * 100;

    useTradingStore.getState().updatePosition(position.symbol, {
      status: 'fully_exited',
      quantity: 0,
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
    });

    const trade: TradeHistory = {
      id: `trade_${Date.now()}`,
      symbol: position.symbol,
      type: 'SELL_TP2',
      price: currentPrice,
      quantity: sellQuantity,
      total: sellValue,
      pnl,
      pnlPercent,
      timestamp: new Date().toISOString(),
      note: `TP2 fixed — Jual sisa 50% @ +${(TP2_TARGET * 100).toFixed(0)}%`,
    };
    useTradingStore.getState().addTrade(trade);

    useNotificationStore.getState().addNotification({
      type: 'success',
      title: `✅ FULL EXIT: ${position.symbol}`,
      message: `Semua posisi terjual @ ${currentPrice.toLocaleString('id-ID')} — Total profit ${pnlPercent.toFixed(2)}%`,
    });
  }
}

export const scaleOutEngine = new ScaleOutEngine();