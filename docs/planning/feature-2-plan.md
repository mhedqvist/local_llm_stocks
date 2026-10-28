# Implementation Plan: Feature 2 - Real-Time Streaming Proxy (The Pulse)

## 1. Goal
Implement a high-performance, low-latency WebSocket proxy in the backend that maintains a single persistent connection to market data providers and broadcasts price updates to all connected frontend clients.

## 2. Architecture Design: The Transparent Proxy Pattern

To achieve the "Transparent Proxy" goal while being efficient and secure, the system will follow a **Publisher/Subscriber (Pub/Sub)** model managed within the FastAPI application.

### 2.1 Component Overview
1.  **Upstream Connection Manager (The Producer):** 
    *   A long-running background task that manages a single, persistent WebSocket connection to the Data Provider (e.g., Alpha Vantage).
    *   Responsible for handling provider-side authentication, heartbeats, and automatic reconnection.
    *   When a new price packet arrives, it "publishes" it to the internal message bus.

2.  **Connection Manager (The Broker):**
    *   Tracks all currently active WebSocket connections from frontend clients.
    *   Maintains a registry of clients subscribed to specific symbols (e.g., `{"AAPL": [ws1, ws2], "TSLA": [ws3]}`).
    *   Provides methods to `connect()`, `disconnect()`, and `broadcast(symbol, message)`.

3.  **Client WebSocket Handler (The Consumer):**
    *   The FastAPI WebSocket endpoint that clients connect to.
    *   Handles individual client connection lifecycles.

### 2.2 Concurrency Model
To ensure that a slow client does not block the entire system or delay updates for other clients, we will use an **Asynchronous Queue per Client** approach.
*   Each client connection will be assigned its own `asyncio.Queue`.
*   The `ConnectionManager` will push incoming messages into each client's respective queue.
*   A dedicated `asyncio` task per client will read from its own queue and push the data to the actual `WebSocket` object.

## 3. Communication Protocol

### 3.1 Message Format (JSON)
All messages sent from the server to the client will follow a strict JSON schema to ensure predictable parsing.

**Price Update Message:**
```json
{
  "type": "price_update",
  "symbol": "AAPL",
  "price": 150.05,
  "timestamp": 1698412805,
  "volume": 500
}
```

**System Status Message:**
Used to inform the UI of connection health.
```json
{
  "type": "system_status",
  "status": "connected" | "reconnecting" | "disconnected",
  "message": "Optional error details"
}
```

## 4. Error Handling Strategy

| Scenario | Responsibility | Strategy |
| :--- | :--- | :--- |
| **Upstream Provider Disconnect** | Backend | Implement exponential backoff for reconnection. Broadcast `system_status: reconnecting` to all clients. |
| **Client Disconnect** | Backend | Detect via `WebSocket.is_connected` or exception. Remove client from `ConnectionManager` registry immediately to prevent memory leaks. |
| **Network Fluctuation (Client-side)** | Frontend | Implement exponential backoff for WebSocket reconnection. |
| **Data Gaps (Post-Reconnection)** | Frontend | Upon successful reconnection, the client MUST trigger a REST call to `GET /api/history/{symbol}` to "gap-fill" the chart with missing data points. |

## 5. Implementation Steps

### Phase 1: Backend (FastAPI)
1.  **Define Models:** Create Pydantic models for `PriceUpdate` and `SystemStatus` messages.
2.  **Implement `ConnectionManager`:**
    *   `active_connections: Dict[str, Set[asyncio.Queue]]` (Mapping symbol to a set of client queues).
    *   `connect(symbol, queue)`, `disconnect(symbol, queue)`, `broadcast(symbol, message)`.
3.  **Implement `UpstreamStreamManager`:**
    *   Create a background task that connects to the provider.
    *   Implement reconnection logic with exponential backoff.
    *   Implement the loop that reads from the provider and calls `ConnectionManager.broadcast()`.
4.  **Expose WebSocket Endpoint:** 
    *   `WS /api/ws/{symbol}`: Handles the lifecycle of a client connection.

### Phase 2: Frontend (React)
1.  **Create `useWebSocket` Hook:**
    *   Manage `WebSocket` instance lifecycle.
    *   Implement exponential backoff for reconnection.
    *   Expose `lastMessage` and `connectionStatus`.
2.  **Integrate with Charting Engine:**
    *   Update `ChartContainer` to listen to `useWebSocket`.
    *   On `price_update`, call `series.update(data)`.
    *   On `reconnection`, trigger a historical data fetch to gap-fill.
3.  **UI Indicators:** Add a status indicator (Green/Yellow/Red dot) in the `TickerHeader` representing the WebSocket connection state.

## 6. Architectural Decision Record (ADR)

### ADR-001: Per-Client `asyncio.Queue` for Broadcasting
*   **Context:** The backend must broadcast a single high-frequency stream to many clients.
*   **Decision:** We will use an `asyncio.Queue` for each connected client. The `ConnectionManager` will push messages into these queues, and a dedicated task for each client will handle the actual `websocket.send_json()` operation.
*   **Rationale:** This decouples the upstream data reception from the client's ability to consume data. If one client's network is slow, its queue will grow, but it won't block the `UpstreamStreamManager` from delivering updates to other, faster clients.
