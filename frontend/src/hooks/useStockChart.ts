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
import { RateLimitError, parseRetryAfterSeconds } from '../utils/errors';
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

export interface UseStockChartOptions {
  /**
   * When false, the pane renders its chart shell but does NOT fetch
   * historical data or open a WebSocket. Flipping back to true re-runs the
   * full setup (fetch + WS + gap-fill). Used to keep only visible/active
   * panes streaming.
   */
  active?: boolean;
  /** One-shot callback invoked once the lightweight-charts instance exists. */
  onChartReady?: (chart: IChartApi, mainSeries: ISeriesApi<'Candlestick'>) => void;
}

/** Initial-load 429 retry policy: exponential backoff 15/30/60/120/120s, max 5. */
const MAX_RATE_LIMIT_RETRIES = 5;
const BASE_RATE_LIMIT_BACKOFF_SECONDS = 15;
const MAX_RATE_LIMIT_BACKOFF_SECONDS = 120;

/**
 * Per-resolution "no candle updates" window after which connected data is
 * considered stale. Sized per Feature 9 plan: short for intraday, long for
 * daily (a quiet daily session can legitimately go hours without a tick).
 */
const STALE_THRESHOLDS_SECONDS: Record<string, number> = {
  '1m': 90,           // 90 s
  '5m': 600,          // 10 min
  '15m': 1800,        // 30 min
  '60m': 5400,        // 90 min
  '1h': 5400,         // 90 min
  daily: 86400,       // 24 h
};
const DEFAULT_STALE_THRESHOLD_SECONDS = 300; // 5 min

// Cast helpers: lightweight-charts requires Time (branded UTCTimestamp | BusinessDay),
// while the API returns plain unix-timestamp numbers.
const toCandle = (d: OHLCV): CandlestickData => ({ ...d, time: d.time as UTCTimestamp });
const toCandles = (data: OHLCV[]): CandlestickData[] => data.map(toCandle);
const toLinePoints = (points: { time: number; value: number }[]): LineData[] =>
  points.map(p => ({ time: p.time as UTCTimestamp, value: p.value }));
const toHistogramPoints = (points: { time: number; value: number; color?: string }[]): HistogramData[] =>
  points.map(p => ({ time: p.time as UTCTimestamp, value: p.value, color: p.color }));

const KNOWN_STATUSES = new Set<ConnectionStatus>([
  'CONNECTING',
  'CONNECTED',
  'DISCONNECTED',
  'RECONNECTING',
  'INACTIVE',
]);

