// ============================================================
// ABBI DeskLive — Secure Backend Proxy Server (FINAL FIX)
// ============================================================
// PERUBAHAN:
// 1. getInfo pakai endpoint lama: https://indodax.com/tapi
// 2. Order/Trade history pakai endpoint baru: https://tapi.indodax.com/api/v2/...
// 3. Header: X-APIKEY (bukan Key)
// 4. Parameter: timestamp (ms) + recvWindow (bukan nonce)
// 5. Content-Type: application/json untuk endpoint baru
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;

// ─── CORS ──────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── SAFETY: Validate environment ──────────────────────────
const API_KEY = process.env.INDODAX_API_KEY;
const API_SECRET = process.env.INDODAX_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌ [FATAL] INDODAX_API_KEY atau INDODAX_API_SECRET tidak ditemukan di .env');
  process.exit(1);
}

// ─── Helper: HMAC-SHA512 Signature ───────────────────────
function createHmacSign(payload, secret) {
  const sortedKeys = Object.keys(payload).sort();
  const queryString = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(payload[key]))}`)
    .join('&');

  const sign = crypto.createHmac('sha512', secret).update(queryString).digest('hex');
  return { sign, queryString };
}

// ─── Helper: Get timestamp in milliseconds ─────────────────
function getTimestamp() {
  return Date.now();
}

// ─── Middleware: Request Logger ────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════════════════════════
// PUBLIC API PROXY (No auth needed)
// ═══════════════════════════════════════════════════════════

app.get('/api/public/ticker/:pair', async (req, res) => {
  try {
    const response = await axios.get(
      `https://indodax.com/api/ticker/${req.params.pair}`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[Public Ticker Error]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/public/ticker_all', async (req, res) => {
  try {
    const response = await axios.get('https://indodax.com/api/ticker_all', {
      timeout: 10000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('[Public TickerAll Error]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/public/depth/:pair', async (req, res) => {
  try {
    const response = await axios.get(
      `https://indodax.com/api/depth/${req.params.pair}`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[Public Depth Error]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PRIVATE API PROXY
// ═══════════════════════════════════════════════════════════

// GET INFO (Balance) — Endpoint LAMA dengan parameter timestamp
app.post('/api/private/info', async (req, res) => {
  try {
    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { 
      method: 'getInfo', 
      timestamp,
      recvWindow 
    };
    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    console.log('[Backend] getInfo → indodax.com/tapi (endpoint lama)');
    console.log('[Backend] Query string:', queryString);

    // ✅ FIX: Pakai endpoint LAMA dengan timestamp (bukan nonce)
    const response = await axios({
      method: 'POST',
      url: 'https://indodax.com/tapi',
      data: queryString,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Key': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    console.log('[Backend] Response status:', response.status);
    console.log('[Backend] Response data type:', typeof response.data);
    console.log('[Backend] Response data:', JSON.stringify(response.data).substring(0, 1000));

    // Format lama: { success: 1, return: { balance: {...} } }
    if (response.data && response.data.success === 1 && response.data.return) {
      const balance = response.data.return.balance || {};
      return res.json({
        success: true,
        idr: parseFloat(balance.idr || 0),
        coins: balance,
        raw: response.data,
      });
    }

    // Format error lama
    if (response.data && response.data.error) {
      return res.status(400).json({
        success: false,
        idr: 0,
        coins: {},
        error: response.data.error,
        raw: response.data,
      });
    }

    // Format baru atau unexpected
    res.status(502).json({
      success: false,
      idr: 0,
      coins: {},
      error: 'Unexpected response format',
      raw: response.data,
    });

  } catch (err) {
    console.error('[Backend getInfo Error]', err.message);
    if (err.response) {
      console.error('[Backend] Error status:', err.response.status);
      console.error('[Backend] Error data:', err.response.data);
    }
    res.status(500).json({ 
      success: false,
      idr: 0,
      coins: {},
      error: err.message 
    });
  }
});

// TRADE (Buy/Sell) — Endpoint LAMA
app.post('/api/private/trade', async (req, res) => {
  try {
    const { pair, type, price, amountIdr, quantity } = req.body;

    if (!pair || !type || !['buy', 'sell'].includes(type)) {
      return res.status(400).json({ error: 'Invalid trade parameters' });
    }

    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { 
      method: 'trade', 
      pair, 
      type, 
      price: price || 0,
      timestamp,
      recvWindow 
    };

    if (type === 'buy' && amountIdr) {
      payload.idr = amountIdr;
    } else if (type === 'sell' && quantity) {
      const coin = pair.replace('_idr', '');
      payload[coin] = quantity;
    }

    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    console.log(`[Backend] trade ${type} ${pair} → indodax.com/tapi`);

    const response = await axios({
      method: 'POST',
      url: 'https://indodax.com/tapi',
      data: queryString,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Key': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    console.log('[Backend] Trade response:', JSON.stringify(response.data).substring(0, 500));

    if (response.data && response.data.success === 1) {
      return res.json({
        success: true,
        orderId: response.data.return?.order_id?.toString(),
        raw: response.data,
      });
    }

    res.status(400).json({
      success: false,
      error: response.data?.error || 'Trade failed',
      raw: response.data,
    });

  } catch (err) {
    console.error('[Backend trade Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// OPEN ORDERS — Endpoint LAMA
app.post('/api/private/openOrders', async (req, res) => {
  try {
    const { pair } = req.body;
    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { method: 'openOrders', timestamp, recvWindow };
    if (pair) payload.pair = pair;

    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    const response = await axios({
      method: 'POST',
      url: 'https://indodax.com/tapi',
      data: queryString,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Key': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    if (response.data && response.data.success === 1) {
      return res.json({
        success: true,
        orders: response.data.return?.orders || [],
        raw: response.data,
      });
    }

    res.status(400).json({
      success: false,
      orders: [],
      error: response.data?.error || 'Failed to fetch orders',
    });

  } catch (err) {
    console.error('[Backend openOrders Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CANCEL ORDER — Endpoint LAMA
app.post('/api/private/cancelOrder', async (req, res) => {
  try {
    const { pair, order_id, type } = req.body;
    if (!pair || !order_id || !type) {
      return res.status(400).json({ error: 'Missing cancel parameters' });
    }

    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { method: 'cancelOrder', pair, order_id, type, timestamp, recvWindow };
    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    const response = await axios({
      method: 'POST',
      url: 'https://indodax.com/tapi',
      data: queryString,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Key': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    if (response.data && response.data.success === 1) {
      return res.json({ success: true, raw: response.data });
    }

    res.status(400).json({
      success: false,
      error: response.data?.error || 'Cancel failed',
    });

  } catch (err) {
    console.error('[Backend cancelOrder Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// NEW V2 ENDPOINTS (Order History & Trade History)
// ═══════════════════════════════════════════════════════════

// GET Order History (V2)
app.get('/api/private/orderHistories', async (req, res) => {
  try {
    const { symbol, startTime, endTime, limit = 100, sort = 'desc' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { timestamp, recvWindow };
    
    if (symbol) payload.symbol = symbol;
    if (startTime) payload.startTime = startTime;
    if (endTime) payload.endTime = endTime;
    if (limit) payload.limit = limit;
    if (sort) payload.sort = sort;

    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    const response = await axios({
      method: 'GET',
      url: `https://tapi.indodax.com/api/v2/order/histories?${queryString}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-APIKEY': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);

  } catch (err) {
    console.error('[Backend orderHistories Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET Trade History (V2)
app.get('/api/private/myTrades', async (req, res) => {
  try {
    const { symbol, orderId, clientOrderId, startTime, endTime, limit = 500, sort = 'desc' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const timestamp = getTimestamp();
    const recvWindow = 5000;
    const payload = { timestamp, recvWindow };
    
    if (symbol) payload.symbol = symbol;
    if (orderId) payload.orderId = orderId;
    if (clientOrderId) payload.clientOrderId = clientOrderId;
    if (startTime) payload.startTime = startTime;
    if (endTime) payload.endTime = endTime;
    if (limit) payload.limit = limit;
    if (sort) payload.sort = sort;

    const { sign, queryString } = createHmacSign(payload, API_SECRET);

    const response = await axios({
      method: 'GET',
      url: `https://tapi.indodax.com/api/v2/myTrades?${queryString}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-APIKEY': API_KEY,
        'Sign': sign,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);

  } catch (err) {
    console.error('[Backend myTrades Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!API_KEY,
    apiSecretConfigured: !!API_SECRET,
  });
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('============================================================');
  console.log('  ABBI DeskLive — Secure Backend Proxy FINAL');
  console.log('============================================================');
  console.log('  Port:', PORT);
  console.log('  API Key:', API_KEY ? '✅ Configured' : '❌ Missing');
  console.log('  API Secret:', API_SECRET ? '✅ Configured' : '❌ Missing');
  console.log('  Private API (Legacy): https://indodax.com/tapi');
  console.log('  Private API (V2): https://tapi.indodax.com/api/v2/...');
  console.log('  Public API: https://indodax.com/api/...');
  console.log('  CORS Origins:', allowedOrigins.join(', '));
  console.log('============================================================');
  console.log('  Endpoints:');
  console.log('    GET  /api/public/ticker/:pair');
  console.log('    GET  /api/public/ticker_all');
  console.log('    GET  /api/public/depth/:pair');
  console.log('    POST /api/private/info (legacy)');
  console.log('    POST /api/private/trade (legacy)');
  console.log('    POST /api/private/openOrders (legacy)');
  console.log('    POST /api/private/cancelOrder (legacy)');
  console.log('    GET  /api/private/orderHistories (v2)');
  console.log('    GET  /api/private/myTrades (v2)');
  console.log('    GET  /health');
  console.log('============================================================');
});