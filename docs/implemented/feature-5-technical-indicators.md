# Feature 5 Implementation: Technical Indicators

## Overview
The Technical Indicators feature adds advanced analytical capabilities to the charting engine, allowing users to overlay mathematical trends (SMA, EMA) on top of the candlestick chart for technical analysis.

## Implementation Details

### 1. Mathematical Engine
A dedicated utility file `frontend/src/utils/indicators.ts` was implemented to handle complex time-series calculations:
- **SMA (Simple Moving Average)**: Calculates the arithmetic mean of the closing prices over a specified period.
- **EMA (Exponential Moving Average)**: Calculates a weighted average that gives more importance to recent prices, reducing lag compared to SMA.

### 2. Hook Enhancements (`useStockChart.ts`)
The `useStockChart` custom hook was significantly upgraded to manage the lifecycle of technical indicators:
- **Indicator Management**: Uses a `Map` (`indicatorSeriesRef`) to track multiple active indicator series on the chart.
- **Dynamic Initialization**: When indicators are added or changed (via the `indicators` prop), the hook automatically creates new `lightweight-charts` `LineSeries` and maps them to the correct configuration.
- **Real-Time Recalculation**:
    - **Historical Load**: On initial mount or resolution change, indicators are calculated for the entire historical dataset.
    - **Streaming Updates**: As new price ticks arrive via WebSocket, the indicators are recalculated and updated using the high-performance `.update()` method to ensure zero-latency visual synchronization.
- **Memory Management**: Ensures all indicator series are properly removed from the chart during component unmounting to prevent memory leaks.

### 3. Technical Challenges
- **State-Effect Sync**: Managing the synchronization between React's declarative state and the imperative API of `lightweight-charts`.
- **Performance**: Optimizing recalculation logic to ensure the UI remains responsive even with high-frequency price updates.

---
*Implemented by Frontend Engineer*
