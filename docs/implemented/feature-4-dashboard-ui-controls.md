# Feature 4 Implementation: Dashboard UI & Controls

## Overview
The Dashboard UI provides the visual shell for the Stocker application. It implements a high-performance, dark-themed, "btop-like" interface using Tailwind CSS, organizing the charting engine and real-time controls into a cohesive dashboard layout.

## Implementation Details

### 1. Layout Structure
The dashboard uses a flexbox-based layout to ensure responsiveness and optimal use of screen real estate:
- **Header**: A fixed-height top bar containing the brand logo, a symbol search/input field, and the `TickerHeader`.
- **Main Content**: A flexible container that occupies the remaining viewport height.
    - **Chart Section**: A flex-grow area containing the `ChartContainer` and overlaid status indicators (Connection status and error messages).
    - **Control Bar**: A bottom bar containing timeframe selection controls.

### 2. Key Components

#### `TickerHeader.tsx`
- Displays the current stock symbol in a prominent font.
- Shows the real-time price and the absolute/percentage change.
- Implements dynamic color-coding (Emerald for positive movement, Rose for negative movement) for immediate visual feedback on price action.

#### `ControlBar.tsx`
- Provides time-frame selection buttons (e.g., 1m, 5m, 1h, 1d).
- Connects to the `useStockChart` hook via a callback to trigger historical data re-fetching when the resolution changes.

#### `Dashboard Layout (App.tsx)`
- Acts as the central orchestrator, managing the `symbol`, `resolution`, and the global `useStockChart` hook state.
- Coordinates data flow between the ticker header, the controls, and the chart container.

### 3. Tech Stack
- **Styling**: Tailwind CSS (using the `slate` and `zinc` color palettes for a professional dark theme).
- **State Management**: React `useState` and `useCallback` for efficient rendering and minimal re-renders.

---
*Implemented by Frontend Engineer*
