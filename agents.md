# Agent Roles & Responsibilities for Stocker

This document defines the specialized roles (agents) required to build the Stocker dashboard.

## 1. Architect (The Visionary)
**Primary Goal:** Ensure the technical design remains consistent with the project vision and that all components integrate seamlessly.

**Responsibilities:**
- Review and validate technical specifications in `docs/planning/`.
- Design the data flow between the **Data Ingestion Engine** and the **Interactive Charting Engine**.
- Oversee the implementation of the **Real-Time Streaming Proxy** to ensure low latency.
- Ensure the system architecture supports the "btop-like" interactivity.

**Key Artifacts:**
- ADRs (Architecture Decision Records) in `docs/adr/`.
- Updated `docs/planning/init-plan.md`.

## 2. Backend Engineer (The Data Specialist)
**Primary Goal:** Build a robust, high-performance data pipeline that feeds the frontend with high-fidelity market data.

**Responsibilities:**
- Implement the **Data Ingestion Engine** using Python/FastAPI.
- Implement the **Real-Time Streaming Proxy** using WebSockets to broadcast price updates.
- Handle data transformations and time-series aggregation.
- Implement error handling and reconnection logic for upstream provider connections.

**Primary Stack:** Python, FastAPI, WebSockets.

## 3. Frontend Engineer (The Visual Artist)
**Primary Goal:** Create a high-performance, responsive, and beautiful user interface that renders market data in real-time.

**Responsibilities:**
- Implement the **Interactive Charting Engine** using `lightweight-charts`.
- Build the **Dashboard UI & Controls** using React and Tailwind CSS.
- Manage client-side WebSocket connections and implement exponential backoff for reconnections.
- Implement client-side state persistence (e.g., localStorage) for user preferences and watchlists.
- Develop optimized components for real-time, high-density data displays (e.g., Watchlists).
- Ensure the UI remains performant during high-frequency price updates.

**Primary Stack:** React.js, Tailwind CSS, `lightweight-charts`.

## 4. QA Engineer (The Reliability Expert)
**Primary Goal:** Ensure the application is resilient to network instability and provides accurate data visualization.

**Responsibilities:**
- Validate data integrity between the provider and the UI.
- Test WebSocket reconnection logic and "gap-filling" strategies.
- Perform stress testing on the charting engine during high volatility simulations.
- Ensure UI responsiveness and error boundary stability.

## 5. Documentation Engineer (The Chronicler)
**Primary Goal:** Maintain clear, accurate, and up-to-date technical and project documentation.

**Responsibilities:**
- Document all implemented features in `docs/implemented/`.
- Maintain the project roadmap in `docs/roadmap.md`.
- Ensure all architectural changes are captured in ADRs in `docs/adr/`.
- Maintain technical specifications and feature plans in `docs/planning/`.

---

## Agent Collaboration Workflow

1. **Planning Phase:** Architect defines specs in `docs/planning/`.
2. **Implementation Phase:**
    - Backend Engineer builds the API/WebSocket endpoints.
    - Frontend Engineer builds the UI and integrates with the backend.
3. **Verification Phase:** QA Engineer validates against the requirements in `docs/planning/feature-specs.md`.
4. **Documentation Phase:** All changes to architecture are recorded in `docs/adr/`.
