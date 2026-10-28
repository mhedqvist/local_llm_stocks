import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IChartApi, ISeriesApi, MouseEventHandler, Time, TimeRangeChangeEventHandler } from 'lightweight-charts';
import { PaneConfig } from '../types/workspace';
import { workspaceSync } from '../lib/workspaceSync';
import { useStockChart, IndicatorsConfig } from '../hooks/useStockChart';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';

interface ChartPaneProps {
  pane: PaneConfig;
  /** This pane is the workspace-active pane (highlighted). */
  isActive: boolean;
  /** Document is visible; false pauses the pane's data stream. */
  streaming: boolean;
  apiBaseUrl: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onUpdate: (
    id: string,
    patch: Partial<Omit<PaneConfig, 'id'>>
  ) => void;
}

const RESOLUTIONS = ['1m', '5m', '1h', 'daily'];
const INDICATOR_LABELS: Record<keyof IndicatorsConfig, string> = {
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  bollingerBands: 'BB',
  volume: 'Vol',
};

const ChartPane: React.FC<ChartPaneProps> = ({
  pane,
  isActive,
  streaming,
  apiBaseUrl,
  onActivate,
  onClose,
  onUpdate,
}) => {
  const [chartApi, setChartApi] = useState<{
    chart: IChartApi;
    mainSeries: ISeriesApi<'Candlestick'>;
  } | null>(null);
  // Set while applying a remote time range so the resulting local
  // visible-range change is not re-broadcast (echo loop prevention).
  const applyingRemoteRangeRef = useRef(false);

  const handleChartReady = useCallback(
    (c: IChartApi, main: ISeriesApi<'Candlestick'>) => setChartApi({ chart: c, mainSeries: main }),
    []
  );

  const { containerRef, status, error, currentPrice, stale, rateLimit } = useStockChart(
    pane.symbol,
    apiBaseUrl,
    pane.resolution,
    pane.indicators,
    { active: streaming, onChartReady: handleChartReady }
  );

  // 1 Hz countdown clock, active only while a rate-limit retry is pending.
  const [rateLimitNow, setRateLimitNow] = useState(0);
  useEffect(() => {
    if (!rateLimit) return;
    setRateLimitNow(Date.now());
    const id = window.setInterval(() => setRateLimitNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rateLimit]);

  const rateLimited = Boolean(rateLimit) && Boolean(error?.startsWith('Rate limited'));
  const errorText = rateLimited
    ? `Rate limited — retrying in ${Math.max(0, Math.ceil((rateLimit!.retryAt - rateLimitNow) / 1000))}s`
    : error;
  const showStale = (stale || status === 'DISCONNECTED' || status === 'RECONNECTING') && streaming;

  // Wire this pane into workspace synchronization (crosshair + time scale).
  useEffect(() => {
    if (!chartApi) return;
    const { chart, mainSeries } = chartApi;
    const paneId = pane.id;

    const unsubRemoteCrosshair = workspaceSync.subscribeCrosshair(paneId, (event, sourceId) => {
      if (sourceId === paneId) return;
      if (event.time === null) {
        chart.clearCrosshairPosition();
      } else {
        // The price is expressed on the source pane's scale; time alignment
        // is the meaningful part for cross-asset comparison.
        chart.setCrosshairPosition(event.price ?? 0, event.time, mainSeries);
      }
    });

    const unsubRemoteRange = workspaceSync.subscribeTimeRange(paneId, (range, sourceId) => {
      if (sourceId === paneId) return;
      // Skip charts that cannot map the source's time window (no candles
      // yet, or a range outside this pane's data window): lightweight-charts
      // throws `Value is null` in its development build in that case.
      if (!chart.timeScale().getVisibleRange()) return;
      applyingRemoteRangeRef.current = true;
      try {
        chart.timeScale().setVisibleRange(range);
      } catch {
        applyingRemoteRangeRef.current = false;
        return;
      }
      // The subscription callback fires synchronously during setVisibleRange;
      // clear the flag on the next tick so the echo is suppressed.
      window.setTimeout(() => {
        applyingRemoteRangeRef.current = false;
      }, 0);
    });

    const localCrosshairHandler: MouseEventHandler<Time> = (param) => {
      if (param.time !== undefined) {
        const mainData = param.seriesData.get(mainSeries);
        const price = mainData && 'close' in mainData ? mainData.close : null;
        workspaceSync.broadcastCrosshair({ time: param.time, price }, paneId);
      } else {
        workspaceSync.broadcastCrosshair({ time: null, price: null }, paneId);
      }
    };
    chart.subscribeCrosshairMove(localCrosshairHandler);

    const localRangeHandler: TimeRangeChangeEventHandler<Time> = (range) => {
      if (applyingRemoteRangeRef.current || !range) return;
      workspaceSync.broadcastTimeRange(range, paneId);
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(localRangeHandler);

    return () => {
      unsubRemoteCrosshair();
      unsubRemoteRange();
      chart.unsubscribeCrosshairMove(localCrosshairHandler);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(localRangeHandler);
      workspaceSync.forget(paneId);
    };
  }, [chartApi, pane.id]);

  // Draft state: commit the symbol on Enter/blur so each keystroke does not
  // re-trigger a full history fetch + WS reconnect.
  const [symbolDraft, setSymbolDraft] = useState(pane.symbol);
  useEffect(() => setSymbolDraft(pane.symbol), [pane.symbol]);
  const commitSymbol = () => {
    const s = symbolDraft.trim().toUpperCase();
    if (s && s !== pane.symbol) onUpdate(pane.id, { symbol: s });
    else setSymbolDraft(pane.symbol);
  };

  const toggleIndicator = (name: keyof IndicatorsConfig) => {
    onUpdate(pane.id, {
      indicators: {
        ...pane.indicators,
        [name]: { ...pane.indicators[name], enabled: !pane.indicators[name].enabled },
      },
    });
  };

  const isPositive = (currentPrice?.change ?? 0) >= 0;

  return (
    <div
      onClick={() => onActivate(pane.id)}
      className={`flex flex-col rounded-lg overflow-hidden border shadow-xl bg-slate-950 min-h-[320px] ${
        isActive ? 'border-blue-600/70' : 'border-slate-800'
      }`}
    >
      {/* Pane toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-900/70 border-b border-slate-800 text-xs">
        <input
          type="text"
          value={symbolDraft}
          onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())}
          onBlur={commitSymbol}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitSymbol();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-white font-semibold uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label={`Symbol for pane ${pane.id}`}
        />
        <div className="flex items-center gap-1">
          {RESOLUTIONS.map((res) => (
            <button
              key={res}
              onClick={() => onUpdate(pane.id, { resolution: res })}
              className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                pane.resolution === res
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {res}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(Object.keys(INDICATOR_LABELS) as (keyof IndicatorsConfig)[]).map((name) => (
            <button
              key={name}
              onClick={() => toggleIndicator(name)}
              className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                pane.indicators[name].enabled
                  ? 'bg-emerald-700/60 text-emerald-100'
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
              title={`Toggle ${name}`}
            >
              {INDICATOR_LABELS[name]}
            </button>
          ))}
        </div>
        <button
          onClick={() => onClose(pane.id)}
          className="ml-1 p-0.5 text-slate-500 hover:text-rose-400 transition-colors"
          title="Remove pane"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Price / status line */}
      <div className="flex items-center gap-3 px-2 py-1 bg-slate-900/40 text-xs border-b border-slate-800/60">
        <span className={`font-mono font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${currentPrice?.price?.toFixed(2) ?? '---'}
        </span>
        <span className={isPositive ? 'text-emerald-500' : 'text-rose-500'}>
          {isPositive ? '▲' : '▼'} {Math.abs(currentPrice?.changePercentage ?? 0).toFixed(2)}%
        </span>
        <div className="ml-auto flex items-center gap-2">
          {showStale && (
            <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              Stale
            </span>
          )}
          <ConnectionStatusIndicator status={status} />
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-grow">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {errorText && (
          <div className="absolute top-2 left-2 bg-rose-900/80 text-rose-200 text-xs px-2 py-1 rounded max-w-[80%]">
            {errorText}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartPane;
