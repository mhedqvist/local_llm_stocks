# Project Initialization Plan: Stocker

## 1. Project Vision & Intent
**Project Name:** Stocker
**Objective:** To build a high-performance web-based dashboard capable of displaying historical candlestick charts and real-time price updates for NVIDIA (NVDA) using a professional-grade architecture.

**Target Experience:** A "btop-like" interactive dashboard where historical patterns meet live price action without manual refreshes.

---

## 2. Roadmap Overview
**Current Project Progress:** `[░░░░░░░░░░] 0%`

| Feature | Status | Priority |
| :--- | :--- | :--- |
| 1. Data Ingestion Engine | `[ ] TODO` | Critical |
| 2. Real-Time Streaming Proxy | `[ ] TODO` | Critical |
| 3. Interactive Charting Engine | `[ ] TODO` | High |
| 4. Dashboard UI & Controls | `[ ] TODO` | Medium |
| 5. Robustness & Resilience | `[ ] TODO` | Medium |

---

## 3. Technical Specification Reference

👉 **[Detailed Feature Specifications](./feature-specs.md)**

---

## 4. Data Schema Specification (Internal)

### Historical Data (Required for `setData`)
```json
[
  { "time": "2023-10-01", "open": 430.50, "high": 435.00, "low": 428.20, "close": 432.10 }
]
```

### Real-Time Update (Required for `.update()`)
```json
{ "time": 1698412800, "open": 432.0, "high": 433.0, "low": 431.5, "close": 432.5 }
```
