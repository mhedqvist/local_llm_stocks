# Handoff Prompt: Feature 8 - Multi-Asset Workspace

You are an expert Frontend Engineer (with Backend capability) tasked with continuing the Stocker dashboard.

### Project Overview
Stocker is a high-performance, "btop-like" stock monitoring dashboard. It provides real-time and historical market data with zero-latency visualization. It is **not** a single-chart app in the making — the next goal is a multi-chart, professional trading workspace.

### Current Project State
- **Feature 1 (Data Ingestion - Historical):** COMPLETED. `GET /api/history/{symbol}?resolution={1m|5m|15m|60m|1h|daily}` (FastAPI + Alpha Vantage, modular provider pattern, 5-min response cache).
- **Feature 2 (Real-Time Streaming Proxy):** COMPLETED. `WS /api/ws/{symbol}` — transparent proxy: single upstream connection per symbol, broadcast to all clients (see `src/core/connection_manager.py`, `src/services/upstream_manager.py`).
- **Feature 3 (Interactive Charting Engine):** COMPLETED. `ChartContainer.tsx` + `useStockChart.ts` hook (hybrid REST + WS loading, `.update()` for live ticks, exponential backoff, gap-filling on reconnect).
- **Feature 4 (Dashboard UI & Controls):** COMPLETED. `TickerHeader`, `ControlBar` (resolution selection), `ConnectionStatusIndicator`.
- **Feature 5 (SMA/EMA) & 7 (MACD, Bollinger, RSI, Volume):** COMPLETED. All indicator math is client-side in `frontend/src/utils/indicators.ts`; rendered via multi-series `useStockChart` with separate `priceScaleId` for oscillators.
- **Feature 6 (Watchlist & Persistence):** COMPLETED. `Watchlist.tsx`, `useWatchlistItem.ts` (per-symbol WS), `useLocalStorage.ts`.
- **Feature 8 (Multi-Asset Workspace):** **CURRENT TASK**.
- **Feature 9 (QA & Robustness):** PLANNED (`docs/planning/feature-9-plan.md`), not started.

### Repository Health (verified at handoff time)
- `python -m pytest tests/` → **9/9 passed**
- `cd frontend && npm run build` → **clean** (tsc + vite)
- Backend smoke-tested: `/health` OK, live Alpha Vantage history returns real data
- Git: baseline committed (2 commits). `.env` (API key) is git-ignored — do **not** commit it.

### Key Architecture Notes (read these before writing code)
1. **`useStockChart.ts` is currently single-instance.** `App.tsx` calls it once with a global `symbol`/`resolution`/`indicators` state. Feature 8 requires multiple independent chart instances — expect to refactor this into a per-pane hook instance or a registry, with each pane owning its own WS connection and indicator state.
2. **Backend already supports multiple symbols concurrently** — the connection manager keys upstream streams per symbol. Multi-pane = N client WS connections; no backend work strictly required.
3. **lightweight-charts v4 API** (v4.2.3 installed). Type gotchas (already fixed once, don't regress):
   - No exported `CandlestickSeries`/`LineSeries`/`HistogramSeries` types — use `ISeriesApi<'Candlestick'|'Line'|'Histogram'>`.
   - `Time` is a branded union (`UTCTimestamp | BusinessDay`); API timestamps are plain numbers. The `toCandle`/`toLinePoints`/`toHistogramPoints` cast helpers in `useStockChart.ts` show the established pattern.
4. **Indicator config types** `IndicatorConfig`/`IndicatorsConfig` are exported from `useStockChart.ts`; App persists them via `useLocalStorage`.
5. Run instructions: backend `uvicorn src.main:app --port 8000` (reads `.env`), frontend `cd frontend && npm run dev` (expects backend at `http://localhost:8000`).

### Your Objective: Feature 8 (Multi-Asset Workspace)
1. **Multi-pane layout:** a grid of independent chart panes; each pane has its own symbol, resolution, and indicator configuration. Pane add/remove. Persist workspace layout to localStorage.
2. **Synchronized crosshairs:** moving the mouse over one chart broadcasts the crosshair to all visible charts (`chart.setCrosshairPosition(...)`).
3. **Time scale synchronization:** zoom/scroll on one pane's time axis aligns all other panes to the same visible range (`timeScale().applyOptions({ rightOffset })` + `subscribeVisibleTimeRangeChange`).
4. **Performance:** only visible/active panes should stream; keep high-frequency updates off the React render path (use refs, as `useStockChart` already does).

### Workflow & Instructions
1. **Read Documentation First:** `AGENTS.md`, `docs/planning/feature-specs.md`, `docs/planning/feature-8-plan.md`, `docs/implemented/feature-7-advanced-technical-analysis.md`, and skim `frontend/src/hooks/useStockChart.ts` + `frontend/src/App.tsx` (the files you will be refactoring most).
2. **Phase 1 - Planning:** extend/create the implementation plan in `docs/planning/feature-8-plan.md` covering: pane state model, layout approach (custom CSS Grid vs `react-grid-layout`), crosshair/time-sync mechanism, WS lifecycle per pane, and persistence schema.
3. **Phase 2 - Implementation:** follow your plan; keep `npm run build` clean and `pytest` green at every step.
4. **Phase 3 - Documentation:** write `docs/implemented/feature-8.md` and update `docs/roadmap.md` when complete. Commit with descriptive messages.

Please acknowledge these instructions and begin by drafting the implementation plan in `docs/planning/feature-8-plan.md`.
