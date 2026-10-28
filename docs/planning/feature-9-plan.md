# Feature 9 Implementation Plan: QA & Robustness

## Overview
Transition the application from a feature-complete prototype to a production-ready, reliable
software product through rigorous automated testing, targeted error handling, and a documented
performance verification.

## Scope
1. **Unit tests** for all indicator math (`frontend/src/utils/indicators.ts`) with Vitest.
2. **Resilience & error handling**: React error boundaries, stale-data indication, user-facing
   429 (rate-limit) handling.
3. **E2E tests** (stretch): Playwright for critical journeys, with mocked REST + real backend WS.
4. **Performance verification**: prove N high-frequency panes keep React renders off the tick
   hot path.
5. **Backend test additions**: 429 / 502 error-mapping coverage for `GET /api/history`.

Non-goals: theming/customization engine (deferred), backend streaming protocol changes,
candle aggregation fixes, upstream-provider (Alpha Vantage) live tests.

---

## 1. Unit tests — indicator math (Vitest)

### Setup
- Add `vitest` to `frontend/devDependencies`; add scripts `test: "vitest run"` and
  `test:watch: "vitest"` to `frontend/package.json`. `npm run build` and `npm run dev`
  stay untouched. Vitest's default include (`**/*.test.ts`) finds
  `frontend/src/utils/indicators.test.ts`; no config file needed.

### Test matrix
All data is hand-computed reference values. Helper `mk(t, o, h, l, c, v)` builds OHLCV points
with strictly increasing `time`.

| Indicator | Cases |
|---|---|
| **SMA** | hand-computed values (period 3 on 5 closes); `len < period` → `[]`; `len == period` → exactly 1 point; all-equal prices → constant line equal to that price; period 1 → identity of close; empty input → `[]`; uses index order (gaps in timestamps do not affect values) |
| **EMA / EMA_Generic** | hand-computed seed + recurrence (period 2 on 5 closes: seed = SMA2, k = 2/3); `len < period` → `[]`; `len == period` → 1 point; all-equal → constant; period 1 → tracks close exactly (k = 1); `calculateEMA` ≡ `calculateEMA_Generic` on mapped closes |
| **RSI** | hand-computed Wilder seed + smoothing (period 3); `len <= period` → `[]`; all-gains → 100; all-losses → 0; value always in [0, 100]; **all-flat → 50** (see fix below) |
| **MACD** | hand-computed with small periods (fast 2, slow 3, signal 2); `len < slowPeriod` → `[]`; `histogram === macd − signal` at every point; all-equal prices → all zeros; result starts at index `slowPeriod + signalPeriod − 2` (both EMAs + seed aligned); default periods need `len >= 26` |
| **Bollinger** | hand-computed (period 3, multiplier 2, population std-dev); `len < period` → `[]`; `len == period` → 1 point; all-equal → `upper == middle == lower`; custom multiplier scales bands symmetrically around `middle` |
| **Volume** | maps `time`/`volume` identity for all points; empty → `[]` |

### One sanctioned behavior fix (proven by tests first)
`calculateRSI` returns `NaN` when every price is flat (`0/0` in `avgGain / avgLoss`).
Guard: when `avgGain === 0 && avgLoss === 0`, emit `50` (neutral) at every point. The test
asserts `50` **after** the fix; all other reference-value tests prove equivalence with the
pre-fix behavior (they pass unchanged).

## 2. Resilience & error handling

### 2a. Error boundaries
- New `frontend/src/components/ErrorBoundary.tsx`: class component, `getDerivedStateFromError`
  + `componentDidCatch`, props `{ label, children, onReset? }`. Fallback = a compact card
  ("{label} failed to render" + error message + **Retry** button that remounts children via
  an internal key bump).
- **Per-pane boundary**: `WorkspaceGrid` wraps each `ChartPane` in an `ErrorBoundary`
  (`label={pane.symbol}`) so one broken pane cannot crash the workspace.
- **Top-level boundary**: `App` wraps `<main>` content in an `ErrorBoundary` whose fallback
  offers **Reload**.
- No behavior change to panes that work normally.

### 2b. Stale-data indication (state machine)
States already exist: `CONNECTING / CONNECTED / DISCONNECTED / RECONNECTING / INACTIVE`.
Add a derived `stale` flag in `useStockChart`:

- `lastTickAtRef` (wall clock, ref — **no per-tick setState**) set on every `PRICE_UPDATE`.
- A single 2 s interval (mounted only while `active && status === 'CONNECTED'`) compares
  `Date.now() − lastTickAtRef` against a per-resolution threshold:
  `1m → 90 s, 5m → 10 min, 15m → 30 min, 60m → 90 min, 1h → 90 min, daily → 24 h, default → 5 min`.
- `stale` React state flips only when the boolean actually changes (≤ 1 setState per
  transition) — stays off the hot path.
- Reset `lastTickAtRef` and clear `stale` on (re)connect (`performGapFilling` success).
- UI: `ChartPane` price line shows an amber **"Stale"** pill when
  `stale || status === 'DISCONNECTED' || status === 'RECONNECTING'`; existing
  `ConnectionStatusIndicator` already covers the reconnecting visual.
- Existing backoff/gap-fill untouched; staleness is purely observational.

### 2c. 429 (rate-limit) handling
- `fetchHistoricalData` distinguishes HTTP 429: parses `Retry-After` header (seconds;
  default 15) and throws `RateLimitError(retryAfterSeconds, message)`
  (`frontend/src/utils/errors.ts`).
