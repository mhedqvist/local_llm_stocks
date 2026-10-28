# Feature 4 Implementation Plan: Dashboard UI & Controls

## Overview
Implement a professional, responsive, and beautiful dashboard interface that wraps the existing charting engine. The dashboard will follow a "btop-like" dark theme using Tailwind CSS.

## 1. Component Hierarchy
- `App.tsx` (State Container)
    - `DashboardLayout` (Layout Wrapper)
        - `Header`
            - `TickerHeader` (Displays Symbol, Price, Change)
        - `MainContent` (Flex container)
            - `ChartSection` (Flex-grow)
                - `ChartContainer` (Existing, refactored)
                - `ConnectionStatusIndicator` (Existing)
            - `ControlBar` (Fixed/Sticky bottom or top)
                - `TimeframeSelector` (1m, 5m, 1h, 1d)

## 2. State Management
- **Global/Parent State (`App.tsx`)**:
    - `symbol`: `string` (current ticker)
    - `resolution`: `string` (current time frame: '1m' | '5m' | '1h' | '1d')
    - `priceData`: `{ price: number, change: number, changePercentage: number } | null` (to be derived or passed down)

## 3. Component Details

### 3.1. `TickerHeader`
- **Props**: `symbol`, `price`, `change`, `changePercentage`.
- **Visuals**: 
    - Large symbol name.
    - Current price with large font.
    - Color-coded change (green for positive, red for negative) using Tailwind `text-emerald-500` and `text-rose-500`.

### 3.2. `ControlBar`
- **Props**: `currentResolution`, `onResolutionChange`.
- **Functionality**: 
    - Set of buttons for timeframes.
    - Updates the `resolution` state in `App.tsx`.
    - Highlights the active timeframe.

### 3.3. Layout & Styling
- **Theme**: Dark (Slate/Zinc palette).
- **Layout**:
    - Full-screen (`h-screen`) dashboard.
    - `Header`: Top bar.
    - `MainContent`: Flexbox area.
    - `ChartSection`: Occupies remaining space.
    - `ControlBar`: Bottom bar for easy access.

## 4. Implementation Steps
1.  **Modify `useStockChart.ts`**: Update it to return the latest price and change information from the WebSocket messages.
2.  **Create `TickerHeader.tsx`**: Build the component with the specified requirements.
3.  **Create `ControlBar.tsx`**: Build the component with timeframe selection.
4.  **Refactor `App.tsx`**:
    - Implement the new layout.
    - Connect the `resolution` and `symbol` states to the components.
    - Integrate the new components into the layout.
5.  **Refactor `ChartContainer.tsx`**: Remove its internal header to allow the new `TickerHeader` to take over the top area.
