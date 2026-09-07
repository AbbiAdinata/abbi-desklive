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

// ─── Screening Cache ──────────────────────────────────────
let lastScanResults = [];
let priceCache = {};

// ─── Daily History Collection ─────────────────────────────
const DAILY_HISTORY_FILE = path.join(__dirname, '..', 'cache', 'daily-history.json');

function loadDailyHistory() {
  try {
    if (fs.existsSync(DAILY_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(DAILY_HISTORY_FILE, 'utf8'));
    }
  } catch (err) {
    log(`[Daily] Failed to load daily history: ${err.message}`);
  }
  return {};
}

function saveDailyHistory(data) {
  try {
    fs.writeFileSync(DAILY_HISTORY_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(`[Daily] Failed to save daily history: ${err.message}`);
    return false;
  }
}

function addDailyClose(pair, price) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const history = loadDailyHistory();
  
  if (!history[pair]) history[pair] = [];
  
  // Cek apakah sudah ada entry untuk hari ini
  const existing = history[pair].findIndex(e => e.date === today);
  
  if (existing >= 0) {
    // Update harga terakhir hari ini
    history[pair][existing].close = price;
  } else {
    // Tambah entry baru
    history[pair].push({ date: today, close: price });
    log(`[Daily] Added ${pair}: ${today} @ ${price.toLocaleString('id-ID')}`);
  }
  
  // Keep only last 365 days
  if (history[pair].length > 365) {
    history[pair] = history[pair].slice(-365);
  }
  
  saveDailyHistory(history);
  return history[pair].length;
}

function getDailyPrices(pair, days = 200) {
  const history = loadDailyHistory();
  if (!history[pair]) return [];
  return history[pair].slice(-days).map(e => e.close);
}

function getDailyRegime(pair = 'btc_idr') {
  const prices = getDailyPrices(pair, 200);
  
  if (prices.length < 20) {
    log(`[Daily] ${pair}: Insufficient data (${prices.length} days), defaulting to sideways`);
    return { regime: 'sideways', confidence: 30, ma20: null, ma50: null, ma200: null, days: prices.length };
  }
  
  const ma20 = calcMA(prices, 20);
  const last = prices[prices.length - 1];
  
  let ma50 = null, ma200 = null;
  let regime = 'sideways';
  let confidence = 50;
  
  if (prices.length >= 50) {
    ma50 = calcMA(prices, 50);
    
    if (prices.length >= 200) {
      ma200 = calcMA(prices, 200);
      
      // Full regime detection
      if (last > ma20 && ma20 > ma50 && ma50 > ma200) {
        regime = 'bull';
        confidence = 85;
      } else if (last < ma20 && ma20 < ma50 && ma50 < ma200) {
        regime = 'bear';
        confidence = 85;
      } else {
        regime = 'sideways';
        confidence = 60;
      }
    } else {
      // Partial: MA20 + MA50 only
      if (last > ma20 && ma20 > ma50) {
        regime = 'bull';
        confidence = 65;
      } else if (last < ma20 && ma20 < ma50) {
        regime = 'bear';
        confidence = 65;
      } else {
        regime = 'sideways';
        confidence = 50;
      }
    }
  } else {
    // Minimal: MA20 only
    if (last > ma20) {
      regime = 'bull';
      confidence = 45;
    } else if (last < ma20) {
      regime = 'bear';
      confidence = 45;
    }
  }
  
  log(`[Daily] ${pair}: ${regime.toUpperCase()} (${prices.length} days, conf: ${confidence}%)`);
  return { regime, confidence, ma20, ma50, ma200, days: prices.length };
}

let lastRegime = "sideways";

