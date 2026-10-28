# Feature 9 — QA & Robustness (in progress)

Phases 1–3 committed (unit tests, error boundaries, stale-data, 429 handling,
status normalization, backend typed exceptions). Sub-tasks A–C committed
incrementally; this document is finalized in sub-task D.

## E2E suite (Playwright, chromium, `frontend/e2e/`)

- `workspace.spec.ts` — load, indicator toggle, add/close pane, symbol persistence.
- `rate-limit.spec.ts` — 429 banner with countdown, then retry succeeds.
- `error-boundary.spec.ts` — malformed history payload contained per-pane; Retry works.
- `perf.spec.ts` — 20 Hz tick flood against a deterministic mock WS server
  (`ws-mock-server.mjs`, port 8123, `PRICE_UPDATE` every 50 ms) with a dedicated
  Vite dev server on 5174 (`VITE_API_BASE_URL=http://localhost:8123`).

## Performance verification (sub-task C)

Setup: workspace seeded with **4 panes at `1m`**; REST history mocked with a
deterministic 60-candle 1-minute fixture; the default 3-symbol watchlist also
streams, so ~7 WS connections receive 20 Hz ticks.

**Method.** The handoff's `__REACT_DEVTOOLS_GLOBAL_HOOK__` renderPhase stub is
installed as specified, but React 18's `react-dom` build never calls
`hook.renderPhase` (only `inject` / `onCommitFiberRoot`), so those counts stay
empty — the documented fallback applies. The primary measurement is a
MutationObserver counting rendered price-line output inside the 4 chart panes:
every `ChartPane` re-render carrying a new throttled price rewrites exactly 2
text nodes (price + % change), so it directly measures rendered tick output.

**Measured (10 s window, headless Chromium, dev React build):**

| Metric | Value |
| --- | --- |
| WS messages received (all connections) | ~1110 (~111/s; 4 panes + 3 watchlist items, small loss to initial reconnects) |
| Pane price-line text updates (4 panes) | ~312–316 |
| ≈ rendered price updates per pane | ~39 (≈ 4/s — the 250 ms throttle) |

**Regimes:** per-tick rendering would produce 4 panes × 20 ticks/s × 10 s × 2
text updates = **1600**; the throttled path measured **~312–316** (assertion
bounds: ≥ 80 and < 500), i.e. no per-tick renders.

**Static audit of the tick path (fallback, `useStockChart.ts`):** the WS
`onmessage` handler only touches refs (`lastTickAtRef`, `historyRef`,
`firstCandleRef`, `lastTimestampRef`) and calls `series.update()`; the sole
state update is `setCurrentPrice` inside `schedulePriceRender`, throttled to
one render per 250 ms. `App` holds no tick state, so it renders only from user
actions / workspace changes.

Known limitation (documented in D): the renderPhase hook only yields counts on
React builds that call it (React 19+ / react-reconciler devtools protocol); on
React 18 the DOM-output measurement above is authoritative.
