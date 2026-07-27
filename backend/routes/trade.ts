// ============================================================
// ABBI DeskLive — Backend Trade API Routes
// ============================================================
// Endpoint:
//   POST /api/trade/buy    → Eksekusi beli via Indodax
//   POST /api/trade/sell   → Eksekusi jual via Indodax
//   GET  /api/trade/balance → Cek saldo
//   GET  /api/risk/status   → Cek risk manager status
// ============================================================

import { Router } from 'express';
import { tradeExecutor } from '../engine/TradeExecutor';
import { riskManager } from '../engine/RiskManager';

const router = Router();

// ─── POST /api/trade/buy ─────────────────────────────────
router.post('/buy', async (req, res) => {
  try {
    const { symbol, amountIdr } = req.body;

    if (!symbol || !amountIdr) {
      return res.status(400).json({ success: false, message: 'symbol and amountIdr required' });
    }

    const pair = `${symbol.toString().toLowerCase()}_idr`;

    // Risk check
    const balance = await tradeExecutor.getBalance();
    const portfolioValue = 0; // TODO: hitung dari DB
    const portfolioCost = 0;  // TODO: hitung dari DB

    const riskCheck = await riskManager.canTrade(symbol, amountIdr, portfolioValue, portfolioCost);
    if (!riskCheck.allowed) {
      return res.status(403).json({ success: false, message: riskCheck.reason });
    }

    // Execute
    const result = await tradeExecutor.buy(pair, amountIdr);

    if (result.success) {
      riskManager.recordTrade(amountIdr);
      return res.json({
        success: true,
        orderId: result.orderId,
        executedPrice: result.executedPrice,
        executedAmount: result.executedAmount,
      });
    }

    return res.status(502).json({ success: false, message: result.error });
  } catch (err: any) {
    console.error('[API] /buy error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/trade/sell ────────────────────────────────
router.post('/sell', async (req, res) => {
  try {
    const { symbol, quantity, reason } = req.body;

    if (!symbol || !quantity) {
      return res.status(400).json({ success: false, message: 'symbol and quantity required' });
    }

    const pair = `${symbol.toString().toLowerCase()}_idr`;
    const result = await tradeExecutor.sell(pair, quantity);

    if (result.success) {
      return res.json({
        success: true,
        orderId: result.orderId,
        executedPrice: result.executedPrice,
        reason: reason || 'scale-out',
      });
    }

    return res.status(502).json({ success: false, message: result.error });
  } catch (err: any) {
    console.error('[API] /sell error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/trade/balance ──────────────────────────────
router.get('/balance', async (_req, res) => {
  try {
    const balance = await tradeExecutor.getBalance();
    if (balance) {
      return res.json({ success: true, balance });
    }
    return res.status(502).json({ success: false, message: 'Failed to fetch balance' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/risk/status ────────────────────────────────
router.get('/risk/status', (_req, res) => {
  return res.json({ success: true, risk: riskManager.getStatus() });
});

export default router;