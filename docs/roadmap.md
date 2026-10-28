# Stocker Project Roadmap

This document outlines the planned features for the Stocker dashboard, transitioning it from a prototype to a professional-grade trading platform.

## Phase 1: Core Foundation (COMPLETED)
- [x] Feature 1: Data Ingestion Engine (Historical)
- [x] Feature 2: Real-Time Streaming Proxy
- [x] Feature 3: Interactive Charting Engine
- [x] Feature 4: Dashboard UI & Controls
- [x] Feature 5: Technical Indicators (SMA, EMA)

## Phase 2: Productivity & Personalization (COMPLETED)
- [x] Feature 6: Watchlist & Persistence
- [x] Feature 7: Advanced Technical Analysis

## Phase 3: Advanced Workspace & UI (COMPLETED)
### Feature 8: Multi-Asset Workspace
- [x] Multi-pane layout for viewing multiple symbols at once.
- [x] Synchronized crosshairs and time scales across all visible charts.
- [x] Per-pane symbol/resolution/indicator config, persisted workspace layout.
- See `docs/implemented/feature-8.md`.

## Phase 4: Reliability & Production Readiness (COMPLETED)
### Feature 9: QA & Robustness (COMPLETED — see `docs/planning/feature-9-plan.md`)
- [x] Comprehensive unit testing for indicator math (Vitest, 34 tests).
- [x] End-to-end (E2E) testing for user flows (Playwright, 3 journeys + perf test).
- [x] Enhanced error handling and reconnection strategies for unstable networks
      (error boundaries, stale-data indicator, 429 handling, typed backend exceptions, 20 Hz perf verification).
- See `docs/implemented/feature-9.md`.

### Deferred: Customization Engine
- Theme switching (Dark/Light/High-Contrast).
- Indicator customization (Color, Thickness, Style).

---
*Last updated: Feature 9 complete*
