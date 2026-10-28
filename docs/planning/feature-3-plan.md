# Implementation Plan: Feature 3 - Interactive Charting Engine

## Overview
This plan outlines the implementation of a high-performance, responsive candlestick chart for the Stocker dashboard using React.js and `lightweight-charts`. It focuses on seamless data integration, real-time updates, and resilience to network instability.

## 1. Component Architecture

### `ChartContainer.tsx` (Main Component)
- The parent component that orchestrates the chart rendering and lifecycle.
- Manages the state for the active `symbol` and `connectionStatus`.
- Uses `useStockChart` hook for data management.
- Renders the `lightweight-charts` container and `ConnectionStatusIndicator`.

### `useStockChart.ts` (Custom Hook)
- Manages the lifecycle of the `lightweight-charts` instance.
- Handles the orchestration between historical data fetching and WebSocket connection.
- Implements the gap-filling logic.
- Manages WebSocket connection state (CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING).

### `ConnectionStatusIndicator.tsx` (UI Component)
- A small visual element (e.g., a dot) that changes color based on the WebSocket connection status.

## 2. Data Flow & Integration

### Phase 1: Initialization (Mounting)
1. **Fetch Historical Data**: Call `GET /api/history/{symbol}`.
2. **Initialize Chart**: Once historical data is received, call `series.setData(historicalData)`.
3. **Connect WebSocket**: Open a connection to `ws://<api_url>/api/ws/{symbol}`.

### Phase 2: Real-Time Updates
1. **Handle WebSocket Messages**: On `onmessage`, extract the latest price/candle update.
2. **Update Chart**: Use `series.update(newCandle)` to append/update the latest data point in the chart without a full re-render.

### Phase 3: Resilience & Gap-Filling
1. **Exponential Backoff**: If the WebSocket disconnects, implement a reconnection strategy (e.g., 1s, 2s, 4s, 8s... up to a cap).
2. **Gap-Filling Logic (On Reconnection)**:
    - Upon successful WebSocket reconnection:
        a. Determine the timestamp of the last candle currently in the chart.
        b. Fetch missing data from the REST API: `GET /api/history/{symbol}?from={last_timestamp}&to={current_timestamp}` (Note: API may need to support `from`/`to` params).
        c. If the REST API doesn't support `from`/`to` parameters, fetch the most recent history and filter for the missing range.
        d. Use `series.setData()` to update the chart with the newly filled data.

## 3. Technical Details

### State Management
- Use `useRef` for the `chart` and `series` instances to avoid unnecessary re-renders of the React component when updating the chart.
- Use `useState` for connection status and symbol changes.

### API Interface
- **REST**: `GET /api/history/{symbol}`
- **WebSocket**: `ws://<api_url>/api/ws/{symbol}`

### Error Handling
- Use React Error Boundaries to catch unexpected rendering errors.
- Implement robust error handling for failed fetch requests.

## 4. Implementation Steps

1. [ ] Define types/interfaces for Chart Data and WebSocket messages.
2. [ ] Create `useStockChart` hook.
3. [ ] Implement `ChartContainer` with basic `lightweight-charts` rendering.
4. [ ] Integrate REST API for historical data.
5. [ ] Integrate WebSocket for real-time updates.
6. [ ] Implement exponential backoff for WebSocket.
7. [ ] Implement gap-filling logic.
8. [ ] Add `ConnectionStatusIndicator` UI.
9. [ ] Add Tailwind CSS styling for the container and indicator.
