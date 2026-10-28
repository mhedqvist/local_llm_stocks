import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  UTCTimestamp
} from 'lightweight-charts';
import { OHLCV } from '../types/chart';
import { ConnectionStatus, WebSocketMessage } from '../types/websocket';
import * as indicators from '../utils/indicators';

export interface ChartData {
  price: number;
  timestamp: number;
  change: number;
  changePercentage: number;
}

export interface IndicatorConfig {
  enabled: boolean;
  params: Record<string, number>;
}

export interface IndicatorsConfig {
  sma: IndicatorConfig;
  ema: IndicatorConfig;
  rsi: IndicatorConfig;
  macd: IndicatorConfig;
  bollingerBands: IndicatorConfig;
  volume: IndicatorConfig;
}

// Cast helpers: lightweight-charts requires Time (branded UTCTimestamp | BusinessDay),
// while the API returns plain unix-timestamp numbers.
const toCandle = (d: OHLCV): CandlestickData => ({ ...d, time: d.time as UTCTimestamp });
const toCandles = (data: OHLCV[]): CandlestickData[] => data.map(toCandle);
const toLinePoints = (points: { time: number; value: number }[]): LineData[] =>
  points.map(p => ({ time: p.time as UTCTimestamp, value: p.value }));
const toHistogramPoints = (points: { time: number; value: number; color?: string }[]): HistogramData[] =>
  points.map(p => ({ time: p.time as UTCTimestamp, value: p.value, color: p.color }));

