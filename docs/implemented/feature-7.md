# Feature 7: Advanced Technical Analysis

## Overview
Implemented advanced technical indicators and enhanced chart visualization to provide deeper market analysis capabilities.

## Implemented Features

### 1. Moving Average Convergence Divergence (MACD)
- **Description**: A trend-following momentum indicator that shows the relationship between two exponential moving averages (EMA) of a security's price.
- **Components**:
  - **MACD Line**: Difference between the 12-period EMA and the 26-period EMA.
  - **Signal Line**: 9-period EMA of the MACD line.
  - **Histogram**: The difference between the MACD line and the signal line.
- **Visualization**: Rendered as lines and a histogram on the chart.

### 2. Bollinger Bands
- **Description**: A volatility indicator consisting of a middle band (SMA) and two outer bands (standard deviations away from the middle band).
- **Components**:
  - **Middle Band**: $N$-period Simple Moving Average (SMA).
  - **Upper Band**: $N$-period SMA + ($k \times$ Standard Deviation).
  - **Lower Band**: $N$-period SMA - ($k \times$ Standard Deviation).
- **Visualization**: Rendered as three distinct lines overlaid on the main candlestick chart.

### 3. Relative Strength Index (RSI)
- **Description**: A momentum oscillator that measures the speed and change of price movements.
- **Visualization**: Rendered on a dedicated scale on the chart.

### 4. Volume Histogram
- **Description**: Visual representation of trading volume.
- **Visualization**: Rendered as a histogram at the bottom of the chart area.

## Technical Implementation

### Frontend Logic
- **Mathematical Formulas**: All indicator calculations are performed on the client side in `frontend/src/utils/indicators.ts` for maximum responsiveness and low latency.
- **Charting Engine**: The `useStockChart` hook was extended to manage multiple series. We utilized `lightweight-charts` features like:
  - `addLineSeries` for overlays (Bollinger Bands) and oscillators (RSI, MACD).
  - `addHistogramSeries` for MACD histogram and Volume.
  - Custom `priceScaleId` to allow oscillators (RSI/MACD) to exist on their own scales without compressing the main price chart.

### UI/UX
- **Indicator Settings**: A new `IndicatorSettings` component allows users to toggle indicators and customize their parameters (e.g., period length, standard deviation multiplier).
- **Persistence**: User-selected indicators and their parameters are persisted across sessions using `localStorage`.

### Real-Time Updates
- The real-time data pipeline (WebSockets) was updated to recalculate and re-render all active indicators every time a new price update is received, ensuring the dashboard remains highly reactive.
