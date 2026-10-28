from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Dict, Any

class AlphaVantagePricePoint(BaseModel):
    """Maps the raw Alpha Vantage API response format to a structured model."""
    open: float = Field(..., alias="1. open")
    high: float = Field(..., alias="2. high")
    low: float = Field(..., alias="3. low")
    close: float = Field(..., alias="4. close")
    volume: int = Field(..., alias="5. volume")

    @field_validator('open', 'high', 'low', 'close', mode='before')
    @classmethod
    def parse_float(cls, v):
        return float(v)

    @field_validator('volume', mode='before')
    @classmethod
    def parse_int(cls, v):
        return int(v)

    model_config = ConfigDict(populate_by_name=True)

class StockDataPoint(BaseModel):
    """Internal normalized representation of stock data."""
    timestamp: int  # Unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: int

class ChartDataPoint(BaseModel):
    """Data format required by lightweight-charts."""
    time: int
    open: float
    high: float
    low: float
    close: float

class PriceUpdateMessage(BaseModel):
    """Message sent to clients via WebSocket during a price update."""
    type: str = "price_update"
    symbol: str
    price: float
    timestamp: int
    volume: int | None = None

class SystemStatusMessage(BaseModel):
    """Message sent to clients via WebSocket for system status updates."""
    type: str = "system_status"
    status: str  # "connected" | "reconnecting" | "disconnected"
    message: str | None = None