- **Initial load** (effect setup): on `RateLimitError`, set `error = "Rate limited by data
  provider"` and `rateLimit: { retryAt }` state, then auto-retry up to **5 times** with
  backoff `15 s → 30 s → 60 s → 120 s → 120 s` (respecting `Retry-After` as the floor). Each
  retry re-runs history fetch + WS connect. After the final retry the pane keeps a clear
  "Rate limited" error banner.
- **UI countdown**: `ChartPane` renders `"Rate limited — retrying in Ns"` while
  `rateLimit.retryAt` is in the future; a 1 s interval in the pane updates `N` **only during
  the wait** (bounded setState, acceptable).
- **Gap-fill path** (`performGapFilling`): on 429, show the same rate-limit banner (no
  auto-retry loop there — the initial-load path owns retries; chart keeps last known data).
- **WS path**: a rate-limited backend surfaces as connection close → existing exponential
  backoff loop + `DISCONNECTED`/`CONNECTING` indicator + stale pill; documented in the
  implementation doc (WS itself has no HTTP status channel).

### 2d. Small status normalization fix
`SYSTEM_STATUS` messages arrive from the backend lowercase (`"connected"`,
`"reconnecting"`); the frontend union is uppercase, so they currently fall through to the
generic "Disconnected" display. Normalize with `String(message.status).toUpperCase()`
before `updateStatus` (unknown values keep today's fallback behavior).

## 3. E2E tests (Playwright) — stretch, included
### Harness
- `@playwright/test` in `frontend/devDependencies`; config `frontend/playwright.config.ts`
  (chromium only, `testDir: e2e`, webServer: `vite --port 4173 --strictPort` **preview
  build is not used** — dev server `vite --port 5173 --strictPort` for React dev mode).
- **REST mocked** with `page.route('**/api/history/**')` returning a fixture of ~60 daily
  candles (deterministic, hand-shapeable) with `Retry-After`-free 200s; a second route
  fixture returns 429 for the rate-limit journey.
- **WS real**: `playwright.config.ts` `webServer` also starts
  `python -m uvicorn src.main:app --port 8000` (`reuseExistingServer: true`). The WS path
  uses the in-repo `MockStreamProvider` and needs **no API key**, so the handshake works
  without `.env`. (The mock's raw message shape is not consumed as candles by the UI —
  acceptable: E2E asserts connection status + UI journeys, not tick rendering.)
- `npm run e2e` script; document in `docs/implemented/feature-9.md` (needs Python env with
  `requirements.txt` installed).

### Journeys (`frontend/e2e/*.spec.ts`)
1. `workspace.spec.ts`
   - load → default pane shows mocked price (not `---`);
   - toggle SMA → toolbar button state flips, no crash, no console errors;
   - `+ Add pane` → pane count 2, new pane shows its own price;
   - close a pane → back to 1;
   - change pane symbol to `MSFT` (type + Enter) → reload → input still shows `MSFT`
     (persistence via `stocker.workspace.v1`).
2. `rate-limit.spec.ts`
   - history route returns 429 with `Retry-After: 2` for one symbol → pane shows
     "Rate limited — retrying in Ns" instead of a generic error; after the first retry
     succeeds (route flips to 200), price renders.
3. `error-boundary.spec.ts`
   - seed `stocker.workspace.v1` with a pane whose indicator params are garbage (e.g.
     `period: NaN` via direct localStorage write) → pane shows the boundary card,
     workspace header + other panes remain interactive, **Retry** button restores the pane.

## 4. Performance verification
- Method (headless, scriptable): in the E2E environment load **4 panes at `1m`** and stream
  synthetic `PRICE_UPDATE` ticks at ~20 Hz per symbol from a small local Node WS server
  standing in for the backend (fixture `e2e/ws-mock-server.mjs`); REST history is mocked as
  above.
- Render counting: `page.addInitScript` injects a `__REACT_DEVTOOLS_GLOBAL_HOOK__.inject`
  shim (dev-mode React) that counts `renderPhase` events per component; sample render counts
  for `App`, `ChartPane`, `ConnectionStatusIndicator` over a 10 s window.
- **Acceptance**: with 4 panes × 20 Hz, `ChartPane` renders ≈ 1 (mount) + ≈ 4 × 10 s
  (250 ms price throttle) ± status transitions — i.e. **no per-tick renders**; `App`
  renders only from user actions. Record measured numbers in
  `docs/implemented/feature-9.md`.
- Fallback if devtools-hook counting proves flaky: static audit of the tick path
  (`useStockChart.onmessage` → refs + `series.update()` only; single throttled
  `setCurrentPrice`) recorded with code references.

## 5. Backend test additions (`tests/test_api.py`)
- Provider raising `RuntimeError("Rate Limit exceeded")` → `GET /api/history` returns **429**.
- Provider raising `RuntimeError("Network error talking to provider")` → **502**.
Both use the existing `dependency_overrides` fixture pattern.

---

## Phases & acceptance
1. **Tests first (red/green):** Vitest indicator suite (RSI-flat test red → fix → green).
2. **Resilience:** error boundaries, stale indicator, 429 handling, status normalization.
3. **E2E + perf:** Playwright journeys, render-count measurement.
4. **Docs:** `docs/implemented/feature-9.md` (results, coverage, perf numbers, how to run),
   `docs/roadmap.md` updated, `feature-specs.md` Feature 5 status note refreshed.

**Green criteria at every step:** `python -m pytest tests/` passes · `cd frontend && npm run build`
clean · `cd frontend && npm test` passes · E2E passes (when added).
