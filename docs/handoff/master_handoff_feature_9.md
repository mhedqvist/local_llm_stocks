# Handoff Prompt: Feature 9 - QA & Robustness

You are an expert QA Engineer (with Backend and Frontend capability) tasked with continuing the Stocker dashboard.

### Project Overview
Stocker is a high-performance, "btop-like" stock monitoring dashboard. It provides real-time and historical market data, with a multi-chart workspace (independent chart panes, synchronized crosshairs and time scales). **All 8 features are implemented and verified.** The remaining goal is production readiness: rigorous testing, resilience to network/API failures, and performance confidence.

### Current Project State
- **Feature 1 (Data Ingestion - Historical):** COMPLETED. `GET /api/history/{symbol}?resolution={1m|5m|15m|60m|1h|daily}` (FastAPI + Alpha Vantage, modular provider, 5-min cache). Resolutions are exactly `daily, 1h, 1m, 5m, 15m, 60m` — nothing else (400 otherwise).
- **Feature 2 (Real-Time Streaming Proxy):** COMPLETED. `WS /api/ws/{symbol}` — one upstream connection per symbol, broadcast to all clients (`src/core/connection_manager.py`, `src/services/upstream_manager.py`). **Requires the `websockets` pip package** (in `requirements.txt`); without it uvicorn 404s every WS upgrade.
- **Feature 3 (Interactive Charting Engine) + Feature 8 (Multi-Asset Workspace):** COMPLETED. `frontend/src/hooks/useStockChart.ts` is fully instance-local — one hook instance per pane, each owning its WS (REST history → WS ticks, exponential backoff, gap-fill, `INACTIVE` mode when the tab is hidden, 250 ms-throttled price state, `autoSize: true`).
- **Feature 4 (Dashboard UI & Controls):** COMPLETED (now folded into per-pane toolbars).
- **Feature 5 (SMA/EMA) & 7 (MACD, Bollinger, RSI, Volume):** COMPLETED. All indicator math is client-side in `frontend/src/utils/indicators.ts`.
- **Feature 6 (Watchlist & Persistence):** COMPLETED.
- **Feature 8 (Multi-Asset Workspace):** COMPLETED. Panes in `types/workspace.ts` + `hooks/useWorkspace.ts` (persisted at `stocker.workspace.v1`); cross-pane sync via the framework-free `WorkspaceSync` singleton (`lib/workspaceSync.ts`); layout in `components/WorkspaceGrid.tsx` (deterministic CSS Grid); per-pane UI in `components/ChartPane.tsx`.
- **Feature 9 (QA & Robustness):** **CURRENT TASK** — plan at `docs/planning/feature-9-plan.md`.
- **Deferred (out of scope):** Customization Engine (themes, indicator styling).

### Repository Health (verified at handoff time)
- `python -m pytest tests/` → **9/9 passed**
- `cd frontend && npm run build` → **clean** (tsc + vite, ~322 kB JS)
- Live-verified in browser: history 200s, WS handshake 101 + live ticks on all panes, crosshair/time sync working, workspace persists across reloads
- Backend runs: `uvicorn src.main:app --port 8000` (reads `.env`); frontend `npm run dev` in `frontend/` (or from repo root: `npm run backend` / `npm run dev` — root `package.json` delegates).
- Git: pushed to GitHub (`mhedqvist/local_llm_stocks`, branch `main`). `.env` (API key) is git-ignored — do **not** commit it.

### Key Architecture Notes (read these before writing code)
1. **Indicator math** lives in `frontend/src/utils/indicators.ts` (pure functions) — the prime target for unit tests. `useStockChart.ts` consumes it per tick; do not change its behavior without tests proving equivalence.
2. **lightweight-charts v4.2.3** API gotchas (already fixed once, don't regress): `setCrosshairPosition(price, time, seriesApi)` takes an `ISeriesApi`, not a string; `MouseEventParams.seriesData` is a `Map`; `Range<Time>` (no `TimeRange`); explicit `unsubscribe*` methods; `autoSize: true` (do NOT re-add manual window-resize handlers).
3. **High-frequency path discipline:** WS ticks update series via refs; React state is throttled (250 ms). Any new status/staleness state must follow the same pattern — never `setState` per tick.
4. **Error surfaces today:** per-pane red error banner (fetch failures), `ConnectionStatusIndicator` per pane/watchlist, WS backoff retry loop. What's missing (the point of this feature): React error boundaries, stale-data indication, user-facing 429 handling, and automated tests.
5. **Backend 429s** are raised by `src/main.py` when Alpha Vantage rate-limits (free tier: 5 calls/min per symbol) — multi-pane setups hit this; clients currently just show the fetch error.

### Your Objective: Feature 9 (QA & Robustness)
1. **Unit tests — indicator math:** full coverage of `frontend/src/utils/indicators.ts` (SMA, EMA, RSI, MACD, Bollinger) against hand-computed reference values, edge cases (series shorter than period, all-equal prices, missing values). Introduce **Vitest** (`frontend/devDependencies`) with a test script in `frontend/package.json`; keep `npm run build` and `npm run dev` untouched.
2. **Resilience & error handling:**
   - React **error boundaries** so one broken pane/component cannot crash the workspace (boundary per pane + a top-level boundary).
   - **Stale-data indicator**: when WS is down/reconnecting, mark affected panes visually (data age or status), reusing the existing backoff/gap-fill logic.
   - **429 handling:** distinguish rate-limit errors in fetch/WS paths; show a clear "rate limited, retrying in Ns" state instead of a generic error.
3. **E2E tests (stretch goal — attempt only if 1–2 are solid):** Playwright for the critical journeys: load a symbol, toggle an indicator, add/remove a pane, workspace persistence across reload. A backend-mocked or live-backend setup is acceptable; document how to run it.
4. **Performance check:** verify with the browser devtools that N panes at 1m resolution keep React renders off the hot path (no per-tick renders beyond the throttled price line); record findings in the implementation doc.

### Workflow & Instructions
1. **Read Documentation First:** `AGENTS.md`, `docs/planning/feature-9-plan.md`, `docs/planning/feature-specs.md`, `docs/implemented/feature-8.md`, and skim `frontend/src/utils/indicators.ts`, `frontend/src/hooks/useStockChart.ts`, `frontend/src/components/ChartPane.tsx`, `src/main.py`.
2. **Phase 1 - Planning:** extend `docs/planning/feature-9-plan.md` into a concrete plan (test matrix for indicators, error-boundary placement, stale-data state machine, 429 flow, E2E scope).
3. **Phase 2 - Implementation:** tests first (red/green), then resilience work. Keep `pytest` green, `npm run build` clean, and the new frontend tests green at every step.
4. **Phase 3 - Documentation:** write `docs/implemented/feature-9.md` (test results, coverage, performance findings) and update `docs/roadmap.md`. Commit with descriptive messages; push is optional.

Please acknowledge these instructions and begin by drafting the implementation plan in `docs/planning/feature-9-plan.md`.
