const axios = require('axios');
const path = require('path');
const fs = require('fs');
const coinGeckoAPI = require('./CoinGeckoAPI');

const { getPriceHistory, appendPrice, initCacheFromCoinGecko, loadCache } = coinGeckoAPI;

const SCAN_INTERVAL_MS = 15 * 60 * 1000;

// ─── State persistence ─────────────────────────────────────
const STATE_FILE = path.join(__dirname, '..', 'cache', 'scanner-state.json');

function loadScannerState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        dailyInvested: data.dailyInvested || 0,
        lastResetDate: data.lastResetDate || new Date().toDateString(),
        activePositions: new Set(data.activePositions || []),
        entryHistory: data.entryHistory || {},
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
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      dailyInvested: state.dailyInvested,
      lastResetDate: state.lastResetDate,
      activePositions: [...state.activePositions],
      entryHistory: state.entryHistory,
    }, null, 2));
  } catch (e) {
    console.error('[AutoScanner] State save error:', e.message);
  }
}

let state = loadScannerState();

// ─── Config ──────────────────────────────────────────────
const BUDGET_LOW = 300000;
const BUDGET_HIGH = 500000;
const MIN_TRADE = 50000;

const COIN_CONFIG = [
  { pair: 'btc_idr', symbol: 'BTC', weight: 0.40, volatil: 'high' },
  { pair: 'eth_idr', symbol: 'ETH', weight: 0.25, volatil: 'high' },
  { pair: 'bnb_idr', symbol: 'BNB', weight: 0.15, volatil: 'medium' },
  { pair: 'sol_idr', symbol: 'SOL', weight: 0.10, volatil: 'high' },
  { pair: 'xrp_idr', symbol: 'XRP', weight: 0.05, volatil: 'medium' },
  { pair: 'doge_idr', symbol: 'DOGE', weight: 0.03, volatil: 'high' },
  { pair: 'ada_idr', symbol: 'ADA', weight: 0.03, volatil: 'medium' },
  { pair: 'trx_idr', symbol: 'TRX', weight: 0.03, volatil: 'medium' },
  { pair: 'avax_idr', symbol: 'AVAX', weight: 0.02, volatil: 'high' },
  { pair: 'sui_idr', symbol: 'SUI', weight: 0.02, volatil: 'high' },
  { pair: 'link_idr', symbol: 'LINK', weight: 0.02, volatil: 'medium' },
  { pair: 'ton_idr', symbol: 'TON', weight: 0.02, volatil: 'medium' },
  { pair: 'shib_idr', symbol: 'SHIB', weight: 0.01, volatil: 'high' },
  { pair: 'dot_idr', symbol: 'DOT', weight: 0.01, volatil: 'medium' },
  { pair: 'ltc_idr', symbol: 'LTC', weight: 0.01, volatil: 'medium' },
  { pair: 'bch_idr', symbol: 'BCH', weight: 0.01, volatil: 'medium' },
  { pair: 'uni_idr', symbol: 'UNI', weight: 0.01, volatil: 'medium' },
  { pair: 'etc_idr', symbol: 'ETC', weight: 0.01, volatil: 'medium' },
  { pair: 'fil_idr', symbol: 'FIL', weight: 0.01, volatil: 'medium' },
  { pair: 'xlm_idr', symbol: 'XLM', weight: 0.01, volatil: 'medium' },
];

const THRESHOLDS = {
  btc_idr: { bull: 75, sideways: 50, bear: 35 },
  eth_idr: { bull: 75, sideways: 50, bear: 35 },
  bnb_idr: { bull: 75, sideways: 50, bear: 35 },
  sol_idr: { bull: 75, sideways: 50, bear: 35 },
  xrp_idr: { bull: 75, sideways: 50, bear: 35 },
  doge_idr: { bull: 75, sideways: 50, bear: 35 },
  ada_idr: { bull: 75, sideways: 50, bear: 35 },
  trx_idr: { bull: 75, sideways: 50, bear: 35 },
  avax_idr: { bull: 75, sideways: 50, bear: 35 },
  sui_idr: { bull: 75, sideways: 50, bear: 35 },
  link_idr: { bull: 75, sideways: 50, bear: 35 },
  ton_idr: { bull: 75, sideways: 50, bear: 35 },
  shib_idr: { bull: 75, sideways: 50, bear: 35 },
  dot_idr: { bull: 75, sideways: 50, bear: 35 },
  ltc_idr: { bull: 75, sideways: 50, bear: 35 },
  bch_idr: { bull: 75, sideways: 50, bear: 35 },
  uni_idr: { bull: 75, sideways: 50, bear: 35 },
  etc_idr: { bull: 75, sideways: 50, bear: 35 },
  fil_idr: { bull: 75, sideways: 50, bear: 35 },
  xlm_idr: { bull: 75, sideways: 50, bear: 35 },
};

// ─── Helpers ───────────────────────────────────────────────
function calcMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcBollinger(prices, period = 20) {
  const ma = calcMA(prices, period);
  const slice = prices.slice(-period);
  const sqDiffs = slice.map(p => Math.pow(p - ma, 2));
  const sd = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / period);
  return { upper: ma + 2 * sd, middle: ma, lower: ma - 2 * sd };
}

