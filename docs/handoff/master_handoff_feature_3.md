# Handoff Prompt: Feature 3 - Interactive Charting Engine (The Visuals)

You are an expert Frontend Engineer tasked with building the Stocker dashboard.

### Project Overview
Stocker is a high-performance, "btop-like" stock monitoring dashboard. It provides real-time and historical market data with zero-latency visualization.

### Current Project State
- **Feature 1 (Data Ingestion - Historical):** COMPLETED. Provides `GET /api/history/{symbol}`.
- **Feature 2 (Real-Time Streaming Proxy):** COMPLETED. Provides `WS /api/ws/{symbol}`.
- **Feature 3 (Interactive Charting Engine):** **CURRENT TASK**.

### Your Objective: Feature 3 (Interactive Charting Engine)
Implement a highly responsive candlestick chart using **React.js** and the **`lightweight-charts`** library.

**Key Requirements:**
1.  **Hybrid Data Loading:** 
    - Upon mounting, fetch historical data via the Feature 1 REST API (`GET /api/history/{symbol}`).
    - Simultaneously (or immediately after), connect to the Feature 2 WebSocket (`WS /api/ws/{symbol}`) for real-time updates.
2.  **Seamless Updates:** Use the `lightweight-charts` `.update()` method for incoming WebSocket packets to ensure smooth, non-re-rendering updates to the existing candlestick series.
3.  **Resilience & Data Integrity:**
    - Implement exponential backoff for WebSocket reconnections.
    - **Gap-filling:** If a WebSocket connection is lost, you must fetch the missing data points via the historical REST API upon reconnection to ensure the chart remains continuous.
4.  **UI/UX:** Ensure the chart supports zooming and panning, and provide a visual indicator of the WebSocket connection status.

### Tech Stack
- **Frontend:** React.js, Tailwind CSS, `lightweight-charts`.
- **Data Sources:** FastAPI Backend (REST & WebSockets).

### Workflow & Instructions
1.  **Read Documentation First:** Thoroughly read `AGENTS.md`, `docs/planning/feature-specs.md`, `docs/implemented/feature-1.md`, and `docs/implemented/feature-2.md`.
2.  **Phase 1 - Planning:** Your first task is to create a detailed implementation plan in `docs/planning/feature-3-plan.md`. This plan must cover the component architecture, the React-to-Chart integration (hooks/refs), and the gap-filling logic.
3.  **Phase 2 - Implementation:** Follow your plan to build the components.

Please acknowledge these instructions and begin by drafting the implementation plan in `docs/planning/feature-3-plan.md`.
