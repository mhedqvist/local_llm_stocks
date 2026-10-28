# Feature 8: Multi-Asset Workspace - Technical Implementation Details

## Overview
The dashboard is now a multi-chart, professional trading workspace. Users can open an
arbitrary number of independent chart **panes** — each with its own symbol, resolution,
indicator configuration, and WebSocket connection — and compare assets side-by-side with
synchronized crosshairs and time scales. The layout persists across sessions.

No backend changes were required: `src/core/connection_manager.py` already keys upstream
streams per symbol, so N client panes map to N client WS connections that share upstream
connections per symbol.

## Architecture

### New / Changed Files
| File | Role |
|------|------|
| `frontend/src/types/workspace.ts` | `PaneConfig`, `WorkspaceState`, `defaultIndicators()`, `newPaneId()`, defensive `normalizeWorkspace()`/`normalizeIndicators()` parsers |
| `frontend/src/lib/workspaceSync.ts` | `WorkspaceSync` singleton — crosshair + time-range broadcast/subscribe outside the React render tree |
| `frontend/src/hooks/useWorkspace.ts` | Persisted workspace state + `addPane`/`removePane`/`updatePane`/`setActivePane`; one-time migration from legacy single-chart localStorage keys |
| `frontend/src/hooks/useStockChart.ts` | Refactored for per-pane instances (see below) |
| `frontend/src/components/ChartPane.tsx` | Per-pane UI: toolbar (symbol, resolution, indicator toggles, close), price/status line, chart, sync wiring |
| `frontend/src/components/WorkspaceGrid.tsx` | Deterministic CSS Grid layout (1/2/3 columns by pane count) |
| `frontend/src/components/Watchlist.tsx` | New optional `onSelect` prop: clicking a symbol loads it into the active pane |
| `frontend/src/App.tsx` | Orchestrator: header with "+ Add pane", watchlist, grid, document-visibility tracking |
| `frontend/src/types/websocket.ts` | `ConnectionStatus` gained `'INACTIVE'` |
| `frontend/src/components/ConnectionStatusIndicator.tsx` | Renders `'INACTIVE'` as a grey "Paused" dot |

### `useStockChart` Refactor
- New options parameter: `{ active?: boolean; onChartReady?: (chart, mainSeries) => void }`.
  - `active: false` → the pane renders its chart shell but skips the historical fetch and
    WebSocket entirely (status `'INACTIVE'`). Flipping back to `true` re-runs the full setup
    (fetch + WS + gap-fill). Each pane is a fully independent hook instance; removing a pane
    unmounts it, closing its WS and removing its chart in the effect cleanup.
- `onChartReady(chart, mainSeries)` gives `ChartPane` the instances it needs to attach
  crosshair/time-scale subscriptions without leaking them into React state churn (one state
  update per chart creation).
- **Render-path hygiene**: `PRICE_UPDATE` ticks still mutate refs and call
  `series.update()` directly; the only per-tick React state (`currentPrice`) is now throttled
  to ~4 renders/s (latest value wins) so N high-frequency panes stay off the render hot path.
- `autoSize: true` (ResizeObserver) sizes each chart to its grid cell; the manual window
  resize handler was removed (it is redundant and could conflict with the observer).
- Symbol changes within a pane are committed on **Enter/blur** (draft state in `ChartPane`),
  so keystrokes do not re-trigger fetch + WS reconnect.

### Layout (custom CSS Grid)
No new dependencies. Column count is a deterministic function of pane count:
1 → 1 col, 2–4 → 2 cols (sm+), 5+ → 3 cols (xl+). Only pane order is persisted (no pixel
positions), which makes persistence trivial and the layout fully reflowable. Free-form
drag/resize (`react-grid-layout`) is intentionally deferred — see
`docs/planning/feature-8-plan.md` §2 for the rationale.

### Synchronization
`WorkspaceSync` (a plain singleton, deliberately not a React context) holds per-pane handler
maps for two event types:

