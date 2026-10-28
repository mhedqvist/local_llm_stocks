from abc import ABC, abstractmethod
from typing import List, AsyncGenerator
from src.models.schemas import ChartDataPoint

class BaseDataProvider(ABC):
    @abstractmethod
    async def get_historical_data(self, symbol: str, resolution: str) -> List[ChartDataPoint]:
        """
        Fetch historical OHLCV data for a given symbol and resolution.
        """
        pass

class BaseStreamProvider(ABC):
    @abstractmethod
    async def stream_prices(self, symbol: str) -> AsyncGenerator[dict, None]:
        """
        Yields real-time price updates for a given symbol.
        """
        pass
