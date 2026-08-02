// ============================================================
// ABBI DeskLive — Backend Auto Scanner (V5.1)
// FIXED:
//   1. Init CoinGecko cache saat start (jangan crash kalau cache kosong)
//   2. Sync activePositions dengan backend state file
//   3. Fix race condition: appendPrice setelah getPriceHistory selesai
//   4. Threshold sideways = 85 (very strong only)
// ============================================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Import CoinGecko API ──────────────────────────────────
let coinGeckoAPI;
try {
  coinGeckoAPI = require('./CoinGeckoAPI');
} catch (err) {
  console.error('[AutoScanner] Failed to load CoinGeckoAPI:', err.message);
  process.exit(1);
}

const { getPriceHistory, appendPrice, initCacheFromCoinGecko, loadCache } = coinGeckoAPI;

const SCAN_INTERVAL_MS = 15 * 60 * 1000;

// ─── State persistence ───────────────────────────────────
const STATE_FILE = path.join(__dirname, '..', 'cache', 'scanner-state.json');

function loadScannerState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        dailyInvested: data.dailyInvested || 0,
        lastResetDate: data.lastResetDate || new Date().toDateString(),
        activePositions: new Set(data.activePositions || []),
        entryHistory: data.entryHistory || {}, // { symbol: timestamp }
      };
    }
  } catch (e) {
    console.error('[AutoScanner] State load error:', e.message);
  }
  return {
    dailyInvested: 0,
    lastResetDate: new Date().toDateString(),
    activePositions: new Set(),
    entryHistory: {},
  };
}

