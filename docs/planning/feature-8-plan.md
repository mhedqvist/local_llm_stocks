# Feature 8 Implementation Plan: Multi-Asset Workspace

## Overview
Transform the dashboard from a single-chart view into a multi-chart, professional trading
workspace. A user can open an arbitrary number of independent chart **panes** — each owning its
own symbol, resolution, indicator configuration, and WebSocket connection — and compare them
side-by-side with synchronized crosshairs and time scales.

## 1. Pane State Model

Each pane is a self-contained chart instance. State is split into:

- **`PaneConfig`** — persistent, per-pane configuration:
  ```ts
  interface PaneConfig {
    id: string;                    // stable id (crypto.randomUUID)
    symbol: string;
    resolution: string;            // '1m' | '5m' | '15m' | '60m' | '1h' | 'daily'
    indicators: IndicatorsConfig;  // per-pane (reuses existing type from useStockChart.ts)
  }
  ```
- **`WorkspaceState`** — the persisted workspace:
  ```ts
  interface WorkspaceState {
    version: 1;
    panes: PaneConfig[];
    activePaneId: string | null;   // pane currently selected for header/watchlist actions
  }
  ```
- **Ephemeral (non-persisted) state** lives in the `ChartPane` component: connection status,
  error, live price (throttled), the lightweight-charts `IChartApi` instance, and sync
  subscriptions.

Rules:
- Minimum 1 pane; adding a pane uses the active pane's symbol at a different resolution (or a
  default symbol) so the user immediately sees a correlation view.
- Removing the active pane moves `activePaneId` to the remaining first pane.
- The active pane is highlighted (border) and is the target of watchlist click-through.

## 2. Layout Approach

**Decision: custom CSS Grid** (no new dependency).

Rationale:
- `react-grid-layout` adds a heavy dependency and drag/resize machinery that is not required for
  v1; a deterministic auto-reflow grid is simpler, faster, and trivially persistable (we only
  store pane order, not pixel positions).
- Professional trading workspaces (TradingView, btop) use tiled layouts; free-form dragging is a
  v2 candidate (ADR can record this decision later).

Grid rules (deterministic function of pane count):
| Panes | Columns |
|-------|---------|
| 1 | 1 |
| 2 | 2 |
| 3–4 | 2 |
| 5–6 | 3 |
| 7–9 | 3 |
| 10+ | 3 (row scroll) |

Implemented as `grid-cols-{n}` Tailwind classes on a `grid` container; rows are
`grid-auto-rows` with each pane filling its cell. Pane add/remove buttons live in the header
toolbar; each pane has its own close (×) button.

## 3. Synchronization Mechanism

A small framework-free **`WorkspaceSync`** singleton (`frontend/src/lib/workspaceSync.ts`)
holds a `Map<paneId, handler>` per event type. No React context is needed (charts live outside
the React render tree).

### 3.1 Synchronized crosshairs
- Each pane calls `chart.subscribeCrosshairMove(param => ...)`.
  - Mouse over a pane → `sync.broadcastCrosshair({ time, price }, paneId)`.
  - Mouse leaves → `sync.broadcastCrosshair(null, paneId)` (clears others).
- Remote apply: `chart.setCrosshairPosition(price, time, 'right')` / `chart.clearCrosshairPosition()`.
- Loop safety: events carry `sourceId`; a pane ignores events where `sourceId === paneId`
  (`setCrosshairPosition` does not trigger other panes' `subscribeCrosshairMove`, so echo cannot
  chain, but the guard is kept for symmetry with time-scale sync).
- Note (accepted limitation): the crosshair price position is expressed in the *source* pane's
  price scale, so the horizontal line sits at a price value from another asset — the **time
  alignment** is what matters. Documented in the feature doc.

### 3.2 Time scale synchronization
- Each pane calls `chart.timeScale().subscribeVisibleTimeRangeChange(range => ...)`.
- On local zoom/scroll (not while applying a remote range — see suppression flag below), the pane
  broadcasts `sync.broadcastTimeRange(range, paneId)`.
