import { IndicatorsConfig } from '../hooks/useStockChart';

export interface PaneConfig {
  id: string;
  symbol: string;
  resolution: string;
  indicators: IndicatorsConfig;
}

export interface WorkspaceState {
  version: 1;
  panes: PaneConfig[];
  activePaneId: string | null;
}

export const defaultIndicators = (): IndicatorsConfig => ({
  sma: { enabled: false, params: { period: 20 } },
  ema: { enabled: false, params: { period: 20 } },
  rsi: { enabled: false, params: { period: 14 } },
  macd: { enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
  bollingerBands: { enabled: false, params: { period: 20, stdDev: 2 } },
  volume: { enabled: false, params: {} },
});

export const newPaneId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pane-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const INDICATOR_KEYS: (keyof IndicatorsConfig)[] = [
  'sma',
  'ema',
  'rsi',
  'macd',
  'bollingerBands',
  'volume',
];

export const normalizeIndicators = (raw: unknown): IndicatorsConfig => {
  const defaults = defaultIndicators();
  if (!raw || typeof raw !== 'object') return defaults;
  const out: IndicatorsConfig = { ...defaults };
  for (const key of INDICATOR_KEYS) {
    const r = (raw as Record<string, unknown>)[key];
    if (r && typeof r === 'object') {
      const rec = r as { enabled?: unknown; params?: unknown };
      out[key] = {
        enabled: Boolean(rec.enabled),
        params:
          rec.params && typeof rec.params === 'object'
            ? (rec.params as Record<string, number>)
            : defaults[key].params,
      };
    }
  }
  return out;
};

/**
 * Defensively parse an untrusted localStorage payload into a valid
 * WorkspaceState, or return null if it is unusable.
 */
// Backend-accepted resolutions (see src/providers/alpha_vantage.py);
// legacy aliases are normalized to 'daily'.
const normalizeResolution = (raw: unknown): string => {
  const r = typeof raw === 'string' ? raw : 'daily';
  return r === '1d' || r === 'day' || r === 'DAILY' ? 'daily' : r;
};

export const normalizeWorkspace = (raw: unknown): WorkspaceState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const ws = raw as { panes?: unknown; activePaneId?: unknown };
  if (!Array.isArray(ws.panes) || ws.panes.length === 0) return null;

  const panes: PaneConfig[] = ws.panes
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof (p as { symbol?: unknown })?.symbol === 'string')
    .map((p, i) => ({
      id: typeof p.id === 'string' ? p.id : `pane-${i}`,
      symbol: String(p.symbol).toUpperCase(),
      resolution: normalizeResolution(p.resolution),
      indicators: normalizeIndicators(p.indicators),
    }));

  if (panes.length === 0) return null;

  const activePaneId =
    panes.some((p) => p.id === ws.activePaneId) ? (ws.activePaneId as string) : panes[0].id;

  return { version: 1, panes, activePaneId };
};
