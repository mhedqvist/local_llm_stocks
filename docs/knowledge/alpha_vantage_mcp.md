# Knowledge Base: Alpha Vantage MCP Integration

## Overview
We will use the Alpha Vantage MCP (Model Context Protocol) as the primary data provider for the Stocker project. This provides a standardized way to interact with Alpha Vantage's market data.

## API Details
- **Base Endpoint/Service:** `https://mcp.alphavantage.co/`
- **Data Type:** Historical OHLCV (Open, High, Low, Close, Volume)
- **Supported Timeframes (Initial Scope):**
    - Daily
    - Hourly
- **Functionality:** Provides time-series data for various stocks/symbols.

## Implementation Details for Feature 1
- **Integration Pattern:** We will implement a client that interacts with the Alpha Vantage MCP service.
- **Data Transformation Requirement:** Data must be transformed from the Alpha Vantage response format into the `lightweight-charts` JSON schema:
    ```json
    { "time": 1698412800, "open": 432.0, "high": 433.0, "low": 431.5, "close": 432.5 }
    ```
- **Authentication:** API Key will be managed via a `.env` file under the variable `ALPHA_VANTAGE_API_KEY`.

## Mapping: Alpha Vantage $\rightarrow$ Stocker Internal
| Alpha Vantage Field | Stocker Field | Type | Note |
| :--- | :--- | :--- | :--- |
| timestamp / date | `time` | Integer | Must be converted to Unix timestamp (seconds) |
| 1. open | `open` | Float | |
| 2. high | `high` | Float | |
| 3. low | `low` | Float | |
| 4. close | `close` | Float | |
| 5. volume | `volume` | Integer | (Optional for base charting, but good to have) |

## Technical Debt & Notes
- Initially, we are only supporting **Daily** and **Hourly** resolutions.
- The implementation should remain modular so we can add other providers (like Polygon) later if Alpha Vantage limitations are met.
