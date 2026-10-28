from datetime import datetime
from typing import Dict, List
from src.models.schemas import AlphaVantagePricePoint, StockDataPoint, ChartDataPoint

def transform_alpha_vantage_to_chart_data(raw_data: Dict[str, AlphaVantagePricePoint]) -> List[ChartDataPoint]:
    """Transforms Alpha Vantage raw data to lightweight-charts format."""
    chart_data = []
    for date_str, price_point in raw_data.items():
        # Try parsing YYYY-MM-DD (Daily) or YYYY-MM-DD HH:MM:SS (Hourly)
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        else:
            # Fallback if no format matches
            raise ValueError(f"Unknown date format: {date_str}")

        timestamp = int(dt.timestamp())
        
        chart_data.append(ChartDataPoint(
            time=timestamp,
            open=price_point.open,
            high=price_point.high,
            low=price_point.low,
            close=price_point.close
        ))
    
    chart_data.sort(key=lambda x: x.time)
    return chart_data

def transform_alpha_vantage_to_stock_data(raw_data: Dict[str, AlphaVantagePricePoint]) -> List[StockDataPoint]:
    """Transforms Alpha Vantage raw data to internal StockDataPoint format."""
    stock_data = []
    for date_str, price_point in raw_data.items():
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unknown date format: {date_str}")

        timestamp = int(dt.timestamp())
        
        stock_data.append(StockDataPoint(
            timestamp=timestamp,
            open=price_point.open,
            high=price_point.high,
            low=price_point.low,
            close=price_point.close,
            volume=price_point.volume
        ))
    
    stock_data.sort(key=lambda x: x.timestamp)
    return stock_data