function saveScannerState() {
  try {
    const cacheDir = path.join(__dirname, '..', 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    
    const data = {
      dailyInvested,
      lastResetDate,
      activePositions: Array.from(activePositions),
      entryHistory,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[AutoScanner] State save error:', e.message);
  }
}

// ─── Coin Config ───────────────────────────────────────────
const COIN_CONFIG = [
  { pair: 'btc_idr', symbol: 'BTC', weight: 0.40, volatil: false },
  { pair: 'eth_idr', symbol: 'ETH', weight: 0.20, volatil: false },
  { pair: 'sol_idr', symbol: 'SOL', weight: 0.10, volatil: true },
  { pair: 'bnb_idr', symbol: 'BNB', weight: 0.10, volatil: false },
  { pair: 'xrp_idr', symbol: 'XRP', weight: 0.05, volatil: true },
  { pair: 'ada_idr', symbol: 'ADA', weight: 0.03, volatil: true },
  { pair: 'avax_idr', symbol: 'AVAX', weight: 0.03, volatil: true },
  { pair: 'link_idr', symbol: 'LINK', weight: 0.02, volatil: true },
  { pair: 'dot_idr', symbol: 'DOT', weight: 0.02, volatil: true },
  { pair: 'matic_idr', symbol: 'MATIC', weight: 0.02, volatil: true },
  { pair: 'near_idr', symbol: 'NEAR', weight: 0.02, volatil: true },
  { pair: 'arb_idr', symbol: 'ARB', weight: 0.015, volatil: true },
  { pair: 'op_idr', symbol: 'OP', weight: 0.015, volatil: true },
  { pair: 'sei_idr', symbol: 'SEI', weight: 0.015, volatil: true },
  { pair: 'sui_idr', symbol: 'SUI', weight: 0.015, volatil: true },
  { pair: 'inj_idr', symbol: 'INJ', weight: 0.01, volatil: true },
  { pair: 'render_idr', symbol: 'RENDER', weight: 0.01, volatil: true },
  { pair: 'tia_idr', symbol: 'TIA', weight: 0.01, volatil: true },
  { pair: 'jup_idr', symbol: 'JUP', weight: 0.01, volatil: true },
  { pair: 'pyth_idr', symbol: 'PYTH', weight: 0.01, volatil: true },
];

// ─── Thresholds (sideways = 85) ──────────────────────────
const THRESHOLDS = {
  btc_idr: { bear: 50, bull: 75, sideways: 85 },
  eth_idr: { bear: 45, bull: 70, sideways: 85 },
  sol_idr: { bear: 45, bull: 70, sideways: 85 },
  bnb_idr: { bear: 45, bull: 70, sideways: 85 },
  xrp_idr: { bear: 40, bull: 65, sideways: 85 },
  ada_idr: { bear: 40, bull: 65, sideways: 85 },
  avax_idr: { bear: 40, bull: 65, sideways: 85 },
  link_idr: { bear: 40, bull: 65, sideways: 85 },
  dot_idr: { bear: 40, bull: 65, sideways: 85 },
  matic_idr: { bear: 40, bull: 65, sideways: 85 },
  near_idr: { bear: 38, bull: 62, sideways: 85 },
  arb_idr: { bear: 38, bull: 62, sideways: 85 },
  op_idr: { bear: 38, bull: 62, sideways: 85 },
  sei_idr: { bear: 38, bull: 62, sideways: 85 },
  sui_idr: { bear: 38, bull: 62, sideways: 85 },
  inj_idr: { bear: 35, bull: 60, sideways: 85 },
  render_idr: { bear: 35, bull: 60, sideways: 85 },
  tia_idr: { bear: 35, bull: 60, sideways: 85 },
  jup_idr: { bear: 35, bull: 60, sideways: 85 },
  pyth_idr: { bear: 35, bull: 60, sideways: 85 },
};

const BUDGET_LOW = 300000;
const BUDGET_HIGH = 500000;
const MIN_TRADE = 50000;
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 jam

// ─── State ─────────────────────────────────────────────────
let scanning = false;
let state = loadScannerState();
let dailyInvested = state.dailyInvested;
let lastResetDate = state.lastResetDate;
let activePositions = state.activePositions;
let entryHistory = state.entryHistory; // { symbol: timestamp }

function log(msg) {
  console.log(`[AutoScanner ${new Date().toISOString()}] ${msg}`);
}

// ─── Fetch REAL ticker from Indodax ──────────────────────
async function fetchTicker(pair) {
  try {
    const res = await axios.get(`https://indodax.com/api/ticker/${pair}`, { timeout: 10000 });
    return res.data?.ticker || null;
  } catch (err) {
    log(`${pair}: fetchTicker failed — ${err.message}`);
    return null;
  }
}

// ─── Technical Indicators ─────────────────────────────────
function calcMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcBollinger(prices, period = 20) {
  const ma = calcMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: ma + 2 * sd, middle: ma, lower: ma - 2 * sd };
}

function calcScore(price, ma20, ma50, ma200, rsi, bbLower, bbUpper, prices) {
  let trendScore = 0;
  if (price < ma200 && ma50 < ma200 * 1.02) trendScore = 28;
  else if (price < ma20 && ma200 > ma200 * 0.98) trendScore = 20;
  else if (price > ma20 && price > ma50 && price > ma200) trendScore = 5;
  else trendScore = 12;

  let valScore = 0;
  if (rsi < 30) valScore = 38;
  else if (rsi < 38) valScore = 32;
  else if (rsi < 55) valScore = 20;
  else if (rsi < 80) valScore = 8;
  else valScore = 2;

  const bbBonus = price <= bbLower * 1.02 ? 4 : 0;
  valScore = Math.min(40, valScore + bbBonus);

  const low20d = Math.min(...prices.slice(-20));
  let supScore = 0;
  if (price <= low20d * 1.02) supScore = 25;
  else if (price <= low20d * 1.05) supScore = 15;

  return Math.min(100, Math.round(trendScore + valScore + supScore));
}

// ─── Detect Market Regime ──────────────────────────────────
async function detectRegime() {
  const ticker = await fetchTicker('btc_idr');
  if (!ticker) return 'bear';

  const last = parseFloat(ticker.last);
  const high = parseFloat(ticker.high);
  const low = parseFloat(ticker.low);

  const prices = getPriceHistory('btc_idr', last, high, low);
  const ma200 = calcMA(prices, 200);

  if (last < ma200 * 0.98) return 'bear';
  if (last > ma200 * 1.02) return 'bull';
  return 'sideways';
}

// ─── Cooldown Check ──────────────────────────────────────
function isInCooldown(symbol) {
  const lastEntry = entryHistory[symbol];
  if (!lastEntry) return false;
  return Date.now() - lastEntry < COOLDOWN_MS;
}

// ─── Core: Scan Single Coin ───────────────────────────────
async function scanCoin(config, regime) {
  const { pair, symbol, weight, volatil } = config;

  const ticker = await fetchTicker(pair);
  if (!ticker) {
    log(`${pair}: Skip — no ticker data`);
    return null;
  }

  const last = parseFloat(ticker.last);
  const high = parseFloat(ticker.high);
  const low = parseFloat(ticker.low);

  // ─── FIX: Get price history DULU, baru append ──────────
  const prices = getPriceHistory(pair, last, high, low);
  
  // Append harga terbaru ke cache untuk scan berikutnya
  appendPrice(pair, last);

  const ma20 = calcMA(prices, 20);
  const ma50 = calcMA(prices, 50);
  const ma200 = calcMA(prices, 200);
  const rsi = calcRSI(prices);
  const bb = calcBollinger(prices);

  const score = calcScore(last, ma20, ma50, ma200, rsi, bb.lower, bb.upper, prices);
  const threshold = THRESHOLDS[pair]?.[regime] || 70;

  log(`${pair}: Price=${last.toLocaleString('id-ID')} | RSI=${rsi.toFixed(1)} | Score=${score} | Threshold=${threshold} | Volatil=${volatil}`);

  if (score < threshold) {
    log(`${pair}: Score ${score} < ${threshold} → SKIP`);
    return null;
  }

  // ─── Cooldown check ────────────────────────────────────
  if (isInCooldown(symbol)) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - entryHistory[symbol])) / 60000);
    log(`${pair}: Cooldown active (${remaining} min remaining) → SKIP`);
    return null;
  }

  if (activePositions.has(symbol)) {
    log(`${pair}: Already have position → SKIP (1-entry rule)`);
    return null;
  }

  const low20d = Math.min(...prices.slice(-20));
  if (last > low20d * 1.02) {
    log(`${pair}: Not at 20-day low → SKIP`);
    return null;
  }

  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyInvested = 0;
    lastResetDate = today;
    log('Daily budget reset');
  }

  // Budget berdasarkan score + weight
  const baseBudget = score >= 85 ? BUDGET_HIGH : BUDGET_LOW;
  const budget = Math.floor(baseBudget * weight * 5);

  if (budget < MIN_TRADE) {
    log(`${pair}: Budget Rp${budget.toLocaleString('id-ID')} < MIN_TRADE → SKIP`);
    return null;
  }

  if (dailyInvested + budget > 6000000) {
    log(`Daily budget exhausted: Rp${dailyInvested.toLocaleString('id-ID')}`);
    return null;
  }

  return {
    pair,
    symbol,
    score,
    price: last,
    budget,
    reason: `Score ${score} ≥ ${threshold} | RSI ${rsi.toFixed(1)} | Weight ${(weight*100).toFixed(0)}%`,
  };
}

