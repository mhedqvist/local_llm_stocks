# Technical Feature Specifications: Stocker

This document serves as the technical source of truth for the implementation of the Stocker project. Each feature listed below is a discrete module required to achieve the project vision.

---

## 1. Feature: Data Ingestion Engine (Historical)
**Goal:** Provide a reliable mechanism to fetch high-fidelity historical OHLCV (Open, High, Low, Close, Volume) data.

* **Implementation Details:**
    * **Technology:** Python / FastAPI / `httpx` / `pydantic`.
    * **Provider:** Alpha Vantage MCP.
    * **Logic:** Asynchronous endpoint `GET /api/history/{symbol}`. Fetches data, performs transformation from raw provider format to `lightweight-charts` JSON schema via a modular provider pattern.
* **Current Status:** `[x] COMPLETED`

## 2. Feature: Real-Time Streaming Proxy (The Pulse)
**Goal:** Maintain a persistent, low-latency connection to market data providers to push price updates to the client instantly.

* **Implementation Details:**
    * **Technology:** WebSockets (FastAPI `WebSocket` class).
    * **Logic:** The backend acts as a **Transparent Proxy**. It maintains a single upstream WebSocket connection to the Data Provider and broadcasts incoming price packets to all connected frontend clients. This protects API keys and reduces client-side overhead.
* **Current Status:** `[x] COMPLETED`

## 3. Feature: Interactive Charting Engine (The Visuals)
**Goal:** Render highly responsive, performant candlestick charts that support zooming, panning, and real-time updates.

* **Implementation Details:**
    * **Technology:** React.js + `lightweight-charts` library.
    * **Logic:**
        * **Historical Layer:** Uses `setData()` to render the base candlestick series upon component mount.
        * **Live Layer:** Uses the `.update()` method inside a WebSocket `onmessage` listener to append new data points to the existing series without re-rendering the entire component.
* **Current Status:** `[x] COMPLETED`

## 4. Feature: Dashboard UI & Controls
**Goal:** Provide a clean, distraction-free interface for stock monitoring.

* **Implementation Details:**
    * **Technology:** React + Tailwind CSS.
    * **Components:**
        * `TickerHeader`: Displays current price, change %, and symbol.
        * `ChartContainer`: The primary viewport for the candlestick series.
        * `ControlBar`: Tools for time-frame selection (1m, 5m, 1h, 1d).
* **Current Status:** `[x] COMPLETED`

## 5. Feature: Robustness & Resilience
**Goal:** Ensure the application survives network instability and API rate limits.

* **Implementation Details:**
    * **Auto-Reconnection:** Implement exponential backoff for WebSocket reconnection on the frontend.
    * **Data Integrity:** Logic to handle "gaps" in data (e.g., if a WebSocket disconnects, fetch missing candles via REST upon reconnection).
    * **Error Boundaries:** React error boundaries to prevent UI crashes on data malformation.
* **Current Status:** `[ ] IN PROGRESS` — exponential backoff reconnection and gap-filling implemented in `useStockChart`; error boundaries and rate-limit UX deferred to Feature 9 (`docs/planning/feature-9-plan.md`).