- Remote apply: `chart.timeScale().setVisibleRange(range)` wrapped by a per-pane
  `applyingRemoteRangeRef` flag: set before applying, cleared in a `setTimeout(0)` so the
  synchronous re-entrant subscription callback is suppressed and echo loops are impossible.
- `rightOffset` is kept consistent automatically because `setVisibleRange` normalizes the range;
  panes with different data lengths simply show the same time window with their own data.
- Resolution differences: panes with different resolutions align by time window (not by candle
  index), which is the intended professional behavior.

### 3.3 Subscription lifecycle
- `ChartPane` sets up subscriptions in a `useEffect` keyed on `[paneId, chartInstance]` and
  returns a cleanup that unsubscribes and calls `sync.forget(paneId)`. This guarantees a removed
  pane never receives broadcasts.

## 4. `useStockChart` Refactor (per-pane instance)

The hook is already instance-local (all state is `useState`/`useRef` per call site), so calling it
once per `ChartPane` component is safe. Changes:

1. **New options parameter**:
   ```ts
   useStockChart(symbol, apiBaseUrl, resolution, indicatorsConfig, options?: {
     active?: boolean;                        // false → no fetch, no WS, status 'INACTIVE'
     onChartReady?: (chart: IChartApi) => void;  // one-shot callback for sync wiring
   })
   ```
2. **`active` handling**: when `active === false`, the hook initializes the chart shell (so the
   pane renders) but skips historical fetch and WS connection; status is `'INACTIVE'`.
   When it flips back to `true`, the effect re-runs the full setup (fetch + WS + gap-fill).
   This satisfies "only visible/active panes should stream".
3. **`onChartReady`** is invoked (via a ref, so no effect re-runs) when the chart instance exists,
   letting `ChartPane` attach crosshair/time-scale subscriptions.
4. **Render-path hygiene**: live `PRICE_UPDATE` ticks already mutate refs and call
   `series.update()` outside React. The one remaining per-tick React render is
   `setCurrentPrice`; we throttle it (state update at most every 250 ms, latest value wins) so
   N panes × high-frequency ticks stay off the render hot path.
5. **New `ConnectionStatus` value**: add `'INACTIVE'` to `types/websocket.ts` and to
   `ConnectionStatusIndicator` (grey dot, "Paused").
6. **Resize**: keep the existing window-resize width handling; each pane's chart sizes to its own
   container.

## 5. WebSocket Lifecycle per Pane

- **One WS per pane/symbol**: each active pane opens its own `ws://…/api/ws/{symbol}` connection
  via its `useStockChart` instance. The backend `connection_manager.py` already keys upstream
  streams per symbol, so multiple clients on the same symbol share one upstream connection —
  no backend changes required.
- **Open** → `CONNECTED`, gap-fill (re-fetch history) as today.
- **Close/error** → exponential backoff reconnect (existing logic, per-instance).
- **Pane removed** → React unmount → `ws.close()` + `chart.remove()` in the hook cleanup.
- **Tab hidden** → `document.visibilitychange` sets a global `docVisible` flag in `App`; each
  pane receives `active={docVisible}`, pausing all streams while the tab is backgrounded
  (reconnect + gap-fill on return, reusing existing gap-fill logic).
- **Symbol/resolution change within a pane** → effect re-runs: old WS closed, new fetch + WS,
  exactly the existing single-chart behavior.

## 6. Persistence Schema

Key: `stocker.workspace.v1` (new). Legacy keys: `symbols` (watchlist, kept), `resolution`,
`indicators` (single-chart era — migrated once, then ignored).

