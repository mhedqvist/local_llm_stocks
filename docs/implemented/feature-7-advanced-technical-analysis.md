# Feature 7: Advanced Technical Analysis - Technical Implementation Details

## Overview
This document provides a deep dive into the implementation of advanced technical analysis capabilities within the Stocker dashboard.

## Mathematical Logic & Algorithms

### 1. Moving Average Convergence Divergence (MACD)
The MACD is implemented as a three-component indicator:
- **MACD Line**: Calculated as the difference between a Fast Exponential Moving Average (EMA, period 12) and a Slow EMA (period 26).
- **Signal Line**: An EMA (period 9) applied to the MACD line itself.
- **Histogram**: The difference between the MACD Line and the Signal Line ($Histogram = MACD - Signal$).

**Algorithmic Complexity**: $O(N)$ where $N$ is the number of data points.

### 2. Bollinger Bands
The Bollinger Bands provide a measure of price volatility.
- **Middle Band**: $N$-period Simple Moving Average (SMA).
- **Upper/Lower Bands**: Calculated using the standard deviation ($\sigma$):
  - $Upper = SMA + (k \times \sigma)$
  - $Lower = SMA - (k \times \sigma)$

**Algorithmic Complexity**: $O(N \times \text{period})$ for a simple implementation.

### 3. Relative Strength Index (RSI)
RSI is a momentum oscillator measuring the magnitude of recent price changes to evaluate overbought or oversold conditions.
- **Formula**: $RSI = 100 - [100 / (1 + RS)]$
- where $RS = \text{Average Gain} / \text{Average Loss}$ over a specified period.

## Frontend Architecture

### State Management
- Indicator configurations (enabled/disabled, parameter values) are managed using React's `useState` and persisted via a custom `useLocalStorage` hook.
- This ensures user settings are preserved across browser sessions.

### Rendering Strategy (`lightweight-charts`)
To maintain high performance during real-time updates, we utilized the `lightweight-charts` library with the following optimizations:
- **Multiple Scales**: Instead of forcing all indicators onto the price scale (which would compress the price action), we use `priceScaleId` to assign RSI and MACD to separate scales.
- **Overlaying**: Bollinger Bands are implemented as `LineSeries` overlaid on the main `CandlestickSeries` to provide direct context to price action.
- **Histogram Rendering**: MACD Histogram and Volume are rendered using `HistogramSeries` for efficient visual representation of directionality (green for positive/up, red for negative/down).

### Real-Time Pipeline
- The WebSocket handler in `useStockChart.ts` was extended to maintain a `historyRef` (a mutable reference to the full price history).
- Upon every `PRICE_UPDATE` message, the history is updated and all active indicator series are re-calculated and re-rendered using the updated history. This ensures the technical analysis is always up-to-date with the most recent tick.

## Performance Considerations
- **Client-Side Computation**: All indicator math is performed on the client to ensure zero latency in UI feedback and to offload processing from the backend.
- **Complexity Management**: The use of `useCallback` for indicator updates prevents unnecessary re-calculations and re-renders in the React component tree.
