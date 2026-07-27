import { useState, useEffect, useCallback, useRef } from 'react';
import indodaxWS from '../services/indodaxWebSocket';

export function useIndodaxWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [ticker, setTicker] = useState(null);
  const [depth, setDepth] = useState({ bids: [], asks: [] });
  const [kline, setKline] = useState([]);
  const [error, setError] = useState(null);
  const [rawMessages, setRawMessages] = useState([]);
  
  const currentPair = useRef('btc_idr');

  const connect = useCallback((pair = 'btc_idr') => {
    currentPair.current = pair;
    
    indodaxWS.setCallbacks({
      onConnect: () => {
        setIsConnected(true);
        setError(null);
        
        // Subscribe ke semua channel yang diperlukan
        indodaxWS.subscribe(`ticker.${pair}`);
        indodaxWS.subscribe(`depth.${pair}`);
        indodaxWS.subscribe(`kline.${pair}.4h`);
      },
      
      onDisconnect: () => {
        setIsConnected(false);
      },
      
      onTicker: (data) => {
        setTicker({
          last: parseFloat(data.last),
          buy: parseFloat(data.buy),
          sell: parseFloat(data.sell),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          vol: parseFloat(data.vol_btc || data.vol),
          change24h: parseFloat(data.change_24h || 0),
          pair: data.pair
        });
      },
      
      onDepth: (data) => {
        setDepth({
          bids: (data.bids || []).map(([price, vol]) => ({
            price: parseFloat(price),
            volume: parseFloat(vol)
          })),
          asks: (data.asks || []).map(([price, vol]) => ({
            price: parseFloat(price),
            volume: parseFloat(vol)
          }))
        });
      },
      
      onKline: (data) => {
        if (Array.isArray(data)) {
          setKline(data.map(candle => ({
            time: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
          })));
        }
      },
      
      onError: (err) => {
        setError(typeof err === 'string' ? err : 'Terjadi kesalahan koneksi');
        setIsConnected(false);
      },
      
      onRawMessage: (msg) => {
        setRawMessages(prev => [...prev.slice(-50), msg]); // Simpan 50 message terakhir
      }
    });
    
    indodaxWS.connect();
  }, []);

  const disconnect = useCallback(() => {
    indodaxWS.disconnect();
    setIsConnected(false);
  }, []);

  const changePair = useCallback((newPair) => {
    const oldPair = currentPair.current;
    
    // Unsubscribe pair lama
    indodaxWS.unsubscribe(`ticker.${oldPair}`);
    indodaxWS.unsubscribe(`depth.${oldPair}`);
    indodaxWS.unsubscribe(`kline.${oldPair}.4h`);
    
    // Reset state
    setTicker(null);
    setDepth({ bids: [], asks: [] });
    setKline([]);
    
    // Subscribe pair baru
    currentPair.current = newPair;
    indodaxWS.subscribe(`ticker.${newPair}`);
    indodaxWS.subscribe(`depth.${newPair}`);
    indodaxWS.subscribe(`kline.${newPair}.4h`);
  }, []);

  useEffect(() => {
    return () => {
      indodaxWS.disconnect();
    };
  }, []);

  return {
    isConnected,
    ticker,
    depth,
    kline,
    error,
    rawMessages,
    connect,
    disconnect,
    changePair,
    status: indodaxWS.getStatus()
  };
}