```jsonc
{
  "version": 1,
  "panes": [
    {
      "id": "9b1c…",
      "symbol": "AAPL",
      "resolution": "1d",
      "indicators": {
        "sma": { "enabled": false, "params": { "period": 20 } },
        "ema": { "enabled": false, "params": { "period": 20 } },
        "rsi": { "enabled": false, "params": { "period": 14 } },
        "macd": { "enabled": false, "params": { "fast": 12, "slow": 26, "signal": 9 } },
        "bollingerBands": { "enabled": false, "params": { "period": 20, "stdDev": 2 } },
        "volume": { "enabled": false, "params": {} }
      }
    }
  ],
  "activePaneId": "9b1c…"
}
```

Migration: if the new key is absent but legacy `resolution`/`indicators` exist, seed one pane
(`AAPL`, legacy resolution, legacy indicators). Invalid JSON / missing fields fall back to
defaults (defensive `normalizeWorkspace()`).

## 7. Component Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/types/workspace.ts` | `PaneConfig`, `WorkspaceState`, `defaultIndicators()` |
| `frontend/src/lib/workspaceSync.ts` | `WorkspaceSync` singleton (crosshair + time-range broadcast/subscribe) |
| `frontend/src/hooks/useWorkspace.ts` | Persisted workspace state + actions (`addPane`, `removePane`, `updatePane`, `setActivePane`), legacy migration, `normalizeWorkspace` |
| `frontend/src/hooks/useStockChart.ts` | Refactored: `options { active, onChartReady }`, throttled price state, `'INACTIVE'` status (see §4) |
| `frontend/src/components/ChartPane.tsx` | Per-pane UI: pane toolbar (symbol input, resolution buttons, compact indicator toggles, status dot, close), chart container, sync wiring |
| `frontend/src/components/WorkspaceGrid.tsx` | CSS Grid layout, column count from pane count, active-pane highlight, add-pane button |
| `frontend/src/App.tsx` | Orchestrator: header (title, workspace add/remove), watchlist, grid; `docVisible` tracking |

`TickerHeader` becomes the active pane's price readout in the header; per-pane headers carry a
compact price/status line. `ControlBar`/`IndicatorSettings` logic is reused compactly inside
`ChartPane`.

## 8. Phases & Acceptance Criteria

### Phase A — State & Layout
- [ ] `workspace.ts`, `useWorkspace.ts`, `WorkspaceGrid.tsx`
- [ ] `App.tsx` renders N panes; add/remove works; layout persists across reload
- [ ] `npm run build` clean

### Phase B — Per-pane hook refactor
- [ ] `useStockChart` accepts `active`/`onChartReady`; `'INACTIVE'` status
- [ ] Per-pane symbol/resolution/indicator changes are isolated to that pane
- [ ] Removing a pane closes its WS (verified in DevTools/network tab)
- [ ] `npm run build` clean

### Phase C — Synchronization
- [ ] Crosshair broadcast: moving mouse over pane A moves the crosshair in all other panes;
      leaving clears it
- [ ] Zoom/scroll on one pane's time axis moves all others to the same window; no infinite
      feedback loop
- [ ] `npm run build` clean

### Phase D — Performance & robustness
- [ ] Hidden tab pauses all WS streams (visibilitychange)
- [ ] Price state throttled (≤ 4 renders/s per pane)
- [ ] Removed panes fully cleaned up (no listeners, no sockets)

### Phase E — Documentation
- [ ] `docs/implemented/feature-8.md`
- [ ] `docs/roadmap.md` updated (Feature 8 → Done)
- [ ] `pytest` green (backend untouched, regression check)
- [ ] Commit with descriptive messages

## Risks & Mitigations
- **Echo loops in time-scale sync** → suppression flag + `sourceId` guard (§3.2).
- **Per-tick indicator recompute across N panes** → already O(N·period) per pane; acceptable up to
  ~6 panes; price-state throttling removes the dominant render cost.
- **Crosshair price across different price scales** → documented limitation, time alignment is the
  guarantee.
- **localStorage bloat** → only tiny config JSON persisted; no market data stored.
