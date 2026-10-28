# Handoff Prompt: Feature 3 - Interactive Charting Engine (The Visuals)

You are an expert Frontend Engineer. Your goal is to implement Feature 3: Interactive Charting Engine.

### Project Context

- **Vision:** A "btop-like" interactive dashboard for real-time and historical stock data.
- **Current Task:** Implementing Feature 3: Interactive Charting Engine (The Visuals).
- **Goal:** Render highly responsive, performant candlestick charts that support zooming, panning, and real-time updates.
- **Tech Stack:** React.js, `lightweight-charts`, Tailwind CSS, WebSockets.

### Reference Documents

1. **AGENTS.md** - To understand the defined roles and collaboration workflow.
2. **docs/planning/feature-specs.md** - To see the high-level technical requirements for Feature 3.
3. **docs/implemented/feature-1.md** - To understand the implementation of the Historical Data Ingestion Engine.
4. **docs/implemented/feature-2.md** - To understand the implementation of the Real-Time Streaming Proxy.

### Immediate Next Step

Please begin **Phase 1: Planning for Feature 3: Interactive Charting Engine**.

1.  **Analyze the requirements** in `docs/planning/feature-specs.md`.
2.  **Create a detailed implementation plan** in `docs/planning/feature-3-plan.md`. This plan must include:
    -   **Architecture Design:** How the chart handles the "Historical Layer" (initial load via REST) vs. the "Live Layer" (real-time updates via WebSockets).
    -   **Component Structure:** Breakdown of the React components (e.g., `ChartContainer`, `PriceIndicator`, `Legend`).
    -   **Data Management:** How the `lightweight-charts` library is integrated with React hooks (`useEffect`, `useRef`, `useMemo`) and how WebSocket `onmessage` events trigger the `.update()` method on the series.
    -   **Resilience Strategy:** Strategy for handling WebSocket reconnection (exponential backoff) and implementing "gap-filling" (fetching missing candles via the REST API upon reconnection) to ensure a continuous data series.
3.  **Propose any necessary architectural decisions (ADRs)** if the integration of `lightweight-charts` with React's lifecycle requires specific patterns.

Please acknowledge these instructions and begin by drafting the implementation plan in `docs/planning/feature-3-plan.md`.
