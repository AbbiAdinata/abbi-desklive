// ============================================================
// ABBI DeskLive — App Layout (Sidebar + Header)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from '@tanstack/react-router';
import {
  LayoutDashboard, TrendingUp, Wallet, BarChart3, Settings,
  Bell, Menu, X, Moon, Sun, Shield, Zap, CircleDollarSign,
} from 'lucide-react';
import { useUIStore, useNotificationStore, useSystemStore, useCircuitBreakerStore } from '@core/store';
import { useTheme } from '@theme/ThemeProvider';
import { APP_NAME, API_MODE } from '@core/constants';
import { timeAgo } from '@core/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/market', label: 'Market', icon: TrendingUp },
  { path: '/portfolio', label: 'Portfolio', icon: Wallet },
  { path: '/trading', label: 'Trading', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

// Notification Dropdown Component
function NotificationDropdown({ 
  isOpen, 
  onClose, 
  notifications, 
  unreadCount, 
  markAllRead 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  notifications: any[]; 
  unreadCount: number; 
  markAllRead: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-surface-elevated border border-slate-600 rounded-xl shadow-2xl z-[99999] max-h-[32rem] overflow-y-auto"
      style={{ 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between sticky top-0 bg-surface-elevated z-10">
        <span className="text-sm font-medium text-white">Notifikasi</span>
        <button 
          onClick={(e) => { e.stopPropagation(); markAllRead(); }} 
          className="text-xs text-abbi-400 hover:text-abbi-300 transition-colors"
        >
          Tandai dibaca
        </button>
      </div>
      {notifications.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-sm">Tidak ada notifikasi</div>
      ) : (
        notifications.slice(0, 20).map((n) => (
          <div key={n.id} className={`p-3 border-b border-slate-700/30 ${!n.read ? 'bg-abbi-500/5' : ''}`}>
            <div className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                n.type === 'success' ? 'bg-emerald-400' :
                n.type === 'warning' ? 'bg-amber-400' :
                n.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
              }`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-slate-500 mt-1">{timeAgo(n.timestamp)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>,
    document.body
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const { status, setMode } = useSystemStore();
  const { status: cbStatus } = useCircuitBreakerStore();

  // FIX: Sync system store mode dengan API_MODE dari constants
  useEffect(() => {
    console.log('[AppLayout] Syncing mode. API_MODE =', API_MODE, '| Store mode =', status.mode);
    if (status.mode !== API_MODE) {
      setMode(API_MODE);
      console.log('[AppLayout] Mode synced to:', API_MODE);
    }
  }, [status.mode, setMode]);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-surface-elevated border-r border-slate-700/50 flex flex-col shrink-0`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-abbi-500 to-abbi-700 flex items-center justify-center shadow-lg shadow-abbi-500/20 shrink-0">
            <span className="text-white font-bold text-lg tracking-tight">A</span>
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">{APP_NAME.split(' ')[0]}</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{APP_NAME.split(' ')[1]}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-abbi-500/15 text-abbi-400 border border-abbi-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-abbi-400' : 'group-hover:text-slate-200'}`} />
                {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Status Footer */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${status.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {sidebarOpen && (
              <span className="text-xs text-slate-400">
                {status.isRunning ? 'ABBI Aktif' : 'Standby'}
              </span>
            )}
          </div>
          {cbStatus.isActive && (
            <div className="flex items-center gap-2 text-red-400">
              <Shield className="w-3 h-3" />
              {sidebarOpen && <span className="text-xs font-medium">Circuit Breaker ON</span>}
            </div>
          )}
          {sidebarOpen && status.lastScan && (
            <p className="text-[10px] text-slate-500 mt-1">Scan: {timeAgo(status.lastScan)}</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 bg-surface-elevated/50 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 shrink-0 relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-abbi-400" />
              {/* FIX: Pakai API_MODE langsung, bukan status.mode */}
              <span className="text-sm text-slate-400">Mode: <span className={`font-medium ${API_MODE === 'live' ? 'text-emerald-400' : 'text-abbi-400'}`}>{API_MODE.toUpperCase()}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (!notifOpen) markAllRead();
                }}
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* ABBI Brand */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-abbi-500/20 to-accent/20 border border-abbi-500/30">
              <CircleDollarSign className="w-4 h-4 text-abbi-400" />
              <span className="text-sm font-semibold text-abbi-400">ABBI</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Notification Portal */}
      <NotificationDropdown
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        markAllRead={markAllRead}
      />
    </div>
  );
}