1. **Crosshair** — each pane subscribes to `chart.subscribeCrosshairMove` and broadcasts
   `{ time, price }` (price read from this pane's main candlestick series via
   `param.seriesData`). Remote panes apply
   `chart.setCrosshairPosition(price, time, mainSeries)`, or
   `chart.clearCrosshairPosition()` on mouse-leave.
2. **Time scale** — each pane subscribes to
   `timeScale().subscribeVisibleTimeRangeChange` and broadcasts the `Range<Time>`. Remote
   panes apply `timeScale().setVisibleRange(range)`.

**Echo-loop prevention** (both mechanisms):
- Every broadcast carries `sourceId`; a pane ignores events where `sourceId === ownId`.
- Applying a remote range fires the pane's own range-change callback synchronously; a per-pane
  `applyingRemoteRangeRef` flag suppresses re-broadcast and is cleared on the next tick.

Subscriptions are attached in a `ChartPane` effect keyed on the chart instance and removed in
cleanup (plus `workspaceSync.forget(paneId)`), so removed panes never receive broadcasts.

Accepted limitation (documented in UI): the synced crosshair's *price* line is expressed in
the source pane's price scale, so on a pane with a different asset it marks a different
price level — the **time alignment** is the meaningful part for cross-asset comparison.

### Performance / streaming policy
- **Only active panes stream**: every visible pane owns its WS; all streams pause when the
  tab is hidden (`document.visibilitychange` → `active={docVisible}` on each pane) and
  reconnect + gap-fill on return, reusing the existing backoff/gap-fill logic.
- Crosshair broadcasts are plain function calls to lightweight-charts (no React involved).
- Per-pane indicator recompute on ticks is unchanged from Features 5/7 (O(N·period)); the
  throttled price state removes the dominant render cost.
- One upstream WS per symbol is shared across panes/client connections by the backend
  connection manager (Feature 2 behavior).

### Persistence
Key: `stocker.workspace.v1`
```json
{
  "version": 1,
  "panes": [
    {
      "id": "<uuid>",
      "symbol": "AAPL",
      "resolution": "1d",
      "indicators": { "sma": { "enabled": false, "params": { "period": 20 } }, "...": "..." }
    }
  ],
  "activePaneId": "<uuid>"
}
```
- First run with legacy single-chart keys (`resolution`, `indicators`) migrates them into one
  seeded pane; the watchlist key (`symbols`) is unchanged.
- `normalizeWorkspace()` defends against corrupt/foreign JSON (drops bad panes, falls back to
  defaults per field, guarantees ≥1 pane and a valid `activePaneId`).
- Workspace rules: minimum one pane; removing the active pane re-targets `activePaneId` to
  the first remaining pane; new panes default to the active pane's symbol at an intraday
  resolution for correlation scanning.

### lightweight-charts API notes (installed 4.2.3 typings)
- `subscribeCrosshairMove`/`subscribeVisibleTimeRangeChange` return `void`; use the explicit
  `unsubscribe*` methods in cleanup.
- `setCrosshairPosition(price, time, seriesApi)` requires the series on whose scale the price
  is expressed.
- The visible-range type is `Range<Time>` (no exported `TimeRange`); the change handler
  receives `Range<Time> | null`.
- `autoSize: true` (ResizeObserver) handles container resizes.

## Verification
- `npm run build` (tsc + vite) clean.
- `python -m pytest tests/` → 9/9 passed (backend untouched).
- Manual checks performed/expected in-browser:
  - Add/remove panes; layout + configs survive reload.
  - Moving the mouse over one pane moves the crosshair in all others; leaving clears it.
  - Zoom/scroll on one pane aligns all panes' time windows with no feedback loop.
  - Hiding the tab closes all WS streams; returning reconnects and gap-fills.
  - Removing a pane closes its WS (DevTools network) and frees its chart.
