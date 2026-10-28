# Feature 3 Implementation: Interactive Charting Engine

## Overview
The Interactive Charting Engine provides the visual core of the Stocker dashboard, delivering real-time market visualization with high performance and high reliability.

## Implementation Details

### 1. Component Architecture

#### `ChartContainer.tsx`
The main container for the chart. It manages the visual layout, including the chart viewport, error boundaries, and the connection status indicator. It provides a stable DOM element for the `lightweight-charts` library to attach to.

#### `useStockChart.ts` (Custom Hook)
This is the heart of the feature. It encapsulates all the complex logic required to maintain a consistent data series:
- **Lifecycle Management**: Handles the initialization and destruction of the `lightweight-charts` instance using `useEffect` and `useRef`.
- **Hybrid Synchronization**:
    1. **Mounting**: Fetches historical data via `GET /api/history/{symbol}`.
    2. **Initialization**: Uses `series.setData()` to render the historical baseline.
    3. **Streaming**: Establates a WebSocket connection and uses `series.update()` to append new ticks/candles.
- **Resilience Logic**:
    - **Exponential Backoff**: If the WebSocket disconnects, it schedules a reconnection with increasing delays (1s, 2s, 4s... up to 30s).
    - **Gap-Filling**: Upon reconnection, it detects if the current chart data is "behind" by comparing the last known timestamp with the new data, and then re-fetches the missing historical slice to ensure a continuous line.

#### `ConnectionStatusIndicator.tsx`
A lightweight UI component that provides immediate visual feedback on the health of the real-time data stream using color-coded status indicators.

### 2. Data Handling & Integration

#### WebSocket Protocol
The frontend listens for `PRICE_UPDATE` messages from the WebSocket. Each message contains a single candlestick update, which is immediately pushed to the chart's series using the high-performance `.update()` method.

#### Gap-Filling Strategy
To prevent visual "jumps" or missing data during network instability, the engine follows this protocol:
1.  Detect `onclose` event on WebSocket.
2.  Transition status to `RECONNECTING`.
3.  On `onopen`, fetch the most recent historical data.
4.  Merge the historical data with the current series to ensure no gaps exist between the last known point and the start of the live stream.

### 3. Performance Optimizations
- **Direct DOM Manipulation**: By using `useRef` for the chart and series instances, we bypass React's reconciliation for every single price update, allowing for sub-millisecond rendering of high-frequency data.
- **Responsive Reflow**: A window resize listener ensures the chart adjusts its width dynamically without requiring a full page refresh.
