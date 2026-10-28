import { useEffect, useRef, useState, useCallback } from 'react';
import { OHLCV } from '../types/chart';
import { ConnectionStatus, WebSocketMessage } from '../types/websocket';

export interface WatchlistItemData {
  price: number;
  change: number;
  changePercentage: number;
}

export const useWatchlistItem = (symbol: string, apiBaseUrl: string) => {
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [data, setData] = useState<WatchlistItemData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<ConnectionStatus>('CONNECTING');
  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const firstCandleRef = useRef<OHLCV | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const fetchHistoricalData = useCallback(async (): Promise<OHLCV[]> => {
    // Using '1d' resolution for 24h change as requested
    const response = await fetch(`${apiBaseUrl}/api/history/${symbol}?resolution=1d`);
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`);
    }
    return await response.json();
  }, [apiBaseUrl, symbol]);

  const calculateChange = (currentPrice: number, firstCandle: OHLCV) => {
    const change = currentPrice - firstCandle.open;
    const changePercentage = (change / firstCandle.open) * 100;
    return { change, changePercentage };
  };

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    updateStatus('CONNECTING');
    // Derive the WS URL from the base URL's origin (mirrors useStockChart):
    // a naive `ws://${apiBaseUrl.replace(/^http/, 'ws')}` would produce
    // `ws://ws://host/...` when the base already includes the scheme.
    const base = new URL(apiBaseUrl);
    const ws = new WebSocket(`${base.protocol.replace(/^http/, 'ws')}//${base.host}/api/ws/${symbol}`);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('CONNECTED');
      reconnectAttemptsRef.current = 0;
      // We'll trigger initial data fetch in useEffect
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.type === 'PRICE_UPDATE') {
          if (firstCandleRef.current) {
            const { change, changePercentage } = calculateChange(message.data.close, firstCandleRef.current);
            setData({
              price: message.data.close,
              change,
              changePercentage
            });
          }
        } else if (message.type === 'SYSTEM_STATUS') {
          updateStatus(message.status as ConnectionStatus);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      if (statusRef.current !== 'CONNECTED') {
        updateStatus('DISCONNECTED');
      }
      const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      setTimeout(() => {
        reconnectAttemptsRef.current++;
        connectWebSocket();
      }, timeout);
    };

    ws.onerror = () => {
      setError('WebSocket error occurred');
    };
  }, [apiBaseUrl, symbol, updateStatus]);

  useEffect(() => {
    let isMounted = true;
    const setup = async () => {
      if (!isMounted) return;
      setError(null);
      updateStatus('CONNECTING');

      try {
        const history = await fetchHistoricalData();
        if (history.length > 0) {
          const firstCandle = history[0];
          firstCandleRef.current = firstCandle;
          const currentPrice = history[history.length - 1].close;
          const { change, changePercentage } = calculateChange(currentPrice, firstCandle);

          setData({
            price: currentPrice,
            change,
            changePercentage
          });
        }
        connectWebSocket();
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize data');
          updateStatus('DISCONNECTED');
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, apiBaseUrl, fetchHistoricalData, connectWebSocket, updateStatus]);

  return { data, status, error };
};
