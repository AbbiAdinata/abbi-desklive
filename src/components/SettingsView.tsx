// ============================================================
// ABBI DeskLive — Settings Route (SEC FIXED)
// ============================================================
// CHANGE: INDODAX_API_SECRET dihapus dari frontend.
// Secret hanya di backend/.env. Frontend cuma tahu "connected / not connected".
// ============================================================

import { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, Key, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useSettingsStore, useSystemStore, useCircuitBreakerStore } from '@core/store';
import { API_MODE, INDODAX_API_KEY } from '@core/constants';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';

export function SettingsView() {
  const settings = useSettingsStore();
  const { status, setMode } = useSystemStore();
  const { status: cbStatus, reset: resetCB } = useCircuitBreakerStore();
  const [saved, setSaved] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  // Cek backend status (termasuk apakah API key terisi di backend .env)
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setBackendConnected(!!data?.hasApiKey))
      .catch(() => setBackendConnected(false));
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isLive = API_MODE === 'live';
  const hasApiKey = !!INDODAX_API_KEY || backendConnected;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-abbi-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400">Konfigurasi ABBI DeskLive</p>
        </div>
      </div>

      <div className="abbi-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">API Configuration</h2>
        </div>

        <div className={`p-4 rounded-lg border mb-4 ${
          isLive 
            ? 'bg-emerald-500/10 border-emerald-500/20' 
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-start gap-2">
            {isLive ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'Mode LIVE Aktif' : 'Mode Mock Aktif'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isLive 
                  ? 'Terhubung ke API Indodax. Trade akan dieksekusi ke exchange.'
                  : 'Saat ini menggunakan data simulasi. Untuk beralih ke live trading, isi API key Indodax Anda di backend/.env'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">API Key (Frontend)</label>
            <input
              type="text"
              value={INDODAX_API_KEY || '— belum diisi —'}
              readOnly
              className="w-full bg-slate-700/30 border border-slate-600 rounded-lg px-4 py-2 text-slate-500 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Public key untuk read-only data. Secret key disimpan di backend/.env
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">API Secret</label>
            <input
              type="text"
              value={backendConnected ? '•••••••••••• (di backend)' : '— belum diisi —'}
              readOnly
              className="w-full bg-slate-700/30 border border-slate-600 rounded-lg px-4 py-2 text-slate-500 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Secret key hanya tersimpan di server backend, tidak di frontend.
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Mode</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode('mock')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  status.mode === 'mock'
                    ? 'bg-abbi-500/20 text-abbi-400 border border-abbi-500/30'
                    : 'bg-slate-700/30 text-slate-400 border border-slate-700/30'
                }`}
              >
                Mock (Simulasi)
              </button>
              <button
                onClick={() => setMode('live')}
                disabled={!hasApiKey}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  status.mode === 'live'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700/30 text-slate-400 border border-slate-700/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Live (Real API)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="abbi-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Strategy Parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'entryScoreMin', label: 'Entry Score Minimum', value: settings.entryScoreMin, suffix: '' },
            { key: 'tp1Target', label: 'TP1 Target', value: settings.tp1Target, suffix: '%', multiplier: 100 },
            { key: 'tp2Trailing', label: 'TP2 Trailing', value: settings.tp2Trailing, suffix: '%', multiplier: 100 },
            { key: 'circuitBreakerDrawdown', label: 'CB Drawdown', value: settings.circuitBreakerDrawdown, suffix: '%', multiplier: 100 },
            { key: 'circuitBreakerBtcDrop', label: 'CB BTC Drop', value: settings.circuitBreakerBtcDrop, suffix: '%', multiplier: 100 },
            { key: 'cooldownHours', label: 'Cooldown Hours', value: settings.cooldownHours, suffix: 'h' },
          ].map((param) => (
            <div key={param.key}>
              <label className="block text-sm text-slate-400 mb-1">{param.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={param.multiplier ? (param.value as number) * param.multiplier : param.value}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    settings.setSetting(param.key as any, param.multiplier ? val / param.multiplier : val);
                  }}
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-abbi-500"
                />
                <span className="text-sm text-slate-500 w-8">{param.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="abbi-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Circuit Breaker</h2>
          {cbStatus.isActive && (
            <button
              onClick={resetCB}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reset CB
            </button>
          )}
        </div>

        <div className={`p-4 rounded-lg border ${
          cbStatus.isActive
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${cbStatus.isActive ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className={`font-medium ${cbStatus.isActive ? 'text-red-400' : 'text-emerald-400'}`}>
              {cbStatus.isActive ? 'CIRCUIT BREAKER AKTIF' : 'Circuit Breaker Normal'}
            </span>
          </div>
          {cbStatus.isActive && (
            <div className="mt-2 text-sm text-slate-400 space-y-1">
              <p>Triggered: {cbStatus.triggeredBy}</p>
              <p>Drawdown: {(cbStatus.drawdownPercent * 100).toFixed(2)}%</p>
              <p>Cooldown until: {cbStatus.cooldownUntil ? new Date(cbStatus.cooldownUntil).toLocaleString('id-ID') : '—'}</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-abbi-600 to-abbi-500 text-white font-bold hover:from-abbi-500 hover:to-abbi-400 transition-all flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Tersimpan!' : 'Simpan Pengaturan'}
      </button>
    </div>
  );
}