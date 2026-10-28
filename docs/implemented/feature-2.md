# Feature 2: Real-Time Streaming Proxy (The Pulse)

## Status: COMPLETED

## Goal
Maintain a persistent, low-latency connection to market data providers to push real-time price updates to the client via WebSockets.

## Implementation Details

### 1. Architecture: Transparent Proxy Pattern
To minimize client-side overhead and protect API keys, the backend acts as a transparent proxy.
- **Single Upstream Connection**: The backend maintains one persistent connection to the data provider.
- **Pub/Sub Model**: The backend broadcasts incoming price packets from the upstream connection to all currently connected frontend clients.
- **Per-Client Isolation**: To prevent a slow network connection on one client from delaying updates for others, each client is assigned its own `asyncio.Queue`. The `ConnectionManager` pushes updates into these queues, and a dedicated task per client handles the actual WebSocket transmission.
- **Automatic Lifecycle Management**: Streaming for a specific symbol is automatically started when the first client connects and stopped when the last client disconnects.

### 2. Technical Stack
- **Protocol**: WebSockets (FastAPI `WebSocket` class)
- **Concurrency**: `asyncio` (Queues, Tasks, and Event Loops)
- **Language**: Python 3.11+

### 3. Key Components
- `src/core/connection_manager.py`: Manages active WebSocket connections and handles symbol-based subscriptions using a queue-per-client model.
- `src/services/upstream_manager.py`: Manages the persistent connection to the upstream provider and handles automatic reconnection with exponential backoff.
- `src/providers/mock_provider.py`: A simulation tool for testing real-time data streams without an external API key.
- `src/models/schemas.py`: Defines the JSON message protocol (`PriceUpdateMessage`, `SystemStatusMessage`).

### 4. Resilience Strategy
- **Upstream Disconnects**: The `UpstreamStreamManager` implements exponential backoff for automatic reconnection.
- **Client Disconnects**: The system detects disconnects and cleans up subscriptions to prevent memory leaks.
- **Data Continuity (Client-side)**: The architecture is designed to allow the frontend to perform "gap-filling" via the Historical API (Feature 1) upon reconnection.