export const useStockChart = (
  symbol: string, 
  apiBaseUrl: string, 
  resolution: string = 'daily',
  indicatorsConfig: Partial<IndicatorsConfig> = {}
) => {
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<ChartData | null>(null);

  const statusRef = useRef<ConnectionStatus>('CONNECTING');
  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{
    main: ISeriesApi<'Candlestick'>;
    sma?: ISeriesApi<'Line'>;
    ema?: ISeriesApi<'Line'>;
    rsi?: ISeriesApi<'Line'>;
    macdLine?: ISeriesApi<'Line'>;
    macdSignal?: ISeriesApi<'Line'>;
    macdHistogram?: ISeriesApi<'Histogram'>;
    bollingerUpper?: ISeriesApi<'Line'>;
    bollingerMiddle?: ISeriesApi<'Line'>;
    bollingerLower?: ISeriesApi<'Line'>;
    volume?: ISeriesApi<'Histogram'>;
  }>({
    main: null as any,
  } as any);
  
  const wsRef = useRef<WebSocket | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const firstCandleRef = useRef<OHLCV | null>(null);
  const historyRef = useRef<OHLCV[]>([]);
  const reconnectAttemptsRef = useRef(0);

  const fetchHistoricalData = useCallback(async (): Promise<OHLCV[]> => {
    const resMap: Record<string, string> = {
      '1d': 'daily',
      '1h': '1h',
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '60m': '60m',
    };
    const mappedResolution = resMap[resolution] || resolution;
    
    const response = await fetch(`${apiBaseUrl}/api/history/${symbol}?resolution=${mappedResolution}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`);
    }
    return await response.json();
  }, [apiBaseUrl, symbol, resolution]);

  const calculateChange = (currentPrice: number, firstCandle: OHLCV) => {
    const change = currentPrice - firstCandle.open;
    const changePercentage = (change / firstCandle.open) * 100;
    return { change, changePercentage };
  };

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const mainSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current.main = mainSeries;

    window.addEventListener('resize', () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });

    return { chart, mainSeries };
  }, []);

  const updateIndicators = useCallback((data: OHLCV[]) => {
    const chart = chartRef.current;
    if (!chart) return;

    // 1. SMA
    if (indicatorsConfig.sma?.enabled) {
      if (!seriesRef.current.sma) {
        seriesRef.current.sma = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
      }
      const smaData = indicators.calculateSMA(data, indicatorsConfig.sma.params.period);
      seriesRef.current.sma.setData(toLinePoints(smaData));
    } else if (seriesRef.current.sma) {
      chart.removeSeries(seriesRef.current.sma);
      seriesRef.current.sma = undefined;
    }

    // 2. EMA
    if (indicatorsConfig.ema?.enabled) {
      if (!seriesRef.current.ema) {
        seriesRef.current.ema = chart.addLineSeries({ color: '#a855f7', lineWidth: 2 });
      }
      const emaData = indicators.calculateEMA(data, indicatorsConfig.ema.params.period);
      seriesRef.current.ema.setData(toLinePoints(emaData));
    } else if (seriesRef.current.ema) {
      chart.removeSeries(seriesRef.current.ema);
      seriesRef.current.ema = undefined;
    }

    // 3. RSI
    if (indicatorsConfig.rsi?.enabled) {
      if (!seriesRef.current.rsi) {
        seriesRef.current.rsi = chart.addLineSeries({ 
          color: '#f59e0b', 
          lineWidth: 2,
          priceScaleId: 'rsi-scale'
        });
      }
      const rsiData = indicators.calculateRSI(data, indicatorsConfig.rsi.params.period);
      seriesRef.current.rsi.setData(toLinePoints(rsiData));
    } else if (seriesRef.current.rsi) {
      chart.removeSeries(seriesRef.current.rsi);
      seriesRef.current.rsi = undefined;
    }

    // 4. MACD
    if (indicatorsConfig.macd?.enabled) {
      if (!seriesRef.current.macdLine) {
        seriesRef.current.macdLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
        seriesRef.current.macdSignal = chart.addLineSeries({ color: '#ef4444', lineWidth: 1 });
        seriesRef.current.macdHistogram = chart.addHistogramSeries({ color: '#22c55e' });
      }
      const macdData = indicators.calculateMACD(
        data, 
        indicatorsConfig.macd.params.fast, 
        indicatorsConfig.macd.params.slow, 
        indicatorsConfig.macd.params.signal
      );
      
      const macdPoints = macdData.map(d => ({ time: d.time, value: d.macd }));
      const signalPoints = macdData.map(d => ({ time: d.time, value: d.signal }));
      const histogramPoints = macdData.map(d => ({ 
        time: d.time, 
        value: d.histogram,
        color: d.histogram >= 0 ? '#22c55e' : '#ef4444'
      }));

      seriesRef.current.macdLine?.setData(toLinePoints(macdPoints));
      seriesRef.current.macdSignal?.setData(toLinePoints(signalPoints));
      seriesRef.current.macdHistogram?.setData(toHistogramPoints(histogramPoints));
    } else {
      const { macdLine, macdSignal, macdHistogram } = seriesRef.current;
      if (macdLine) chart.removeSeries(macdLine);
      if (macdSignal) chart.removeSeries(macdSignal);
      if (macdHistogram) chart.removeSeries(macdHistogram);
      seriesRef.current.macdLine = undefined;
      seriesRef.current.macdSignal = undefined;
      seriesRef.current.macdHistogram = undefined;
    }

    // 5. Bollinger Bands
    if (indicatorsConfig.bollingerBands?.enabled) {
      if (!seriesRef.current.bollingerUpper) {
        seriesRef.current.bollingerUpper = chart.addLineSeries({ color: 'rgba(148, 163, 184, 0.5)', lineWidth: 1 });
        seriesRef.current.bollingerMiddle = chart.addLineSeries({ color: '#64748b', lineWidth: 1 });
        seriesRef.current.bollingerLower = chart.addLineSeries({ color: 'rgba(148, 163, 184, 0.5)', lineWidth: 1 });
      }
      const bbData = indicators.calculateBollingerBands(data, indicatorsConfig.bollingerBands.params.period, indicatorsConfig.bollingerBands.params.stdDev);
      seriesRef.current.bollingerUpper?.setData(toLinePoints(bbData.map(d => ({ time: d.time, value: d.upper }))));
      seriesRef.current.bollingerMiddle?.setData(toLinePoints(bbData.map(d => ({ time: d.time, value: d.middle }))));
      seriesRef.current.bollingerLower?.setData(toLinePoints(bbData.map(d => ({ time: d.time, value: d.lower }))));
    } else {
      const { bollingerUpper, bollingerMiddle, bollingerLower } = seriesRef.current;
      if (bollingerUpper) chart.removeSeries(bollingerUpper);
      if (bollingerMiddle) chart.removeSeries(bollingerMiddle);
      if (bollingerLower) chart.removeSeries(bollingerLower);
      seriesRef.current.bollingerUpper = undefined;
      seriesRef.current.bollingerMiddle = undefined;
      seriesRef.current.bollingerLower = undefined;
    }

    // 6. Volume
    if (indicatorsConfig.volume?.enabled) {
      if (!seriesRef.current.volume) {
        seriesRef.current.volume = chart.addHistogramSeries({
          color: '#334155',
        });
      }
      const volumeData = indicators.calculateVolume(data);
      seriesRef.current.volume.setData(toHistogramPoints(volumeData));
    } else if (seriesRef.current.volume) {
      chart.removeSeries(seriesRef.current.volume);
      seriesRef.current.volume = undefined;
    }

  }, [indicatorsConfig]);

  const performGapFilling = useCallback(async () => {
    try {
      const history = await fetchHistoricalData();
      historyRef.current = history;
      if (history.length > 0) {
        seriesRef.current.main.setData(toCandles(history));
        lastTimestampRef.current = history[history.length - 1].time;
        
        const firstCandle = history[0];
        firstCandleRef.current = firstCandle;
        const currentPrice = history[history.length - 1].close;
        const { change, changePercentage } = calculateChange(currentPrice, firstCandle);

        setCurrentPrice({
          price: currentPrice,
          timestamp: history[history.length - 1].time,
          change,
          changePercentage
        });

        updateIndicators(history);
      }
    } catch (err) {
      console.error('Gap filling failed:', err);
    }
  }, [fetchHistoricalData, updateIndicators]);

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    updateStatus('CONNECTING');
    const ws = new WebSocket(`ws://${apiBaseUrl.replace(/^http/, 'ws')}/api/ws/${symbol}`);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('CONNECTED');
      reconnectAttemptsRef.current = 0;
      performGapFilling();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.type === 'PRICE_UPDATE') {
          seriesRef.current.main.update(toCandle(message.data));
          lastTimestampRef.current = message.data.time;
          
          // Update history
          const history = historyRef.current;
          if (history.length > 0) {
            const lastPoint = history[history.length - 1];
            if (lastPoint.time === message.data.time) {
              history[history.length - 1] = message.data;
            } else {
              history.push(message.data);
            }
            updateIndicators(history);
          }

          if (firstCandleRef.current) {
            const { change, changePercentage } = calculateChange(message.data.close, firstCandleRef.current);
            setCurrentPrice({
              price: message.data.close,
              timestamp: message.data.time,
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
  }, [apiBaseUrl, symbol, performGapFilling, updateStatus, updateIndicators]);

  useEffect(() => {
    let isMounted = true;
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    const setup = async () => {
      if (!isMounted) return;
      setError(null);
      updateStatus('CONNECTING');

      const result = await initChart();
      if (!isMounted || !result) return;

      try {
        const history = await fetchHistoricalData();
        seriesRef.current.main.setData(toCandles(history));
        if (history.length > 0) {
          lastTimestampRef.current = history[history.length - 1].time;
          const firstCandle = history[0];
          firstCandleRef.current = firstCandle;
          const currentPrice = history[history.length - 1].close;
          const { change, changePercentage } = calculateChange(currentPrice, firstCandle);

          setCurrentPrice({
            price: currentPrice,
            timestamp: history[history.length - 1].time,
            change,
            changePercentage
          });
          updateIndicators(history);
        }
        connectWebSocket();
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize chart data');
          updateStatus('DISCONNECTED');
        }
      }
    };

    setup();
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, apiBaseUrl, resolution, initChart, fetchHistoricalData, connectWebSocket, updateStatus, updateIndicators]);

  return { containerRef, status, error, currentPrice };
};
