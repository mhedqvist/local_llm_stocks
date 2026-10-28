// Feature 9, sub-task C — real-time performance verification.
//
// Verifies that 20 Hz WebSocket ticks (per pane) do NOT cause per-tick React
// renders. Each pane's tick handler only touches refs +
// `series.update()`; the price readout is throttled to one `setCurrentPrice`
// per 250 ms (`schedulePriceRender` in useStockChart.ts).
//
// Setup:
//   - ws-mock-server.mjs on :8123 (20 Hz PRICE_UPDATE per /api/ws/{symbol}),
//   - a dedicated Vite dev server on :5174 with
//     VITE_API_BASE_URL=http://localhost:8123 (dev React build).
// The workspace is seeded with 4 panes at 1m; the default watchlist
// (AAPL/MSFT/GOOGL) also streams, so ~7 connections are expected.
//
// Measurement:
//   The handoff's `__REACT_DEVTOOLS_GLOBAL_HOOK__.renderPhase` stub is
//   installed as specified, but React 18's react-dom build never calls
//   `hook.renderPhase` (only `inject` / `onCommitFiberRoot`), so those
//   counts stay empty — the documented fallback applies. The primary
//   measurement is instead a MutationObserver counting rendered price-line
//   output inside the 4 chart panes: every ChartPane re-render carrying a
//   new throttled price rewrites 2 text nodes (price + % change), so this
//   directly measures rendered tick output:
//     throttled (expected): 4 panes × ~4 renders/s × 10 s × 2 ≈ 320
//     per-tick  (rejected): 4 panes × 20 ticks/s × 10 s × 2 = 1600
//   Raw WS message receipts are counted via a WebSocket wrapper as the
//   "ticks in" baseline. Static audit of the tick path is recorded in
//   docs/implemented/feature-9.md (sub-task D).

import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildMinuteFixture, seededWorkspace } from './fixtures';

const E2E_DIR = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const PERF_PORT = 5174;
const MOCK_PORT = 8123;
const TICK_WINDOW_MS = 10_000;
// Minute boundary (unix seconds): last fixture candle time == first mock
// tick time, so series.update() never receives "old data".
const startSec = Math.floor(Date.now() / 1000 / 60) * 60;

const servers: { proc: ChildProcess; name: string; log: string[] }[] = [];

const spawnTracked = (name: string, proc: ChildProcess): ChildProcess => {
  const log: string[] = [];
  proc.stdout?.on('data', (d: Buffer) => log.push(d.toString()));
  proc.stderr?.on('data', (d: Buffer) => log.push(d.toString()));
  proc.on('exit', (code) => log.push(`[exit code=${code}]`));
  proc.on('error', (err) => log.push(`[spawn error: ${err}]`));
  servers.push({ proc, name, log });
  return proc;
};

const waitFor = async (url: string, timeoutMs = 30_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${url} did not come up within ${timeoutMs} ms`);
};

test.beforeAll(async () => {
  spawnTracked(
    'ws-mock',
    spawn(
      process.execPath,
      [fileURLToPath(new URL('./ws-mock-server.mjs', import.meta.url))],
      {
        cwd: E2E_DIR,
        env: {
          ...process.env,
          WS_MOCK_PORT: String(MOCK_PORT),
          WS_MOCK_START_SEC: String(startSec),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
  );
  spawnTracked(
    'vite-perf',
    spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
        '--port',
        String(PERF_PORT),
        '--strictPort',
      ],
      {
        cwd: FRONTEND_DIR,
        env: { ...process.env, VITE_API_BASE_URL: `http://localhost:${MOCK_PORT}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
  );
  try {
    await waitFor(`http://localhost:${MOCK_PORT}/health`);
    await waitFor(`http://localhost:${PERF_PORT}`);
  } catch (err) {
    for (const s of servers) {
      // eslint-disable-next-line no-console
      console.log(`[perf setup] ${s.name} output:\n${s.log.join('')}`);
    }
    throw err;
  }
}, 90_000);

test.afterAll(async () => {
  for (const s of servers) s.proc.kill();
  await new Promise((r) => setTimeout(r, 500));
});

