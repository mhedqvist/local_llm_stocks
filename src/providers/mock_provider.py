import asyncio
import random
import time
from typing import AsyncGenerator
from src.providers.base import BaseStreamProvider

class MockStreamProvider(BaseStreamProvider):
    """Simulates a real-time market data stream."""

    async def stream_prices(self, symbol: str) -> AsyncGenerator[dict, None]:
        price = 150.0
        while True:
            # Simulate a price change
            price += random.uniform(-1, 1)
            yield {
                "type": "price_update",
                "symbol": symbol,
                "price": round(price, 2),
                "timestamp": int(time.time()),
                "volume": random.randint(1, 100)
            }
            await asyncio.sleep(1)  # Update every second