function detectRegime() {
  const hour = new Date().getHours();
  if (hour >= 2 && hour <= 6) return 'sideways';
  if (hour >= 18 || hour <= 5) return 'bear';
  return 'bull';
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[AutoScanner] ${ts} | ${msg}`);
}

// ─── Core Logic ──────────────────────────────────────────
async function fetchTicker(pair) {
  try {
    const res = await axios.get(`https://indodax.com/api/ticker/${pair}`, { timeout: 10000 });
    return res.data?.ticker;
  } catch (err) {
    log(`Fetch ticker failed: ${pair} | ${err.message}`);
    return null;
  }
}

function calcScore(last, ma20, ma50, ma200, rsi, bbLower, bbUpper, prices) {
  let score = 0;

  // Trend (40%)
  const ma20Rising = ma20 > calcMA(prices.slice(0, -1), 20);
  const ma50Rising = ma50 > calcMA(prices.slice(0, -1), 50);
  const ma200Rising = ma200 > ma50;
  if (last > ma20) score += 10;
  if (last > ma50) score += 10;
  if (last > ma200) score += 10;
  if (ma20Rising) score += 5;
  if (ma50Rising) score += 5;

  // Valuation (30%)
  if (rsi < 30) score += 15;
  else if (rsi < 40) score += 10;
  else if (rsi < 50) score += 5;
  if (last < bbLower) score += 15;

  // Support (30%)
  const recentLow = Math.min(...prices.slice(-20));
  const distFromLow = (last - recentLow) / recentLow;
  if (distFromLow < 0.02) score += 15;
  else if (distFromLow < 0.05) score += 10;
  if (last < ma20 && ma200 > ma50) score += 15;

  return Math.min(score, 100);
}

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

  // Check max loss 25% for existing positions
  if (state.activePositions.has(symbol) && state.entryHistory[symbol + '_price']) {
    const entryPrice = state.entryHistory[symbol + '_price'];
    const lossPct = (entryPrice - last) / entryPrice;
    if (lossPct >= 0.25) {
      log(`🚨 ${pair}: BLACKLISTED — down ${(lossPct*100).toFixed(1)}% from entry`);
      state.activePositions.delete(symbol);
      return null;
    }
  }

  const prices = getPriceHistory(pair, last, high, low);
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

  // Max 10 positions
  if (state.activePositions.size >= 10) {
    log(`${pair}: Max 10 positions reached → SKIP`);
    return null;
  }

  // Re-entry: only if down 10% from last entry
  if (state.activePositions.has(symbol)) {
    const lastEntryPrice = state.entryHistory[symbol + '_price'] || Infinity;
    if (last > lastEntryPrice * 0.9) {
      log(`${pair}: Already have position, not down 10% → SKIP`);
      return null;
    }
    log(`${pair}: Re-entry allowed (down >10%)`);
  }

  const today = new Date().toDateString();
  if (today !== state.lastResetDate) {
    state.dailyInvested = 0;
    state.lastResetDate = today;
    log('Daily budget reset');
  }

  const baseBudget = score >= 85 ? BUDGET_HIGH : BUDGET_LOW;
  const budget = Math.floor(baseBudget * weight * 5);

  if (budget < MIN_TRADE) {
    log(`${pair}: Budget Rp${budget.toLocaleString('id-ID')} < MIN_TRADE → SKIP`);
    return null;
  }

  if (state.dailyInvested + budget > (process.env.MAX_DAILY_INVESTMENT || 5000000)) {
    log(`Daily budget exhausted: Rp${state.dailyInvested.toLocaleString('id-ID')}`);
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
      state.activePositions.add(signal.symbol);
      state.entryHistory[signal.symbol] = Date.now();
      state.entryHistory[signal.symbol + '_price'] = signal.price;
      state.dailyInvested += signal.budget;
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
let scanning = false;
let scanTimer = null;

async function scanOnce() {
  if (scanning) {
    log('Scan sebelumnya masih jalan, skip.');
    return;
  }
  scanning = true;
  log('═══════════════════════════════════════════════════════');
  log('Scan mulai');

  try {
    const regime = detectRegime();
    log(`Regime: ${regime.toUpperCase()}`);

    const sorted = [...COIN_CONFIG].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.volatil] || 3) - (order[b.volatil] || 3);
    });

    let executed = 0;
    for (const config of sorted) {
      const signal = await scanCoin(config, regime);
      if (signal) {
        const ok = await executeBuy(signal);
        if (ok) executed++;
      }
    }

    log(`Scan selesai. Executed: ${executed} trades.`);
  } catch (err) {
    log(`Scan error: ${err.message}`);
  } finally {
    scanning = false;
    saveScannerState();
  }
}

function startAutoScanner() {
  log('AutoScanner started (15 min interval)');
  scanOnce();
  scanTimer = setInterval(scanOnce, SCAN_INTERVAL_MS);
}

function stopAutoScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
    log('AutoScanner stopped');
  }
}

module.exports = { startAutoScanner, stopAutoScanner };

if (require.main === module) {
  startAutoScanner();
}
