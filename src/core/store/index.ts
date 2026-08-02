// ============================================================
// ABBI DeskLive — Zustand Stores (6 Stores)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Position,
  PortfolioStats,
  TradeHistory,
  CircuitBreakerStatus,
  SystemStatus,
  Notification,
  RotationPool,
  EntrySignal,
  ThemeMode,
} from '../types';

// ─── 1. System Store ──────────────────────────────────────

interface SystemState {
  status: SystemStatus;
  setRunning: (running: boolean) => void;
  setMode: (mode: 'mock' | 'live') => void;
  setLastScan: (time: string) => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      status: {
        isRunning: false,
        lastScan: null,
        nextScan: null,
        mode: 'mock',
        version: '5.1.0',
      },
      setRunning: (running) =>
        set((state) => ({
          status: { ...state.status, isRunning: running },
        })),
      setMode: (mode) =>
        set((state) => ({
          status: { ...state.status, mode },
        })),
      setLastScan: (time) =>
        set((state) => ({
          status: { ...state.status, lastScan: time, nextScan: new Date(Date.now() + 15 * 60000).toISOString() },
        })),
    }),
    { name: 'abbi-system-v2' }
  )
);

// ─── 2. Trading Store ─────────────────────────────────────

interface TradingState {
  positions: Position[];
  tradeHistory: TradeHistory[];
  entrySignals: EntrySignal[];
  addPosition: (position: Position) => void;
  updatePosition: (symbol: string, updates: Partial<Position>) => void;
  removePosition: (symbol: string) => void;
  addTrade: (trade: TradeHistory) => void;
  setEntrySignals: (signals: EntrySignal[]) => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set) => ({
      positions: [],
      tradeHistory: [],
      entrySignals: [],
      addPosition: (position) =>
        set((state) => ({
          positions: [...state.positions, position],
        })),
      updatePosition: (symbol, updates) =>
        set((state) => ({
          positions: state.positions.map((p) =>
            p.symbol === symbol ? { ...p, ...updates, lastUpdated: new Date().toISOString() } : p
          ),
        })),
      removePosition: (symbol) =>
        set((state) => ({
          positions: state.positions.filter((p) => p.symbol !== symbol),
        })),
      addTrade: (trade) =>
        set((state) => ({
          tradeHistory: [trade, ...state.tradeHistory].slice(0, 500),
        })),
      setEntrySignals: (signals) =>
        set(() => ({
          entrySignals: signals,
        })),
    }),
    { name: 'abbi-trading-v2' }
  )
);

// ─── 3. Settings Store ────────────────────────────────────

interface SettingsState {
  entryScoreMin: number;
  tp1Target: number;
  tp2Trailing: number;
  circuitBreakerDrawdown: number;
  circuitBreakerBtcDrop: number;
  cooldownHours: number;
  scanIntervalMinutes: number;
  autoRebalance: boolean;
  setSetting: <K extends keyof Omit<SettingsState, 'setSetting'>>(key: K, value: SettingsState[K]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      entryScoreMin: 70,
      tp1Target: 0.15,
      tp2Trailing: 0.08,
      circuitBreakerDrawdown: 0.12,
      circuitBreakerBtcDrop: 0.08,
      cooldownHours: 24,
      scanIntervalMinutes: 15,
      autoRebalance: true,
      setSetting: (key, value) => set(() => ({ [key]: value } as Partial<SettingsState>)),
    }),
    { name: 'abbi-settings' }
  )
);

// ─── 4. UI Store ──────────────────────────────────────────

interface UIState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  activeTimeframe: string;
  selectedCoin: string | null;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTimeframe: (tf: string) => void;
  setSelectedCoin: (coin: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: true,
      activeTimeframe: '1D',
      selectedCoin: null,
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
      setSidebarOpen: (open) => set(() => ({ sidebarOpen: open })),
      setActiveTimeframe: (tf) => set(() => ({ activeTimeframe: tf })),
      setSelectedCoin: (coin) => set(() => ({ selectedCoin: coin })),
    }),
    { name: 'abbi-ui' }
  )
);

// ─── 5. Notification Store ────────────────────────────────

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notif) =>
    set((state) => {
      const newNotif: Notification = {
        ...notif,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      return {
        notifications: [newNotif, ...state.notifications].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      };
    }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

// ─── 6. Circuit Breaker Store ─────────────────────────────

interface CircuitBreakerState {
  status: CircuitBreakerStatus;
  trigger: (reason: 'portfolio_drawdown' | 'btc_crash' | 'manual', drawdown: number) => void;
  reset: () => void;
  checkCooldown: () => boolean;
}

export const useCircuitBreakerStore = create<CircuitBreakerState>()(
  persist(
    (set, get) => ({
      status: {
        isActive: false,
        triggeredAt: null,
        triggeredBy: null,
        drawdownPercent: 0,
        cooldownUntil: null,
      },
      trigger: (reason, drawdown) => {
        const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        set(() => ({
          status: {
            isActive: true,
            triggeredAt: new Date().toISOString(),
            triggeredBy: reason,
            drawdownPercent: drawdown,
            cooldownUntil,
          },
        }));
      },
      reset: () =>
        set(() => ({
          status: {
            isActive: false,
            triggeredAt: null,
            triggeredBy: null,
            drawdownPercent: 0,
            cooldownUntil: null,
          },
        })),
      checkCooldown: () => {
        const { status } = get();
        if (!status.isActive || !status.cooldownUntil) return true;
        return new Date() >= new Date(status.cooldownUntil);
      },
    }),
    { name: 'abbi-circuit-breaker-v2' }
  )
);

// ─── 7. Rotation Pool Store (Tambahan) ────────────────────

interface RotationPoolState {
  pool: RotationPool;
  updateBalance: (amount: number) => void;
  updateTargetPercent: (percent: number) => void;
  setManualMode: (manual: boolean) => void;
  setNote: (note: string) => void;
}

export const useRotationPoolStore = create<RotationPoolState>()(
  persist(
    (set) => ({
      pool: {
        stablecoinBalance: 0,
        targetPercent: 20,
        currentPercent: 0,
        lastRebalanced: null,
        isManualMode: true,
        note: 'Rotation pool dikelola manual via aplikasi Indodax di HP. Pastikan cek saldo USDT/IDR secara berkala.',
      },
      updateBalance: (amount) =>
        set((state) => ({
          pool: { ...state.pool, stablecoinBalance: amount },
        })),
      updateTargetPercent: (percent) =>
        set((state) => ({
          pool: { ...state.pool, targetPercent: percent },
        })),
      updatePool: (updates: Partial<import("../types").RotationPool>) =>
        set((state) => ({
          pool: { ...state.pool, ...updates },
        })),
      setManualMode: (manual) =>
        set((state) => ({
          pool: { ...state.pool, isManualMode: manual },
        })),
      setNote: (note) =>
        set((state) => ({
          pool: { ...state.pool, note },
        })),
    }),
    { name: 'abbi-rotation-pool-v2' }
  )
);