function getScreeningData() {
  return { regime: lastRegime, signals: lastScanResults, timestamp: new Date().toISOString() };
}

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
  btc_idr: { bull: 65, sideways: 55, bear: 40 },
  eth_idr: { bull: 65, sideways: 55, bear: 40 },
  bnb_idr: { bull: 65, sideways: 55, bear: 40 },
  sol_idr: { bull: 65, sideways: 55, bear: 40 },
  xrp_idr: { bull: 65, sideways: 55, bear: 40 },
  doge_idr: { bull: 65, sideways: 55, bear: 40 },
  ada_idr: { bull: 65, sideways: 55, bear: 40 },
  trx_idr: { bull: 65, sideways: 55, bear: 40 },
  avax_idr: { bull: 65, sideways: 55, bear: 40 },
  sui_idr: { bull: 65, sideways: 55, bear: 40 },
  link_idr: { bull: 65, sideways: 55, bear: 40 },
  ton_idr: { bull: 65, sideways: 55, bear: 40 },
  shib_idr: { bull: 65, sideways: 55, bear: 40 },
  dot_idr: { bull: 65, sideways: 55, bear: 40 },
  ltc_idr: { bull: 65, sideways: 55, bear: 40 },
  bch_idr: { bull: 65, sideways: 55, bear: 40 },
  uni_idr: { bull: 65, sideways: 55, bear: 40 },
  etc_idr: { bull: 65, sideways: 55, bear: 40 },
  fil_idr: { bull: 65, sideways: 55, bear: 40 },
  xlm_idr: { bull: 65, sideways: 55, bear: 40 },
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
  try {
    // Use daily data for long-term regime detection
    const daily = getDailyRegime('btc_idr');
    
    if (daily.regime === 'sideways' && daily.confidence < 40) {
      // Fallback to intraday if daily insufficient
      log('[Regime] Daily data insufficient, using intraday fallback');
      const btcPrices = priceCache['btc_idr'] || [];
      if (btcPrices.length >= 50) {
        const last = btcPrices[btcPrices.length - 1];
        const ma20 = calcMA(btcPrices, 20);
        const ma50 = calcMA(btcPrices, 50);
        
        if (last > ma20 && ma20 > ma50) return 'bull';
        if (last < ma20 && ma20 < ma50) return 'bear';
      }
      return 'sideways';
    }
    
    // Log detailed info
    const parts = [`BTC ${daily.days} days`];
    if (daily.ma20) parts.push(`MA20: ${daily.ma20.toLocaleString('id-ID')}`);
    if (daily.ma50) parts.push(`MA50: ${daily.ma50.toLocaleString('id-ID')}`);
    if (daily.ma200) parts.push(`MA200: ${daily.ma200.toLocaleString('id-ID')}`);
    
    log(`[Regime] ${daily.regime.toUpperCase()} (${daily.confidence}%) | ${parts.join(' | ')}`);
    
    return daily.regime;
  } catch (err) {
    log(`[Regime] Error: ${err.message}, defaulting to sideways`);
    return 'sideways';
  }
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
  
  // Update local priceCache for regime detection
  if (!priceCache[pair]) priceCache[pair] = [];
  priceCache[pair].push(last);
  if (priceCache[pair].length > 250) priceCache[pair].shift();
  
  // Save daily close for long-term regime detection
  addDailyClose(pair, last);

  const ma20 = calcMA(prices, 20);
  const ma50 = calcMA(prices, 50);
  const ma200 = calcMA(prices, 200);
  const rsi = calcRSI(prices);
  const bb = calcBollinger(prices);

  const score = calcScore(last, ma20, ma50, ma200, rsi, bb.lower, bb.upper, prices);
  const threshold = THRESHOLDS[pair]?.[regime] || 70;

  log(`${pair}: Price=${last.toLocaleString('id-ID')} | RSI=${rsi.toFixed(1)} | Score=${score} | Threshold=${threshold} | Volatil=${volatil}`);

  // ─── Screening Cache: Save ALL coins ──────────────────────
  const trendPhase = score >= 75 ? 'structural_discount' : score >= 55 ? 'healthy_pullback' : score >= 40 ? 'neutral' : 'overextended';
  const bollingerStatus = last < bb.lower ? 'below_lower' : last === bb.lower ? 'at_lower' : last > bb.upper ? 'above_upper' : last === bb.upper ? 'at_upper' : 'between';
  const maAlignment = last > ma20 && ma20 > ma50 && ma50 > ma200 ? 'bullish' : last < ma20 && ma20 < ma50 ? 'bearish' : 'mixed';
  const recommendation = score >= 85 && rsi < 30 ? 'STRONG_BUY' : score >= threshold && rsi < 50 ? 'ACCUMULATE' : score >= 40 ? 'HOLD' : rsi >= 80 ? 'STRONG_SELL' : rsi >= 70 ? 'REDUCE' : 'HOLD';
  const confidence = Math.min(score, 100);

  lastScanResults.push({
    pair,
    symbol,
    score,
    regime,
    threshold,
    rsi,
    ma20,
    ma50,
    ma200,
    bbLower: bb.lower,
    bbUpper: bb.upper,
    lastPrice: last,
    trendPhase,
    bollingerStatus,
    maAlignment,
    recommendation,
    confidence,
    rsiStatus: { value: rsi, timeframe: '4H', interpretation: rsi < 30 ? 'oversold' : rsi < 50 ? 'fair' : rsi < 70 ? 'neutral' : 'overbought' },
    supportConfluence: [],
    timestamp: new Date().toISOString(),
  });

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
    lastScanResults = [];
    lastRegime = null;
    
    // Pre-fill BTC price cache for regime detection
    try {
      const btcTicker = await fetchTicker('btc_idr');
      if (btcTicker) {
        const btcPrice = parseFloat(btcTicker.last);
        if (!priceCache['btc_idr']) priceCache['btc_idr'] = [];
        priceCache['btc_idr'].push(btcPrice);
        if (priceCache['btc_idr'].length > 250) priceCache['btc_idr'].shift();
        log(`[Regime] BTC cache pre-filled: ${priceCache['btc_idr'].length} data points`);
      }
    } catch (e) {
      log(`[Regime] Failed to pre-fill BTC cache: ${e.message}`);
    }

  try {
    const regime = detectRegime();
    lastRegime = regime;
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

async function fetchBTCHistory() {
  try {
    log('[Regime] Loading BTC historical data from cache...');
    
    // Load dari file cache yang sudah ada
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.join(__dirname, '..', 'cache', 'price-history.json');
    
    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const btcPrices = data['btc_idr'] || [];
      
      if (btcPrices.length >= 200) {
        priceCache['btc_idr'] = btcPrices;
        log(`[Regime] BTC history loaded from cache: ${btcPrices.length} data points`);
        log(`[Regime] BTC range: ${Math.min(...btcPrices).toLocaleString('id-ID')} - ${Math.max(...btcPrices).toLocaleString('id-ID')}`);
        return true;
      } else {
        log(`[Regime] BTC cache insufficient: ${btcPrices.length} points, need 200+`);
      }
    } else {
      log('[Regime] price-history.json not found, using API fallback');
    }
    
    // Fallback: fetch dari API kalau cache tidak ada
    const response = await fetch('https://indodax.com/api/trades/btcidr');
    const trades = await response.json();
    
    if (Array.isArray(trades) && trades.length > 0) {
      const prices = trades.slice(-250).map(t => parseFloat(t.price));
      priceCache['btc_idr'] = prices;
      log(`[Regime] BTC history loaded from API: ${prices.length} data points`);
      return true;
    }
  } catch (err) {
    log(`[Regime] Failed to load BTC history: ${err.message}`);
  }
  return false;
}

function startAutoScanner() {
  log('AutoScanner started (15 min interval)');
  
  fetchBTCHistory().then(() => {
    scanOnce();
    scannerTimer = setInterval(scanOnce, SCAN_INTERVAL_MS);
  });
}

function stopAutoScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
    log('AutoScanner stopped');
  }
}

module.exports = { startAutoScanner, stopAutoScanner, getScreeningData };

if (require.main === module) {
  startAutoScanner();
}
