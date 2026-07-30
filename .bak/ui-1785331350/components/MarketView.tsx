// ============================================================
// ABBI DeskLive — Market Route (TradingView Widget)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { CandlestickChart, Layers, TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { useUIStore } from '@core/store';
import { indodaxWS, type ChartTick, type OrderBookEntry } from '@core/engine/IndodaxWebSocket';
import { indodaxClient } from '@core/engine/IndodaxClient';
import { COIN_UNIVERSE, CHART_TIMEFRAMES } from '@core/constants';

// Mapping coin ke symbol TradingView
const TV_SYMBOLS: Record<string, string> = {
  'BTC': 'INDODAX:BTCIDR',
  'ETH': 'INDODAX:ETHIDR',
  'SOL': 'INDODAX:SOLIDR',
  'XRP': 'INDODAX:XRPIDR',
  'DOGE': 'INDODAX:DOGEIDR',
  'ADA': 'INDODAX:ADAIDR',
  'DOT': 'INDODAX:DOTIDR',
  'LTC': 'INDODAX:LTCIDR',
  'BNB': 'BINANCE:BNBIDR', // Kalau tidak ada di Indodax
};

export function MarketView() {
  const { activeTimeframe, setActiveTimeframe, selectedCoin, setSelectedCoin } = useUIStore();
  
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[], asks: OrderBookEntry[] }>({ bids: [], asks: [] });
  const [wsError, setWsError] = useState<string | null>(null);
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const tvWidgetRef = useRef<any>(null);

  // ─── Load Price Data ──────────────────────────────────
  useEffect(() => {
    const loadTicker = async () => {
      if (!selectedCoin) return;
      const ticker = await indodaxClient.fetchTicker(selectedCoin);
      if (ticker) {
        setCurrentPrice(ticker.price);
        setPriceChange24h(ticker.change24h);
        setHigh24h(ticker.high24h);
        setLow24h(ticker.low24h);
        setVolume24h(ticker.volume24h);
      }
    };
    loadTicker();
    const interval = setInterval(loadTicker, 10000);
    return () => clearInterval(interval);
  }, [selectedCoin]);

  // ─── TradingView Widget ─────────────────────────────────
  useEffect(() => {
    if (!selectedCoin || !widgetRef.current) return;
    
    const symbol = TV_SYMBOLS[selectedCoin] || `INDODAX:${selectedCoin}IDR`;
    
    // ✅ FIX: Cleanup widget dan script sebelumnya
    const cleanup = () => {
      if (tvWidgetRef.current) {
        try {
          tvWidgetRef.current.remove();
        } catch (e) {
          // Widget mungkin sudah di-remove
        }
        tvWidgetRef.current = null;
      }
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
      if (widgetRef.current) {
        widgetRef.current.innerHTML = '';
      }
    };

    cleanup();
    
    // Buat script TradingView
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    scriptRef.current = script;
    
    script.onload = () => {
      if ((window as any).TradingView && widgetRef.current) {
        tvWidgetRef.current = new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: getTVInterval(activeTimeframe),
          timezone: 'Asia/Jakarta',
          theme: 'dark',
          style: '1', // Candlestick
          locale: 'id',
          toolbar_bg: '#0f172a',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: 'tradingview-widget',
          hide_side_toolbar: false,
          allow_symbol_change: false,
          details: true,
          hotlist: false,
          calendar: false,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
          ],
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
        });
      }
    };
    
    widgetRef.current.appendChild(script);
    
    // ✅ FIX: Cleanup saat unmount atau dependency change
    return cleanup;
  }, [selectedCoin, activeTimeframe]);

  // Mapping timeframe ke TradingView
  function getTVInterval(tf: string): string {
    const map: Record<string, string> = {
      '1M': 'M',
      '1W': 'W',
      '1D': 'D',
      '4H': '240',
      '1H': '60',
      '15M': '15',
    };
    return map[tf] || 'D';
  }

  // ─── WebSocket Orderbook ────────────────────────────────
  useEffect(() => {
    if (!selectedCoin) {
      setSelectedCoin('BTC');
      return;
    }
    const pair = `${selectedCoin.toLowerCase()}idr`;

    indodaxWS.onConnected = () => {
      setIsConnected(true);
      setWsError(null);
      indodaxWS.subscribeOrderBook(pair);
    };

    indodaxWS.onOrderBook = (bids, asks) => {
      setOrderBook({ bids, asks });
    };

    indodaxWS.onError = (error) => {
      setWsError(error);
      setIsConnected(false);
    };

    indodaxWS.onDisconnected = () => {
      setIsConnected(false);
    };

    indodaxWS.connect();
    return () => { indodaxWS.disconnect(); };
  }, [selectedCoin]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CandlestickChart className="w-6 h-6 text-abbi-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Market Chart</h1>
            <p className="text-sm text-slate-400 flex items-center gap-2">
              {isConnected ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Wifi className="w-4 h-4" /> ● Live
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <WifiOff className="w-4 h-4" /> ● REST Mode
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-400">{selectedCoin} / IDR</p>
            <p className="text-3xl font-bold text-white">
              Rp {currentPrice > 0 ? currentPrice.toLocaleString('id-ID') : '—'}
            </p>
            <div className="flex items-center justify-end gap-3 mt-1">
              <span className={`text-sm font-bold ${priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(priceChange24h).toFixed(2)}%
              </span>
              <span className="text-xs text-slate-500">24h</span>
            </div>
          </div>
          
          <div className="hidden md:flex gap-4 text-right">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">High</p>
              <p className="text-sm font-mono text-slate-300">Rp {high24h.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Low</p>
              <p className="text-sm font-mono text-slate-300">Rp {low24h.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Vol 24h</p>
              <p className="text-sm font-mono text-slate-300">Rp {(volume24h/1e9).toFixed(2)}B</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCoin || 'BTC'}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-abbi-500"
            >
              {COIN_UNIVERSE.map((c) => (
                <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {wsError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
          <p className="text-sm text-red-400">{wsError}</p>
          <button 
            onClick={() => {
              setWsError(null);
              indodaxWS.disconnect();
              setTimeout(() => indodaxWS.connect(), 500);
            }}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm"
          >
            🔄 Reconnect
          </button>
        </div>
      )}

      {/* Timeframe */}
      <div className="flex items-center gap-2">
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setActiveTimeframe(tf.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTimeframe === tf.value
                ? 'bg-abbi-500/20 text-abbi-400 border border-abbi-500/30'
                : 'bg-slate-700/30 text-slate-400 border border-slate-700/30 hover:bg-slate-700/50'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* TradingView Chart */}
      <div className="abbi-card p-1 overflow-hidden">
        <div 
          id="tradingview-widget" 
          ref={widgetRef} 
          className="w-full h-[500px] bg-slate-900"
        />
      </div>

      {/* Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="abbi-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-emerald-400">Bids</h3>
            <span className="text-xs text-slate-500 ml-auto">Buy Orders</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-1">
              <span className="w-1/3">Price (IDR)</span>
              <span className="w-1/3 text-center">BTC Amount</span>
              <span className="w-1/3 text-right">Total (IDR)</span>
            </div>
            {orderBook.bids.slice(0, 15).map((bid, i) => (
              <div key={i} className="flex justify-between text-sm py-1 px-1 rounded hover:bg-emerald-500/5">
                <span className="text-emerald-400 font-mono w-1/3">Rp {bid.price.toLocaleString('id-ID')}</span>
                <span className="text-slate-300 font-mono w-1/3 text-center">{bid.volume.toFixed(6)}</span>
                <span className="text-slate-400 font-mono w-1/3 text-right">Rp {(bid.price * bid.volume).toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
              </div>
            ))}
            {orderBook.bids.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Loading...</p>}
          </div>
        </div>

        <div className="abbi-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-bold text-red-400">Asks</h3>
            <span className="text-xs text-slate-500 ml-auto">Sell Orders</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 mb-2 px-1">
              <span className="w-1/3">Price (IDR)</span>
              <span className="w-1/3 text-center">BTC Amount</span>
              <span className="w-1/3 text-right">Total (IDR)</span>
            </div>
            {orderBook.asks.slice(0, 15).map((ask, i) => (
              <div key={i} className="flex justify-between text-sm py-1 px-1 rounded hover:bg-red-500/5">
                <span className="text-red-400 font-mono w-1/3">Rp {ask.price.toLocaleString('id-ID')}</span>
                <span className="text-slate-300 font-mono w-1/3 text-center">{ask.volume.toFixed(6)}</span>
                <span className="text-slate-400 font-mono w-1/3 text-right">Rp {(ask.price * ask.volume).toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
              </div>
            ))}
            {orderBook.asks.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Loading...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}