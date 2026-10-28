# Feature 5 Implementation Plan: Technical Indicators

## Overview
Enhance the Interactive Charting Engine to support technical indicators (SMA, EMA, etc.), allowing users to perform advanced technical analysis directly on the dashboard.

## 1. Component Architecture Changes

### 1.1. `useStockChart.ts` (Enhanced)
*   **New State/Ref**:
    *   `indicatorSeriesRef`: A Map to store references to the `lineSeries` created for each active indicator.
    *   `indicatorConfigsRef`: Stores the current configuration (period, type) for each indicator.
*   **New Logic**:
    *   **Calculation Engine**: A function that takes the current data array and indicator parameters and returns a new array of data points for the indicator.
    *   **Indicator Lifecycle**:
        *   **Initialization**: When historical data is first loaded, calculate indicators and create new series in the chart.
        *   **Real-time Update**: When a new price tick arrives via WebSocket, recalculate the indicators and call `.update()` on the indicator series.
        *   **Dynamic Toggle**: Support adding/removing indicators dynamically.

### 1.2. `indicators.ts` (New Utility File)
*   Implement mathematical functions:
    *   `calculateSMA(data: OHLCV[], period: number): { time: number, value: number }[]`
    *   `calculateEMA(data: OHLCV[], period: number): { time: number, value: number }[]`
    *   `calculateRSI(data: OHLCV[], period: number): { time: number, value: number }[]`

## 2. UI/UX Enhancements

### 2.1. `IndicatorMenu` (New Component)
*   A small, unobtrusive overlay/dropdown on the chart area.
*   Allows users to:
    *   Toggle **SMA**.
    *   Toggle **EMA**.
    *   Adjust the **period** (e.g., 20, 50, 200).
    *   Adjust color for each indicator.

## 3. Implementation Phases

### Phase 1: Mathematical Foundation
*   Create `frontend/src/utils/indicators.ts`.
*   Implement SMA and EMA.

### Phase 2: Hook Integration
*   Modify `useStockChart` to handle indicator series management.
*   Implement real-time indicator updates.

### Phase 3: UI Implementation
*   Build the `IndicatorMenu` component.
*   Integrate the menu with the `useStockChart` hook.

## 4. Technical Challenges
*   **Performance**: Ensuring indicator calculations don't block the main thread during high-frequency updates.
*   **Data Alignment**: Ensuring indicator data points align perfectly with the candlestick timestamps.
*   **Memory Management**: Properly disposing of indicator series when they are removed.
