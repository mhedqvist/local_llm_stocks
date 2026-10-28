// Deterministic E2E fixture data (Feature 9, sub-task B).
//
// Candles are built from a closed-form formula (no Math.random) so price
// assertions are identical on every run:
//   close(i) = 100 + i * 0.5 + 2 * sin(i / 3)
// The pane's initial price readout is always the last fixture close.

export interface FixtureCandle {
  time: number; // unix seconds (UTC, daily)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const closeAt = (i: number): number => 100 + i * 0.5 + 2 * Math.sin(i / 3);

/** ~60 ascending daily candles ending 2024-06-20 (UTC). */
export const buildDailyFixture = (count = 60): FixtureCandle[] => {
  const candles: FixtureCandle[] = [];
  for (let i = 0; i < count; i++) {
    const close = round2(closeAt(i));
    const open = i > 0 ? round2(closeAt(i - 1)) : round2(close - 0.4);
    candles.push({
      time: Math.floor(Date.UTC(2024, 4, 22 + i) / 1000),
      open,
      high: round2(Math.max(open, close) + 0.3),
      low: round2(Math.min(open, close) - 0.3),
      close,
      volume: 1_000_000 + ((i * 12_345) % 100) * 10_000,
    });
  }
  return candles;
};

/** Close of the final fixture candle; equals the pane's initial price readout. */
export const fixtureLastClose = (count = 60): number => round2(closeAt(count - 1));

/** Exact text of the pane's price line for the fixture data. */
export const fixturePriceText = (count = 60): string => `$${fixtureLastClose(count).toFixed(2)}`;

/**
 * A valid `WorkspaceState` payload (storage key `stocker.workspace.v1`)
 * with one daily pane per symbol and all indicators disabled — mirrors
 * `defaultIndicators()` in src/types/workspace.ts.
 */
export const seededWorkspace = (symbols: string[]) => {
  const indicators = {
    sma: { enabled: false, params: { period: 20 } },
    ema: { enabled: false, params: { period: 20 } },
    rsi: { enabled: false, params: { period: 14 } },
    macd: { enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
    bollingerBands: { enabled: false, params: { period: 20, stdDev: 2 } },
    volume: { enabled: false, params: {} },
  };
  const panes = symbols.map((symbol, i) => ({
    id: `e2e-pane-${i}`,
    symbol,
    resolution: 'daily',
    indicators,
  }));
  return { version: 1, panes, activePaneId: panes[0].id };
};