export const useStockChart = (
  symbol: string, 
  apiBaseUrl: string, 
  resolution: string = 'daily',
  indicatorsConfig: Partial<IndicatorsConfig> = {},
  options: UseStockChartOptions = {}
) => {
  const active = options.active !== false;
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<ChartData | null>(null);
  /** True when the stream is healthy but candle data has stopped flowing. */
  const [stale, setStale] = useState(false);
  /** Set while waiting out a rate-limit retry before the next history load. */
  const [rateLimit, setRateLimit] = useState<{ retryAt: number } | null>(null);
  /**
   * Bumped after every successful history fetch; a synchronous effect below
   * applies the cached candles to the chart. Running the apply in a sync
   * effect (not inside the async fetch callback) means a malformed payload
   * throws during React's commit, where the per-pane ErrorBoundary catches it.
   */
  const [historyVersion, setHistoryVersion] = useState(0);

  const onChartReadyRef = useRef(options.onChartReady);
  onChartReadyRef.current = options.onChartReady;

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
  const reconnectTimerRef = useRef<number | null>(null);
  const rateLimitRetriesRef = useRef(0);
  /** Wall-clock time of the last candle update; drives the stale-data check. */
  const lastTickAtRef = useRef<number>(Date.now());

  // Throttle live-price React state to keep high-frequency WS ticks off the
  // render path: chart updates always happen via refs; the header readout
  // re-renders at most ~4x/s with the latest value.
  const pendingPriceRef = useRef<ChartData | null>(null);
  const lastPriceRenderRef = useRef(0);
  const priceTimerRef = useRef<number | null>(null);
  const schedulePriceRender = useCallback((data: ChartData) => {
    pendingPriceRef.current = data;
    const elapsed = Date.now() - lastPriceRenderRef.current;
    if (elapsed >= 250) {
      lastPriceRenderRef.current = Date.now();
      setCurrentPrice(data);
    } else if (priceTimerRef.current === null) {
      priceTimerRef.current = window.setTimeout(() => {
        priceTimerRef.current = null;
        lastPriceRenderRef.current = Date.now();
        if (pendingPriceRef.current) setCurrentPrice(pendingPriceRef.current);
      }, 250 - elapsed);
    }
  }, []);

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
    if (response.status === 429) {
      // Surface as a typed rate-limit error with the provider's Retry-After
      // honored as a floor (default 15s when the header is absent).
      throw new RateLimitError(
        'Rate limited by data provider',
        parseRetryAfterSeconds(response.headers.get('Retry-After'))
      );
    }
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
      autoSize: true,
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

    // Note: autoSize (ResizeObserver) handles container resizes; the width/
    // height above only serve as a fallback if ResizeObserver is unavailable.
    onChartReadyRef.current?.(chart, mainSeries);

    return { chart, mainSeries };
  }, []);

  const updateIndicators = useCallback((data: OHLCV[]) => {
    const chart = chartRef.current;
    if (!chart) return;
    // Remove any indicator series that no longer matches the config (this
    // runs on config toggles even before history has loaded, with empty data).
    if (seriesRef.current.sma && !indicatorsConfig.sma?.enabled) {
      chart.removeSeries(seriesRef.current.sma);
      seriesRef.current.sma = undefined;
    }
    if (seriesRef.current.ema && !indicatorsConfig.ema?.enabled) {
      chart.removeSeries(seriesRef.current.ema);
      seriesRef.current.ema = undefined;
    }
    if (seriesRef.current.rsi && !indicatorsConfig.rsi?.enabled) {
      chart.removeSeries(seriesRef.current.rsi);
      seriesRef.current.rsi = undefined;
    }
    if (!indicatorsConfig.macd?.enabled) {
      const { macdLine, macdSignal, macdHistogram } = seriesRef.current;
      if (macdLine) chart.removeSeries(macdLine);
      if (macdSignal) chart.removeSeries(macdSignal);
      if (macdHistogram) chart.removeSeries(macdHistogram);
      seriesRef.current.macdLine = undefined;
      seriesRef.current.macdSignal = undefined;
      seriesRef.current.macdHistogram = undefined;
    }
    if (!indicatorsConfig.bollingerBands?.enabled) {
      const { bollingerUpper, bollingerMiddle, bollingerLower } = seriesRef.current;
      if (bollingerUpper) chart.removeSeries(bollingerUpper);
      if (bollingerMiddle) chart.removeSeries(bollingerMiddle);
      if (bollingerLower) chart.removeSeries(bollingerLower);
      seriesRef.current.bollingerUpper = undefined;
      seriesRef.current.bollingerMiddle = undefined;
      seriesRef.current.bollingerLower = undefined;
    }
    if (seriesRef.current.volume && !indicatorsConfig.volume?.enabled) {
      chart.removeSeries(seriesRef.current.volume);
      seriesRef.current.volume = undefined;
    }

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
      // The sync history-apply effect below picks this up (throws on
      // malformed payloads, caught by the per-pane ErrorBoundary).
      setHistoryVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof RateLimitError) {
        // Surface the provider's rate limit; reconnects will retry the gap fill.
        // (No auto-retry here; the initial-load path owns the retry budget.)
        setError('Rate limited by data provider — will retry on reconnect');
      }
      console.error('Gap filling failed:', err);
    }
  }, [fetchHistoricalData]);

  // The tick handler always invokes the latest updateIndicators via a ref so
  // that indicator toggles do not change connectWebSocket's identity (a new
  // identity would tear down the chart and WebSocket on every toggle).
  const updateIndicatorsRef = useRef(updateIndicators);
  updateIndicatorsRef.current = updateIndicators;

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    updateStatus('CONNECTING');
    // Derive the WS URL from the HTTP base URL (handles http/https and
    // avoids a doubled scheme prefix).
    const url = new URL(apiBaseUrl);
    const wsScheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsScheme}//${url.host}/api/ws/${symbol}`);
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
          // Candle data is flowing again: reset the stale-data clock.
          lastTickAtRef.current = Date.now();
          setStale(false);
          
          // Update history
          const history = historyRef.current;
          if (history.length > 0) {
            const lastPoint = history[history.length - 1];
            if (lastPoint.time === message.data.time) {
              history[history.length - 1] = message.data;
            } else {
              history.push(message.data);
            }
            updateIndicatorsRef.current(history);
          }

          if (firstCandleRef.current) {
            const { change, changePercentage } = calculateChange(message.data.close, firstCandleRef.current);
            schedulePriceRender({
              price: message.data.close,
              timestamp: message.data.time,
              change,
              changePercentage
            });
          }
        } else if (message.type === 'SYSTEM_STATUS') {
          // Normalize case: the backend broadcasts lowercase status values.
          const normalized = String(message.status ?? '').toUpperCase() as ConnectionStatus;
          if (KNOWN_STATUSES.has(normalized)) {
            updateStatus(normalized);
          }
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
      // Track the timer so pane teardown can cancel a pending reconnect
      // (previously this leaked a reconnect chain after unmount).
      const timerId = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        // Skip if this socket was superseded (reconnect or teardown).
        if (wsRef.current !== ws) return;
        reconnectAttemptsRef.current++;
        connectWebSocket();
      }, timeout);
      reconnectTimerRef.current = timerId;
    };

    ws.onerror = () => {
      setError('WebSocket error occurred');
    };
  }, [apiBaseUrl, symbol, performGapFilling, updateStatus]);

  // Stale-data detection: on a healthy connection, flag the data as stale
  // when candle updates have been silent for longer than the
  // per-resolution threshold. Ticks are read from lastTickAtRef so the
  // interval itself never triggers re-renders without a state change.
  useEffect(() => {
    if (!active || status !== 'CONNECTED') return;
    const thresholdSec = STALE_THRESHOLDS_SECONDS[resolution] ?? DEFAULT_STALE_THRESHOLD_SECONDS;
    const check = () => {
      const ageSec = (Date.now() - lastTickAtRef.current) / 1000;
      const isStale = ageSec > thresholdSec;
      setStale((prev) => (prev === isStale ? prev : isStale));
    };
    check();
    const id = window.setInterval(check, 2000);
    return () => window.clearInterval(id);
  }, [active, status, resolution]);

  useEffect(() => {
    let isMounted = true;
    // Per-load mutable state resets (also abandons pending rate-limit
    // retries from the previous run; their timeouts check isMounted).
    rateLimitRetriesRef.current = 0;
    lastTickAtRef.current = Date.now();
    setStale(false);
    setRateLimit(null);

    const setup = async () => {
      if (!isMounted) return;
      setError(null);
      updateStatus(active ? 'CONNECTING' : 'INACTIVE');

      const result = await initChart();
      if (!isMounted || !result) return;

      if (!active) {
        // Inactive pane: render the chart shell but do not fetch data or
        // open a WebSocket.
        return;
      }

      loadHistoryAndConnect().catch(handleLoadError);
    };

    const loadHistoryAndConnect = async () => {
      const history = await fetchHistoricalData();
      if (!isMounted) return;
      setError(null);
      historyRef.current = history;
      // The sync history-apply effect below applies the candles to the chart
      // (so a malformed payload throws in commit, catchable by ErrorBoundary).
      setHistoryVersion((v) => v + 1);
      connectWebSocket();
    };

    // Initial-load error handling with 429 auto-retry: exponential backoff
    // 15/30/60/120/120s (up to 5 retries); a provider Retry-After header
    // (when present) acts as a floor on each wait. `rateLimit` exposes the
    // next-retry timestamp to the UI for a countdown readout.
    const handleLoadError = (err: unknown) => {
      if (!isMounted) return;
      if (err instanceof RateLimitError) {
        rateLimitRetriesRef.current += 1;
        const attempt = rateLimitRetriesRef.current;
        if (attempt <= MAX_RATE_LIMIT_RETRIES) {
          const backoffSec = Math.min(
            BASE_RATE_LIMIT_BACKOFF_SECONDS * 2 ** Math.min(attempt - 1, 4),
            MAX_RATE_LIMIT_BACKOFF_SECONDS
          );
          const waitSec = Math.max(backoffSec, err.retryAfterSeconds);
          updateStatus('DISCONNECTED');
          setError('Rate limited by data provider');
          setRateLimit({ retryAt: Date.now() + waitSec * 1000 });
          window.setTimeout(() => {
            if (!isMounted) return;
            setRateLimit(null);
            loadHistoryAndConnect().catch(handleLoadError);
          }, waitSec * 1000);
        } else {
          updateStatus('DISCONNECTED');
          setError('Rate limited by data provider — retries exhausted');
          setRateLimit(null);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to initialize chart data');
        updateStatus('DISCONNECTED');
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (priceTimerRef.current !== null) {
        clearTimeout(priceTimerRef.current);
        priceTimerRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      // Drop series handles so a rebuild never tries to removeSeries a
      // series that belonged to the destroyed chart (lightweight-charts
      // throws "Value is undefined" for that).
      seriesRef.current = { main: null as any } as any;
      historyRef.current = [];
    };
  }, [symbol, apiBaseUrl, resolution, active, initChart, fetchHistoricalData, connectWebSocket, updateStatus]);

  // Apply indicator config changes without rebuilding the chart: indicator
  // toggles used to change updateIndicators' identity, which re-ran the main
  // setup effect (chart teardown + refetch + WS reconnect) and left stale
  // series handles pointing at the removed chart (lightweight-charts
  // "Value is undefined" in removeSeries). Now toggles only reconcile the
  // indicator series against the loaded history.
  useEffect(() => {
    if (!chartRef.current) return;
    updateIndicators(historyRef.current);
  }, [updateIndicators]);

  // Synchronous history apply: whenever a fetch succeeds and bumps
  // historyVersion, push the cached candles into the chart and reset the
  // stale/price state. A malformed payload (e.g. a JSON object where an array
  // is expected) throws here during React's commit, where the per-pane
  // ErrorBoundary can catch it — unlike throwing inside an async callback.
  useEffect(() => {
    if (historyVersion <= 0) return;
    const history = historyRef.current;
    if (history.length === 0) return;
    seriesRef.current.main.setData(toCandles(history));
    lastTimestampRef.current = history[history.length - 1].time;
    firstCandleRef.current = history[0];
    const currentPrice = history[history.length - 1].close;
    const { change, changePercentage } = calculateChange(currentPrice, history[0]);

    lastPriceRenderRef.current = Date.now();
    lastTickAtRef.current = Date.now();
    setStale(false);
    setCurrentPrice({
      price: currentPrice,
      timestamp: history[history.length - 1].time,
      change,
      changePercentage
    });
    updateIndicators(history);
  }, [historyVersion, updateIndicators]);

  return { containerRef, status, error, currentPrice, stale, rateLimit };
};