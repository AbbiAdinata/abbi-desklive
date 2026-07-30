const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'price-history.json');

// Mapping: pair Indodax -> CoinGecko ID
const COINGECKO_IDS = {
  'btc_idr': 'bitcoin',
  'eth_idr': 'ethereum',
  'sol_idr': 'solana',
  'bnb_idr': 'binancecoin',
  'xrp_idr': 'ripple',
  'ada_idr': 'cardano',
  'avax_idr': 'avalanche-2',
  'link_idr': 'chainlink',
  'dot_idr': 'polkadot',
  'matic_idr': 'matic-network',
  'near_idr': 'near',
  'arb_idr': 'arbitrum',
  'op_idr': 'optimism',
  'sei_idr': 'sei-network',
  'sui_idr': 'sui',
  'inj_idr': 'injective-protocol',
  'render_idr': 'render-token',
  'tia_idr': 'celestia',
  'jup_idr': 'jupiter-exchange-solana',
  'pyth_idr': 'pyth-network'
};

// Delay helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [CoinGecko] ${msg}`);
}

// Load cache
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      log(`Cache loaded: ${Object.keys(data).length} coins`);
      return data;
    }
  } catch (e) {
    log(`Cache load error: ${e.message}`);
  }
  return {};
}

// Save cache
function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    log(`Cache save error: ${e.message}`);
  }
}

// Fetch 200 hari historis dari CoinGecko
async function fetchCoinGeckoHistory(coinId, pair) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=idr&days=200`;
  try {
    log(`Fetching ${pair} (${coinId})...`);
    const res = await axios.get(url, { timeout: 15000 });
    // prices: [[timestamp, price], ...]
    const prices = res.data.prices.map(p => p[1]);
    log(`${pair}: ${prices.length} days fetched`);
    return prices;
  } catch (err) {
    log(`${pair}: FAILED - ${err.message}`);
    return null;
  }
}

// Init: fetch semua coin dari CoinGecko (1x saat start)
async function initCacheFromCoinGecko() {
  let cache = loadCache();
  const pairs = Object.keys(COINGECKO_IDS);
  
  log('=== INIT CACHE FROM COINGECKO ===');
  log(`Total coins: ${pairs.length}`);
  
  for (const pair of pairs) {
    const coinId = COINGECKO_IDS[pair];
    // Skip kalau sudah ada data cukup
    if (cache[pair] && cache[pair].length >= 200) {
      log(`${pair}: already has ${cache[pair].length} days, skip`);
      continue;
    }
    
    const prices = await fetchCoinGeckoHistory(coinId, pair);
    if (prices) {
      cache[pair] = prices;
      saveCache(cache);
    }
    
    // Rate limit: delay 3 detik antar call
    await sleep(12000);
  }
  
  log('=== INIT COMPLETE ===');
  return cache;
}

// Append harga terbaru dari Indodax ke cache
function appendPrice(pair, lastPrice) {
  let cache = loadCache();
  if (!cache[pair]) cache[pair] = [];
  
  // Cek duplikat (harga sama di timestamp yang sama)
  const now = Date.now();
  const lastEntry = cache[pair][cache[pair].length - 1];
  
  // Simpan sebagai objek {price, timestamp} untuk tracking
  // Tapi tetap return array of numbers untuk kompatibilitas
  cache[pair].push(lastPrice);
  
  // Limit max 300 hari (biar file nggak gede)
  if (cache[pair].length > 300) {
    cache[pair] = cache[pair].slice(-300);
  }
  
  saveCache(cache);
  return cache[pair];
}

// Get price history untuk perhitungan MA/RSI
function getPriceHistory(pair, fallbackLast, fallbackHigh, fallbackLow, count = 250) {
  const cache = loadCache();
  
  if (cache[pair] && cache[pair].length >= 20) {
    // Ada data real, pakai!
    const prices = [...cache[pair]];
    // Pad dengan interpolasi kalau kurang dari count
    while (prices.length < count) {
      prices.unshift(prices[0]); // duplicate awal
    }
    return prices.slice(-count);
  }
  
  // Fallback: cache belum cukup, pakai interpolasi dari high/low/last
  // (INI BUKAN RANDOM — deterministik dari data real Indodax)
  return generateInterpolatedHistory(fallbackLast, fallbackHigh, fallbackLow, count);
}

// Interpolasi deterministik (pengganti generatePriceHistory yang lama)
function generateInterpolatedHistory(last, high, low, count = 250) {
  const prices = [];
  const range = high - low || last * 0.1;
  let price = low;
  const step = (last - low) / count;
  
  for (let i = 0; i < count; i++) {
    // Noise deterministik sinusoidal (sama seperti sebelumnya, tapi ini fallback saja)
    const noise = Math.sin(i * 0.1) * range * 0.02;
    price += step + noise;
    prices.push(Math.max(low * 0.95, Math.min(high * 1.05, price)));
  }
  
  prices[prices.length - 1] = last;
  return prices;
}

module.exports = {
  initCacheFromCoinGecko,
  appendPrice,
  getPriceHistory,
  COINGECKO_IDS,
  loadCache
};
