import asyncio
import logging
from src.core.connection_manager import ConnectionManager
from src.providers.base import BaseStreamProvider
from src.models.schemas import SystemStatusMessage

logger = logging.getLogger(__name__)

class UpstreamStreamManager:
    def __init__(self, provider: BaseStreamProvider, connection_manager: ConnectionManager):
        self.provider = provider
        self.connection_manager = connection_manager
        self._running = True
        self._active_tasks = {}  # symbol -> asyncio.Task

    async def start_streaming(self, symbol: str):
        """Starts a streaming task for a given symbol."""
        if symbol in self._active_tasks:
            return

        task = asyncio.create_task(self._run_stream(symbol))
        self._active_tasks[symbol] = task

    async def stop_streaming(self, symbol: str):
        """Stops the streaming task for a given symbol."""
        task = self._active_tasks.pop(symbol, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def stop_all(self):
        """Stops all streaming tasks."""
        symbols = list(self._active_tasks.keys())
        for symbol in symbols:
            await self.stop_streaming(symbol)
        self._running = False

    async def _run_stream(self, symbol: str):
        """The main loop for streaming prices for a symbol."""
        retry_delay = 1
        max_retry_delay = 60

        while self._running:
            try:
                logger.info(f"Starting stream for {symbol}")
                await self.connection_manager.broadcast(symbol, SystemStatusMessage(status="connected", message="Connected to upstream").model_dump())
                
                async for price_data in self.provider.stream_prices(symbol):
                    # Reset retry delay on successful message receipt
                    retry_delay = 1
                    await self.connection_manager.broadcast(symbol, price_data)
                
                # If stream ends normally, try to reconnect
                raise ConnectionError("Upstream stream ended.")

            except (ConnectionError, Exception) as e:
                logger.error(f"Error in stream for {symbol}: {e}")
                await self.connection_manager.broadcast(symbol, SystemStatusMessage(status="reconnecting", message=str(e)).model_dump())
                
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)
                logger.info(f"Retrying {symbol} in {retry_delay} seconds...")
