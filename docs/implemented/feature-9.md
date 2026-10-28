# Feature 9 — QA & Robustness (COMPLETE)

What was built, how to run every suite, results, and known limitations.

## What was built

**Frontend (`frontend/src/`)**
- **Vitest indicator suite** — `utils/indicators.test.ts` (34 tests, hand-computed
  references). RSI flat-series fix: `0/0 → 50` via `rsiFromAverages`.
- **Error boundaries** — `components/ErrorBoundary.tsx`
  (`{ label, children, fallback? }`, key-bump Retry); per-pane in
  `WorkspaceGrid.tsx`, top-level around `<main>` in `App.tsx`.
- **Stale-data indicator** — `useStockChart` returns `stale` (2 s interval,
  per-resolution thresholds `1m:90s, 5m:600s, 15m:1800s, 60m:5400s, 1h:5400s,
  daily:86400s, default:300s`; ≤1 setState per transition); amber "Stale" pill
  in `ChartPane` header when `stale || DISCONNECTED || RECONNECTING`.
- **429 handling** — `utils/errors.ts` (`RateLimitError`,
  `parseRetryAfterSeconds`); initial-load auto-retry ×5 with backoff
  15/30/60/120/120 s (Retry-After as floor); "Rate limited — retrying in Ns"
  banner with 1 Hz countdown in `ChartPane`.
- **Status normalization** — `SYSTEM_STATUS` is lowercased upstream;
  `useStockChart` maps it via `.toUpperCase()`.
- **Sync history-apply (sub-task A)** — initial-history and gap-fill apply run
  in a synchronous `useEffect` (`historyVersion` bump), so a malformed payload
  throws during React's commit where the per-pane `ErrorBoundary` can catch it.
  API base overridable via `VITE_API_BASE_URL` (default
  `http://localhost:8000`) so E2E/perf can point panes at a mock WS server.

**Backend (`src/`)**
- **Typed exceptions** — `providers/exceptions.py`
  (`DataProviderError`, `RateLimitExceeded`, `UpstreamError`);
  `alpha_vantage.py` raises them; `main.py` maps
  `RateLimitExceeded→429` (with `Retry-After: 15` header),
  `UpstreamError→502`, other→500. Tests in `tests/test_api.py` use distinct
  symbols (`TESTRL`/`TESTUS`/`TESTUN`) to bypass the module-level
  `_history_cache`.

**E2E suite (Playwright, chromium, `frontend/e2e/`)**

- `workspace.spec.ts` — load, indicator toggle, add/close pane, symbol
  persistence (`stocker.workspace.v1`).
- `rate-limit.spec.ts` — 429 banner with countdown, then retry succeeds.
- `error-boundary.spec.ts` — malformed history payload contained per-pane;
  Retry works.
- `perf.spec.ts` — 20 Hz tick flood against a deterministic mock WS server
  (`ws-mock-server.mjs`, port 8123, `PRICE_UPDATE` every 50 ms) with a
  dedicated Vite dev server on 5174 (`VITE_API_BASE_URL=http://localhost:8123`).

## Test results (final green, sub-task D)

| Suite | Result |
| --- | --- |
| Backend (`python -m pytest tests/`) | 12/12 passed |
| Frontend unit (`npm test`, Vitest) | 34/34 passed |
| E2E journeys (`npx playwright test`) | 3 journeys + 1 perf test, all passed |
| Build (`npm run build`) | clean |

## How to run each suite

```bash
# Backend
python -m pytest tests/

# Frontend unit tests
cd frontend && npm test

# Build
cd frontend && npm run build

# E2E (Playwright starts Vite :5173 + uvicorn :8000 automatically)
cd frontend && npx playwright test
```

Notes: `npx playwright test` includes `perf.spec.ts`, which spawns its own
Vite instance on 5174 and the WS mock on 8123; no other setup required. The
perf spec's 10 s window makes a full E2E run take ~1 minute. Any `npm i` in
`frontend/` must use `--legacy-peer-deps` (pre-existing vite 8 vs
`@vitejs/plugin-react-swc` peer conflict).

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

## Known limitations

- **CORS is wide open** — the FastAPI app uses
  `allow_origins=["*"]`; fine for local dev, must be locked down before any
  production exposure.
- **WS has no HTTP status channel** — an upstream rate limit on the streaming
  path cannot return a 429, so it surfaces as WS disconnect/reconnect plus the
  stale-data pill rather than the REST 429 banner.
- **Render-count hook is React 18-inert** — the
  `__REACT_DEVTOOLS_GLOBAL_HOOK__` renderPhase stub only yields counts on React
  builds that call it (React 19+ / react-reconciler devtools protocol); on
  React 18 the DOM-output measurement above is authoritative.
- **E2E WS uses the `MockStreamProvider`** — mock message types are not
  consumed as candles; journeys assert on status labels and UI behavior, not
  tick rendering (the perf spec covers tick throughput separately).
- **Alpha Vantage requires an API key** for real data; the backend runs
  against the mock provider when none is configured. Never commit `.env`.
