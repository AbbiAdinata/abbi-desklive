// ============================================================
// ABBI DeskLive — Portfolio Route (Backend Proxy)
// ============================================================
// PERUBAHAN: Ganti indodaxClient.getInfo() → backendClient.getInfo()
// Private API sekarang melalui backend proxy, bukan langsung ke Indodax.
// ✅ FIX: Better error logging & backend connectivity check
// ============================================================

import { useState, useEffect } from 'react';
import { Wallet, History, TrendingUp, Calendar, Filter, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTradingStore } from '@core/store';
import { backendClient } from '@core/api';                    // ✅ GANTI: backendClient
import { COIN_UNIVERSE, API_MODE } from '@core/constants';
import { formatIdr, formatPercent, getPnlColor, formatDateTime } from '@core/utils';

interface BalanceItem {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
}

export function PortfolioView() {
  const { positions, tradeHistory } = useTradingStore();
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'up' | 'down'>('unknown');

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    
    console.log(`[PortfolioView] API_MODE = ${API_MODE}`);
    
    // ✅ FIX: Cek backend health dulu sebelum fetch balance
    try {
      const health = await backendClient.healthCheck();
      console.log('[PortfolioView] Backend health:', health);
      setBackendStatus(health.status === 'ok' ? 'up' : 'down');
      
      if (health.status !== 'ok') {
        setError('Backend proxy tidak berjalan. Jalankan: cd backend && node server.js');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.error('[PortfolioView] Health check failed:', e);
      setBackendStatus('down');
      setError('Tidak bisa terhubung ke backend. Pastikan backend berjalan di port 3002.');
      setLoading(false);
      return;
    }
    
    try {
      console.log('[PortfolioView] Fetching balance from backend...');
      
      // ✅ FIX: Ganti indodaxClient.getInfo() → backendClient.getInfo()
      const info = await backendClient.getInfo();
      
      console.log('[PortfolioView] Info result:', info);
      
      // ✅ FIX: BackendClient.getInfo() return { success, idr, coins, error }
      setIsRealData(info.success && info.idr > 0);
      
      if (!info.success) {
        setError(info.error || 'Gagal mengambil data dari backend');
        setLoading(false);
        return;
      }
      
      // ✅ FIX: Backend return coins sebagai Record<string, number>
      const balanceData: Record<string, number> = info.coins || {};
      console.log('[PortfolioView] Balance data:', balanceData);
      
      // 2. Build balance items with prices
      const balanceItems: BalanceItem[] = [];
      
      for (const [symbol, amount] of Object.entries(balanceData)) {
        const coin = COIN_UNIVERSE.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
        const balanceNum = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;
        
        if (balanceNum > 0 || symbol.toLowerCase() === 'idr') {
          let price = 0;
          let value = 0;
          
          if (symbol.toLowerCase() === 'idr') {
            value = balanceNum;
          } else {
            try {
              // Public API tetap pakai indodaxClient (ticker)
              const { indodaxClient } = await import('@core/engine/IndodaxClient');
              const ticker = await indodaxClient.fetchTicker(symbol.toUpperCase());
              price = ticker?.price || 0;
              value = balanceNum * price;
              console.log(`[PortfolioView] ${symbol}: ${balanceNum} × ${formatIdr(price)} = ${formatIdr(value)}`);
            } catch (e) {
              console.warn(`[PortfolioView] Price fetch failed for ${symbol}:`, e);
            }
          }
          
          balanceItems.push({
            symbol: symbol.toUpperCase(),
            name: coin?.name || symbol.toUpperCase(),
            balance: balanceNum,
            price,
            value,
          });
        }
      }
      
      setBalances(balanceItems.sort((a, b) => b.value - a.value));
      setLastUpdated(new Date().toLocaleTimeString());
      console.log('[PortfolioView] Loaded balances:', balanceItems);
      
    } catch (err: any) {
      console.error('[PortfolioView] Error:', err);
      setError(err.message || 'Unknown error');
      setIsRealData(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredTrades = tradeHistory.filter((t) => {
    if (filter === 'buy') return t.type === 'BUY';
    if (filter === 'sell') return t.type === 'SELL_TP1' || t.type === 'SELL_TP2';
    return true;
  });

  const totalValue = balances.reduce((sum, b) => sum + b.value, 0);
  const idrBalance = balances.find(b => b.symbol === 'IDR')?.value || 0;
  const cryptoValue = totalValue - idrBalance;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-abbi-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-slate-400">Posisi & History Profit</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
          isRealData 
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        }`}>
          {isRealData ? 'LIVE — Real Data' : 'SIMULASI — Mock Data'}
        </span>
        {/* ✅ FIX: Show backend status */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
          backendStatus === 'up'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : backendStatus === 'down'
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
        }`}>
          Backend: {backendStatus === 'unknown' ? 'Checking...' : backendStatus.toUpperCase()}
        </span>
        <button 
          onClick={fetchPortfolio}
          disabled={loading}
          className="ml-auto p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="abbi-card p-5">
          <p className="text-sm text-slate-400 mb-1">Total Portfolio</p>
          <p className="text-2xl font-bold text-white">{formatIdr(totalValue)}</p>
          {lastUpdated && <p className="text-xs text-slate-600 mt-1">Updated: {lastUpdated}</p>}
        </div>
        <div className="abbi-card p-5">
          <p className="text-sm text-slate-400 mb-1">Crypto Value</p>
          <p className="text-2xl font-bold text-emerald-400">{formatIdr(cryptoValue)}</p>
        </div>
        <div className="abbi-card p-5">
          <p className="text-sm text-slate-400 mb-1">IDR Balance</p>
          <p className="text-2xl font-bold text-abbi-400">{formatIdr(idrBalance)}</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Gagal mengambil data dari Indodax</p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
              {backendStatus === 'down' ? (
                <div className="mt-2 p-2 rounded bg-slate-800/50 text-xs text-slate-300">
                  <p className="font-medium text-amber-400 mb-1">Backend belum berjalan:</p>
                  <p>Jalankan backend server terlebih dahulu:</p>
                  <code className="block mt-1 bg-slate-900 p-1 rounded text-emerald-400">
                    cd backend<br/>
                    node server.js
                  </code>
                </div>
              ) : (
                <div className="mt-2 p-2 rounded bg-slate-800/50 text-xs text-slate-300">
                  <p className="font-medium text-amber-400 mb-1">Cek console (F12) untuk detail error.</p>
                  <p>Pastikan .env frontend: VITE_API_MODE=live</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Positions */}
      <div className="abbi-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Active Positions</h2>
          {loading && <Loader2 className="w-4 h-4 text-abbi-400 animate-spin" />}
        </div>

        {balances.filter(b => b.symbol !== 'IDR').length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Belum ada posisi aktif</p>
            {!isRealData && !error && (
              <p className="text-xs text-slate-600 mt-1">Mode simulasi aktif — data bukan dari akun Indodax</p>
            )}
            {isRealData && (
              <p className="text-xs text-slate-600 mt-1">Akun Indodax tidak memiliki aset crypto</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs text-slate-400 py-2">Coin</th>
                  <th className="text-right text-xs text-slate-400 py-2">Balance</th>
                  <th className="text-right text-xs text-slate-400 py-2">Price (IDR)</th>
                  <th className="text-right text-xs text-slate-400 py-2">Value (IDR)</th>
                </tr>
              </thead>
              <tbody>
                {balances.filter(b => b.symbol !== 'IDR').map((item) => (
                  <tr key={item.symbol} className="border-b border-slate-700/20">
                    <td className="py-3">
                      <div className="font-bold text-white">{item.symbol}</div>
                      <div className="text-xs text-slate-500">{item.name}</div>
                    </td>
                    <td className="py-3 text-right text-slate-300">{item.balance.toFixed(6)}</td>
                    <td className="py-3 text-right text-slate-300">{formatIdr(item.price)}</td>
                    <td className="py-3 text-right font-medium text-emerald-400">{formatIdr(item.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="abbi-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-bold text-white">Trade History</h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="all">All</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Belum ada history trade</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs text-slate-400 py-2">Date</th>
                  <th className="text-left text-xs text-slate-400 py-2">Type</th>
                  <th className="text-left text-xs text-slate-400 py-2">Coin</th>
                  <th className="text-right text-xs text-slate-400 py-2">Price</th>
                  <th className="text-right text-xs text-slate-400 py-2">Qty</th>
                  <th className="text-right text-xs text-slate-400 py-2">Total</th>
                  <th className="text-right text-xs text-slate-400 py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-700/20 hover:bg-slate-700/10">
                    <td className="py-2.5 text-xs text-slate-400">{formatDateTime(trade.timestamp)}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        trade.type === 'BUY' ? 'bg-abbi-500/20 text-abbi-400' :
                        trade.type === 'SELL_TP1' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2.5 font-medium text-white">{trade.symbol}</td>
                    <td className="py-2.5 text-right text-slate-300">${trade.price.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-slate-300">{trade.quantity.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-slate-300">{formatIdr(trade.total)}</td>
                    <td className={`py-2.5 text-right font-medium ${trade.pnl ? getPnlColor(trade.pnlPercent || 0) : 'text-slate-500'}`}>
                      {trade.pnl ? formatPercent(trade.pnlPercent || 0) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}