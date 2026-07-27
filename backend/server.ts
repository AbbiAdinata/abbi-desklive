// ============================================================
// ABBI DeskLive — Backend Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tradeRoutes from './routes/trade';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Trade routes
app.use('/api/trade', tradeRoutes);
app.use('/api/risk', tradeRoutes);

app.listen(PORT, () => {
  console.log(`[ABBI Backend] Server running on port ${PORT}`);
  console.log(`[ABBI Backend] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ABBI Backend] API Key configured: ${process.env.INDODAX_API_KEY ? 'YES' : 'NO'}`);
});