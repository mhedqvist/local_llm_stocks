# Handoff: Feature 9 — Remaining Work (E2E, Perf, Docs)

You are an expert QA Engineer (Frontend + Backend) continuing Feature 9 (QA & Robustness)
for the Stocker dashboard. Phases 1–3 are **done and committed**. The remaining work is
split into four small sub-tasks (A→D) that can be executed in fresh, small contexts.

## Where things stand

- `python -m pytest tests/` → **12/12 passed**
- `cd frontend && npm test` (Vitest) → **34/34 passed**
- `cd frontend && npm run build` → clean
- Git commits on `main`: `fc411f1` (plan), `2531b5f` (indicator tests + RSI fix),
  `e3f79f3` (resilience). **Working tree has one uncommitted change**:
  `frontend/src/hooks/useStockChart.ts` — stale thresholds aligned to the plan
  (`1m:90s, 5m:600s, 15m:1800s, 60m:5400s, 1h:5400s, daily:86400s, default:300s`).
  Keep it; fold into the next commit.

### Completed (do not redo)
1. **Vitest indicator suite** — `frontend/src/utils/indicators.test.ts` (34 tests,
   hand-computed references). RSI flat-series fix: `0/0 → 50` via `rsiFromAverages`.
2. **Error boundaries** — `frontend/src/components/ErrorBoundary.tsx`
   (props `{ label, children, fallback? }`, key-bump Retry). Per-pane in
   `WorkspaceGrid.tsx`; top-level around `<main>` in `App.tsx`.
3. **Stale-data** — `useStockChart` returns `stale` (2 s interval, per-resolution
   thresholds, ≤1 setState per transition); amber "Stale" pill in `ChartPane`
   header when `stale || DISCONNECTED || RECONNECTING`.
4. **429 handling** — `frontend/src/utils/errors.ts` (`RateLimitError`,
   `parseRetryAfterSeconds`); initial-load auto-retry ×5 with backoff
   15/30/60/120/120 s (Retry-After as floor); "Rate limited — retrying in Ns"
   banner with 1 Hz countdown in `ChartPane`.
5. **Status normalization** — `SYSTEM_STATUS` lowercase→`.toUpperCase()` in
   `useStockChart` (backend sends lowercase).
6. **Backend typed exceptions** — `src/providers/exceptions.py`
   (`DataProviderError`, `RateLimitExceeded`, `UpstreamError`); `alpha_vantage.py`
   raises them; `src/main.py` maps `RateLimitExceeded→429` (with `Retry-After: 15`
   header), `UpstreamError→502`, other→500. Tests in `tests/test_api.py` use
   distinct symbols (`TESTRL`/`TESTUS`/`TESTUN`) to bypass the module-level
   `_history_cache`.
7. `AGENTS.md` has a tool-use constraints section (output-token limits) — **follow
   it**: cap `write` payloads at ~250 lines, chunk large files with unique
   `// __NEXT_SECTION__` markers + edit-append.

## Sub-task A — two small frontend changes (needed by E2E/perf)

1. **`frontend/src/App.tsx`**: make the API base overridable so the perf test can
   point panes at a mock WS server:
   ```ts
   const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
   ```
   (`useStockChart` builds WS URLs as `${apiBaseUrl}/api/ws/{symbol}`.)
2. **`frontend/src/hooks/useStockChart.ts`**: make the initial history apply (and
   gap-fill apply) run in a **synchronous `useEffect`** instead of inside the async
   fetch callback, so a malformed payload throws during React's commit where the
   per-pane `ErrorBoundary` can catch it (E2E journey 3 depends on this):
   - add state `historyVersion` (number);
   - new sync effect `[historyVersion, updateIndicators]`: if version > 0 and
     `historyRef.current` non-empty → `seriesRef.current.main.setData(toCandles(...))`,
     set `lastTimestampRef`/`firstCandleRef`, reset `lastTickAtRef = Date.now()`,
     `setStale(false)`, `setCurrentPrice(...)` (use existing `calculateChange`),
     `updateIndicators(history)`;
   - `loadHistoryAndConnect` becomes: `fetch → historyRef.current = history →
     setHistoryVersion(v => v+1) → connectWebSocket()`;
   - `performGapFilling` becomes: `fetch → historyRef.current = history →
     setHistoryVersion(v => v+1)` (on `RateLimitError` keep the existing banner
     behavior, no auto-retry there).
   Keep everything else (throttled price renders, tick handlers, cleanup) unchanged.
   **Verify after**: `npm run build` clean, `npm test` green, backend pytest green.
   Commit A (include the pending stale-threshold change).

## Sub-task B — Playwright E2E (3 journeys)

Setup:
- `npm i -D @playwright/test --legacy-peer-deps` (peer conflict with vite 8 /
  plugin-react-swc is pre-existing; `--legacy-peer-deps` is the standing rule),
  then `npx playwright install chromium`.
- `frontend/playwright.config.ts`: chromium only, `testDir: 'e2e'`,
  `use.baseURL: 'http://localhost:5173'`, `webServer` array:
  - `vite --port 5173 --strictPort` (cwd `frontend/`)
  - `python -m uvicorn src.main:app --port 8000` (cwd repo root,
    `url: 'http://localhost:8000/health'`)
  both with `reuseExistingServer: true`.
- `npm run e2e` script in `frontend/package.json`: `"e2e": "playwright test"`.
- **REST mocked** via `page.route('**/api/history/**', ...)` returning a
  deterministic fixture of ~60 daily candles (build it in `e2e/fixtures.ts` with a
  formula, e.g. `close = 100 + i*0.5 + 2*sin(i/3)`; no `Math.random`).