test('20 Hz ticks do not cause per-tick React renders', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // The renderPhase stub is not a real DevTools backend, so React logs
    // one expected version warning — ignore only that.
    if (msg.text().includes('React DevTools is too old')) return;
    consoleErrors.push(msg.text());
  });

  // REST history for every symbol (panes + default watchlist) is the
  // deterministic 1-minute fixture.
  const fixture = JSON.stringify(buildMinuteFixture(startSec));
  page.route('**/api/history/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: fixture })
  );

  page.addInitScript(() => {
    // Handoff-specified renderPhase hook (see file header: React 18 does
    // not call it; kept for spec parity and logged in the report).
    const hook: {
      _counts: Record<string, number>;
      renderers: unknown[];
      _renderers: unknown[];
      inject: () => void;
      renderPhase: (fiber: unknown, fn: unknown) => void;
    } = {
      _counts: {},
      // Vite's react-refresh preamble calls hook.renderers.forEach(...) on
      // load; both arrays must exist for the dev app to boot.
      renderers: [],
      _renderers: [],
      inject() {},
      renderPhase(_fiber, fn) {
        const name =
          (fn as { displayName?: string })?.displayName ||
          (fn as { name?: string })?.name ||
          'Anonymous';
        this._counts[name] = (this._counts[name] || 0) + 1;
      },
    };
    (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;

    // Primary measurement: rendered price-line output inside chart panes.
    // Each ChartPane re-render with a fresh throttled price rewrites exactly
    // 2 text nodes (the $price and the % change).
    (window as unknown as Record<string, number>).__RENDER_OUTPUTS__ = 0;
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData' && r.target.nodeType === Node.TEXT_NODE) {
          const pane = (r.target.parentElement as HTMLElement | null)?.closest(
            'div[class*="shadow-xl"]'
          );
          if (pane) {
            (window as unknown as Record<string, number>).__RENDER_OUTPUTS__ += 1;
          }
        }
      }
    });
    const startObserver = () =>
      observer.observe(document.body, { subtree: true, characterData: true });
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);

    // "Ticks in" baseline: count every WS message received.
    (window as unknown as Record<string, number>).__TICKS__ = 0;
    const OrigWS = window.WebSocket;
    class CountingWS extends OrigWS {
      constructor(...args: ConstructorParameters<typeof OrigWS>) {
        super(...args);
        this.addEventListener('message', () => {
          (window as unknown as Record<string, number>).__TICKS__ += 1;
        });
      }
    }
    (window as unknown as Record<string, unknown>).WebSocket = CountingWS;
  });

  page.addInitScript(
    (ws) => window.localStorage.setItem('stocker.workspace.v1', JSON.stringify(ws)),
    seededWorkspace(['P1', 'P2', 'P3', 'P4'], '1m')
  );

  await page.goto(`http://localhost:${PERF_PORT}/`);

  // All 4 panes connected to the mock WS server (scoped to pane roots).
  await expect(page.locator('div.shadow-xl').getByText('Live', { exact: true })).toHaveCount(
    4,
    { timeout: 20_000 }
  );

  const snapshot = () =>
    page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return {
        ticks: (w.__TICKS__ as number) ?? 0,
        outputs: (w.__RENDER_OUTPUTS__ as number) ?? 0,
        hook: (w.__REACT_DEVTOOLS_GLOBAL_HOOK__ as { _counts: Record<string, number> })._counts,
      };
    });

  const before = await snapshot();
  await page.waitForTimeout(TICK_WINDOW_MS);
  const after = await snapshot();

  const ticks = after.ticks - before.ticks;
  const outputs = after.outputs - before.outputs;

  // eslint-disable-next-line no-console
  console.log(
    `[perf] 10 s window: ticks=${ticks} (~${(ticks / (TICK_WINDOW_MS / 1000)).toFixed(1)}/s), ` +
      `pane price-line outputs=${outputs}, ` +
      `renderPhase counts=${JSON.stringify(after.hook)}`
  );

  // The mock stream must actually have been flowing: 4 panes + 3 default
  // watchlist items ≈ 7 connections × 20 Hz × 10 s ≈ 1400 messages.
  expect(ticks).toBeGreaterThanOrEqual(1000);

  // No per-tick renders. Per-tick would be 4 panes × 20 ticks/s × 10 s × 2
  // text updates = 1600; the 250 ms throttle yields 4 panes × ~4/s × 10 s
  // × 2 ≈ 320. 500 sits comfortably between the two regimes.
  expect(outputs).toBeLessThan(500);

  // Live prices still reach the UI (throttled renders did happen: at least
  // ~1 render/s per pane × 2 text updates × 4 panes ≈ 80).
  expect(outputs).toBeGreaterThanOrEqual(80);

  expect(consoleErrors).toEqual([]);
});
