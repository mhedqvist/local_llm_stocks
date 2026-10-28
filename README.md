# Stocker

A high-performance, "btop-like" stock monitoring dashboard with real-time and historical
market data. Multi-asset workspace: open any number of chart panes, each with its own
symbol, resolution, indicators, and WebSocket stream — with synchronized crosshairs and
time scales.

> **Note on development:** All features in this repository were implemented by small local
> LLMs (via agent handoff prompts) as an experiment in how far compact models can take a
> software project. See the handoff prompts in `docs/handoff/` and the per-feature
> planning/implementation docs in `docs/` for the full record.

## Features (all completed)

| # | Feature | Status |
|---|---------|--------|
| 1 | Data Ingestion Engine (historical) | Done |
| 2 | Real-Time Streaming Proxy (WebSocket) | Done |
| 3 | Interactive Charting Engine | Done |
| 4 | Dashboard UI & Controls | Done |
| 5 | Technical Indicators (SMA/EMA) | Done |
| 6 | Watchlist & Persistence | Done |
| 7 | Advanced Technical Analysis (RSI, MACD, Bollinger, Volume) | Done |
| 8 | Multi-Asset Workspace (panes, synced crosshair/time scale) | Done |

Next on the roadmap: **Feature 9 — QA & Robustness** (`docs/planning/feature-9-plan.md`).

## Architecture

- **Backend** — Python / FastAPI. `GET /api/history/{symbol}?resolution={1m|5m|15m|60m|1h|daily}`
  (Alpha Vantage provider, 5-min response cache) and `WS /api/ws/{symbol}` (transparent
  streaming proxy: one upstream connection per symbol, broadcast to all connected clients).
- **Frontend** — React 18 + TypeScript + Vite + Tailwind CSS 4 + `lightweight-charts`.
  Each pane is an independent `useStockChart` hook instance (REST history → WS live ticks,
  exponential backoff, gap-fill on reconnect). Cross-pane synchronization goes through a
  framework-free `WorkspaceSync` singleton (no React render-tree involvement).

## Running

Two terminals from the repository root:

```bash
# Backend (API + WS proxy on :8000) — requires a venv with requirements.txt installed
# and ALPHA_VANTAGE_API_KEY in .env
pip install -r requirements.txt
npm run backend        # uvicorn src.main:app --reload

# Frontend (Vite dev server on :5173)
npm install --prefix frontend
npm run dev
```

## Project layout

```
src/            # FastAPI backend (providers, services, connection management)
frontend/       # React app
tests/          # Backend pytest suite
docs/
  handoff/      # Agent handoff prompts (one per feature)
  planning/     # Feature plans & specs
  implemented/  # Per-feature implementation records
  adr/          # Architecture decision records
  roadmap.md    # Feature roadmap
```

## Development process

Each feature was driven by a handoff prompt (`docs/handoff/master_handoff_feature_N.md`)
given to a small local model, which planned in `docs/planning/`, implemented, self-verified
(build + tests), wrote the implementation record in `docs/implemented/`, and committed.
The handoffs carry the full project state so a fresh model instance can continue without
session memory.
