// ============================================================
// ABBI DeskLive — Proxy Server (Public API Only)
// ============================================================

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001;

app.use(cors());

// Proxy everything to Indodax
app.use('/', createProxyMiddleware({
  target: 'https://api.indodax.com',
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    console.log('[Proxy]', req.method, req.url);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('[Proxy] Response:', proxyRes.statusCode, req.url);
  },
  onError: (err, req, res) => {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  },
}));

app.listen(PORT, () => {
  console.log(`🚀 Proxy running on http://localhost:${PORT}`);
});