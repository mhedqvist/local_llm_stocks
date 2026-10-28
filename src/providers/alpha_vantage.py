import httpx
from typing import List
from src.providers.base import BaseDataProvider
from src.models.schemas import ChartDataPoint, AlphaVantagePricePoint
from src.utils.transformer import transform_alpha_vantage_to_chart_data

class AlphaVantageMCPProvider(BaseDataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://www.alphavantage.co/query"

    async def get_historical_data(self, symbol: str, resolution: str) -> List[ChartDataPoint]:
        """
        Fetches historical OHLCV data from Alpha Vantage.
        """
        params = {
            "symbol": symbol,
            "apikey": self.api_key
        }

        if resolution == "1h":
            params["function"] = "TIME_SERIES_HOURLY"
        elif resolution == "daily":
            params["function"] = "TIME_SERIES_DAILY"
        elif resolution == "1m":
            params["function"] = "TIME_SERIES_INTRADAY"
            params["interval"] = "1min"
        elif resolution == "5m":
            params["function"] = "TIME_SERIES_INTRADAY"
            params["interval"] = "5min"
        elif resolution == "15m":
            params["function"] = "TIME_SERIES_INTRADAY"
            params["interval"] = "15min"
        elif resolution == "60m":
            params["function"] = "TIME_SERIES_INTRADAY"
            params["interval"] = "60min"
        else:
            raise ValueError(f"Unsupported resolution: {resolution}. Supported: daily, 1h, 1m, 5m, 15m, 60m")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.base_url, params=params, timeout=10.0)
                response.raise_for_status()
            except httpx.HTTPError as e:
                raise Exception(f"Network error while connecting to Alpha Vantage: {e}")

        data = response.json()

        # Alpha Vantage error handling
        if "Error Message" in data:
            raise ValueError(f"Invalid symbol or API error: {data['Error Message']}")
        if "Note" in data:
            raise Exception(f"API Rate Limit Exceeded: {data['Note']}")
        
        # Find the time series key (e.g., "Time Series (Daily)")
        time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
        if not time_series_key:
            raise ValueError(f"No time series data found in response for symbol {symbol}")

        # Parse raw data into AlphaVantagePricePoint
        raw_prices = {}
        for date_str, values in data[time_series_key].items():
            raw_prices[date_str] = AlphaVantagePricePoint(**values)
        
        # Transform to ChartDataPoint
        return transform_alpha_vantage_to_chart_data(raw_prices)
