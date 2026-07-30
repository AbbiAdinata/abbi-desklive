// ============================================================
// ABBI DeskLive — Auto Trade Status (Auto-Only Mode)
// ============================================================

import { useNotificationStore } from '@core/store';

const IS_LIVE_MODE = import.meta.env.VITE_API_MODE === 'live';

export function AutoTradeToggle() {
  const { addNotification } = useNotificationStore();

  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '2px solid #ef4444',
      color: 'white',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
            🔴 AUTO-TRADE AKTIF
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8 }}>
            Bot akan eksekusi trade otomatis 24/7
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.6 }}>
            API Mode: {IS_LIVE_MODE ? '🔴 LIVE' : '🟢 MOCK'}
          </p>
        </div>
      </div>

      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px', 
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sisa Daily Limit:</span>
          <span style={{ fontWeight: 'bold' }}>
            Rp 5.000.000 / Rp 5.000.000
          </span>
        </div>
      </div>
    </div>
  );
}