- **WS is the real backend** (`MockStreamProvider`; no API key needed). The mock's
  message types are not consumed as candles — assert on status label ("Live" from
  `ConnectionStatusIndicator`) and UI journeys, not tick rendering.

Journeys (`frontend/e2e/*.spec.ts`). Useful selectors (verified in source):
- pane symbol input: `aria-label="Symbol for pane {id}"` (id = random UUID; use
  `.first()` when one pane exists); commit with Enter.
- resolution buttons: text `1m`/`5m`/`1h`/`daily`; indicator toggles: text
  `SMA`/`EMA`/`RSI`/`MACD`/`BB`/`Vol` (enabled class contains `bg-emerald-700`).
- close pane: `button[title="Remove pane"]`; price line: `$<price.toFixed(2)>`
  text; error banner: red div with the message; status pill text:
  `Connecting.../Live/Disconnected/Reconnecting.../Paused`.
- Workspace add-pane control: check `src/components/WorkspaceHeader.tsx` (not yet
  read in this session — read it first).

1. **`workspace.spec.ts`** — load → default pane shows fixture price (compute from
   fixture, assert not `---`); toggle SMA → button enabled class flips, no console
   errors (listen for `page.on('console')` type error); Add pane → 2 panes, second
   shows its price; close it → 1 pane; set symbol to `MSFT` (Enter) → reload →
   input still `MSFT` (persisted in `stocker.workspace.v1`).
2. **`rate-limit.spec.ts`** — history route: 1st call → **429** with
   `Retry-After: 2`, later calls → 200 fixture. Assert banner matches
   `/Rate limited — retrying in \d+s/`; then after the first retry succeeds
   (frontend waits `max(15s, Retry-After)` — expect ~15 s; use a 45 s action
   timeout), price renders and banner clears.
3. **`error-boundary.spec.ts`** — seed `stocker.workspace.v1` via
   `page.addInitScript` (two panes: `MSFT` normal + `BROKEN`), history route for
   `BROKEN`: 1st call → 200 with **malformed JSON object** `{"corrupt":true}` (not
   an array → `history.map is not a function` in the sync apply effect, caught by
   the boundary; Sub-task A is what makes this catchable), 2nd+ calls → valid
   fixture. Assert: `BROKEN failed to render` card + `Retry` button in that pane;
   workspace header + MSFT pane still interactive (price visible); click Retry →
   BROKEN pane shows its fixture price. (Supersedes the plan's
   "garbage indicator params" idea — NaN can't survive JSON, and indicator math
   doesn't throw in render; the malformed-payload trigger is deterministic.)

Commit B after all three pass: `npx playwright test` green.

## Sub-task C — Performance verification

- `e2e/ws-mock-server.mjs`: Node HTTP+WS server on port **8123**
  (`npm i -D ws --legacy-peer-deps`); for any `/api/ws/{symbol}` upgrade, send
  `PRICE_UPDATE` JSON at **20 Hz** with monotonically increasing OHLCV
  (same-second timestamps are fine — `series.update()` merges them).
- `e2e/perf.spec.ts`:
  - spawn the WS mock (child process) and a **separate** vite dev server on
    **5174** with env `VITE_API_BASE_URL=http://localhost:8123`
    (child_process spawn with merged env; kill both in `afterAll`).
  - REST route → 1m fixture; seed workspace with **4 panes at `1m`**
    (valid `WorkspaceState` shape: `{ version: 1, panes: [{id, symbol, resolution,
    indicators: defaultIndicators()}...], activePaneId }` — see
    `src/types/workspace.ts` for `defaultIndicators()`).
  - render counting via `page.addInitScript` installing
    `window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { _counts: {}, inject(){},
    renderPhase(_, fn){ const n = fn?.displayName || fn?.name || 'Anonymous';
    this._counts[n] = (this._counts[n]||0)+1; } }` (React 18 dev mode calls
    `renderPhase`; dev server ⇒ dev React build).
  - measure over a 10 s tick window; **acceptance**: `ChartPane` renders ≈
    mounts(4) + ~4/s × 10 s (250 ms price throttle) + status transitions —
    i.e. **no per-tick renders** (assert well under, say, 150 total); `App` only
    from user actions. Record measured numbers in the docs.
  - **Fallback** (if the hook counts come back empty/flaky): static audit of the
    tick path (`ws.onmessage` → refs + `series.update()` only; single throttled
    `setCurrentPrice`) with code references. Document whichever method was used.
- Commit C.

## Sub-task D — Docs + final green

- `docs/implemented/feature-9.md`: what was built, test results (34 unit, 12
  backend, 3 E2E journeys, perf numbers), how to run each suite, known
  limitations (e.g. CORS `allow_origins=["*"]` still wide open; WS has no HTTP
  status channel so WS-side rate limits surface as reconnect + stale pill).
- Update `docs/roadmap.md` (Feature 9 done) and the Feature 5 status note in
  `docs/planning/feature-specs.md` (it currently defers error boundaries/429 UX
  to Feature 9 — mark resolved).
- Final green: `python -m pytest tests/` · `npm run build` · `npm test` ·
  `npx playwright test` all pass. Commit D.

## Standing constraints / gotchas
- `--legacy-peer-deps` for any `npm i` in `frontend/` (vite 8 vs
  `@vitejs/plugin-react-swc` peer conflict is pre-existing).
- Never `setState` per WS tick (throttle/refs pattern).
- Do not commit `.env` (Alpha Vantage key). Backend needs `requirements.txt`
  installed incl. `websockets` for WS upgrades to work.
- `AGENTS.md` tool-use constraints section governs large writes (chunk with
  `// __NEXT_SECTION__` markers).
- Green criteria at every step: backend pytest · `npm run build` · `npm test`
  · E2E (once added) all pass.
