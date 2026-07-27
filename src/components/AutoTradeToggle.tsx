// ============================================================
// ABBI DeskLive — Auto Trade Toggle (Baca .env)
// ============================================================

import { useState } from 'react';
import { useNotificationStore } from '@core/store';

// Baca dari .env
const IS_AUTO_TRADE = import.meta.env.VITE_AUTO_TRADE === 'true';
const IS_LIVE_MODE = import.meta.env.VITE_API_MODE === 'live';

export function AutoTradeToggle() {
  const [isAuto, setIsAuto] = useState(IS_AUTO_TRADE);
  const { addNotification } = useNotificationStore();

  const toggleAuto = () => {
    const newState = !isAuto;
    setIsAuto(newState);
    
    if (newState) {
      // ✅ FIX: Gunakan notification store, bukan alert()
      addNotification({
        type: 'warning',
        title: '⚠️ AUTO-TRADE AKTIF',
        message: 'Bot akan beli/jual otomatis. Monitor dengan cermat!',
      });
    } else {
      addNotification({
        type: 'info',
        title: 'Auto-Trade Dimatikan',
        message: 'Mode manual aktif. Anda mengendalikan semua trade.',
      });
    }
  };

  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      background: isAuto ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
      border: `2px solid ${isAuto ? '#ef4444' : '#10b981'}`,
      color: 'white',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
            {isAuto ? '🔴 AUTO-TRADE AKTIF' : '🟢 MODE MANUAL'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8 }}>
            {isAuto 
              ? 'Bot akan eksekusi trade otomatis' 
              : 'Kamu yang eksekusi trade manual'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.6 }}>
            API Mode: {IS_LIVE_MODE ? '🔴 LIVE' : '🟢 MOCK'}
          </p>
        </div>
        
        <button
          onClick={toggleAuto}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: isAuto ? '#ef4444' : '#10b981',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {isAuto ? 'MATIKAN' : 'AKTIFKAN'}
        </button>
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