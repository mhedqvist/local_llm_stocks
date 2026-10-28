# Implementation: Watchlist & Persistence (Feature 6)

## Overview
Implemented a persistent watchlist that allows users to monitor multiple symbols in real-time and saves their preferences across browser sessions.

## Components Implemented

### 1. Watchlist Component
- **Location**: `frontend/src/components/Watchlist.tsx`
- **Functionality**:
    - A sidebar component providing a list of symbols.
    - Allows adding new symbols via an input field.
    - Allows removing symbols from the list.
    - Displays real-time price and 24h price change for each symbol.
    - Integrates with the main chart by allowing users to click a symbol to focus the main view.

### 2. WatchlistItem Component
- **Location**: `frontend/src/components/WatchlistItem.tsx`
- **Functionality**:
    - Individual item display within the watchlist.
    - Uses `useWatchlistItem` hook for real-time price/change updates.
    - Displays color-coded price changes (green for up, red for down).

### 3. Hooks
- **`useWatchlistItem`**: A specialized hook for lightweight real-time updates of a single symbol's price and 24h change, optimized for use in lists without the overhead of full charting.
- **`useLocalStorage`**: A custom React hook to handle data persistence via the browser's `localStorage` API.

## Persistence Logic
- **Watchlist**: The list of symbol names is stored as a JSON array in `localStorage`.
- **User Preferences**: The preferred chart resolution is also persisted via `localStorage`.

## Technical Details
- **Tech Stack**: React, Tailwind CSS, WebSockets.
- **State Management**: React `useState` and custom `useLocalStorage` hook.
- **Data Fetching**: WebSocket connections are opened per symbol in the watchlist to ensure real-time updates.
- **Error Handling**: Implemented defensive checks to prevent crashes if `localStorage` data is corrupted or missing.