// ─── Execute Buy ─────────────────────────────────────────
async function executeBuy(signal) {
  try {
    log(`🛒 BUY: ${signal.pair} @ Rp${signal.price.toLocaleString('id-ID')} | Budget: Rp${signal.budget.toLocaleString('id-ID')}`);
    log(`   Reason: ${signal.reason}`);

    const res = await axios.post('http://localhost:3002/api/private/trade', {
      pair: signal.pair,
      type: 'buy',
      price: signal.price,
      amountIdr: signal.budget,
    }, { timeout: 30000 });

    if (res.data?.success) {
      log(`✅ BUY SUCCESS: ${signal.pair} | OrderID: ${res.data.orderId}`);
      activePositions.add(signal.symbol);
      entryHistory[signal.symbol] = Date.now();
      dailyInvested += signal.budget;
      saveScannerState();
      return true;
    } else {
      log(`❌ BUY FAILED: ${signal.pair} | ${res.data?.error || 'Unknown'}`);
      return false;
    }
  } catch (err) {
    log(`❌ BUY ERROR: ${signal.pair} | ${err.message}`);
    return false;
  }
}

// ─── Main Scan Loop ──────────────────────────────────────
async function scanOnce() {
  if (scanning) {
    log('Scan sebelumnya masih jalan, skip.');
    return;
  }
  scanning = true;
  log('══════════════════════════════════════════');
  log('Scan mulai');

  try {
    const regime = await detectRegime();
    log(`Regime: ${regime.toUpperCase()}`);

    // Prioritaskan coin volatil dulu
    const sortedCoins = [...COIN_CONFIG].sort((a, b) => {
      if (a.volatil && !b.volatil) return -1;
      if (!a.volatil && b.volatil) return 1;
      return b.weight - a.weight;
    });

    const signals = [];
    for (const coin of sortedCoins) {
      await new Promise(r => setTimeout(r, 500));
      const signal = await scanCoin(coin, regime);
      if (signal) signals.push(signal);
    }

    log(`Found ${signals.length} signals`);

    signals.sort((a, b) => b.score - a.score);
    for (const signal of signals) {
      await executeBuy(signal);
      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (err) {
    log(`Scan error: ${err.message}`);
  }

  scanning = false;
  log(`Next scan in ${SCAN_INTERVAL_MS / 60000} menit`);
  log('══════════════════════════════════════════');
}

// ─── Public API ──────────────────────────────────────────
async function startAutoScanner() {
  log('=== INITIALIZING AUTOSCANNER V5.1 ===');
  
  // ─── FIX: Init CoinGecko cache sebelum mulai ───────────
  const cache = loadCache();
  const cacheKeys = Object.keys(cache);
  log(`Cache status: ${cacheKeys.length} coins cached`);
  
  if (cacheKeys.length < 5) {
    log('Cache kosong atau kurang — menginisialisasi dari CoinGecko...');
    log('⚠️ Ini akan memakan waktu ~5 menit (rate limit CoinGecko)');
    await initCacheFromCoinGecko();
    log('Cache initialization complete.');
  }

  log(`Aktif. Interval: ${SCAN_INTERVAL_MS / 60000} menit.`);
  scanOnce();
  setInterval(scanOnce, SCAN_INTERVAL_MS);
}

function stopAutoScanner() {}

function getStatus() {
  return {
    scanning,
    dailyInvested,
    lastResetDate,
    activePositions: Array.from(activePositions),
    entryHistory,
  };
}

module.exports = { startAutoScanner, scanOnce, getStatus };
