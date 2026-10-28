import asyncio
from typing import Dict, Set, Optional
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Mapping symbol to a set of client queues
        # Each client has its own queue to prevent slow clients from blocking others
        self._subscriptions: Dict[str, Set[asyncio.Queue]] = {}

    async def connect(self, symbol: str, queue: asyncio.Queue) -> bool:
        """Registers a client queue for a specific symbol. Returns True if this is the first subscriber."""
        is_first = False
        if symbol not in self._subscriptions or not self._subscriptions[symbol]:
            is_first = True
            self._subscriptions[symbol] = set()
        
        self._subscriptions[symbol].add(queue)
        return is_first

    async def disconnect(self, symbol: str, queue: asyncio.Queue) -> bool:
        """Unregisters a client queue from a specific symbol. Returns True if this was the last subscriber."""
        is_last = False
        if symbol in self._subscriptions:
            self._subscriptions[symbol].discard(queue)
            if not self._subscriptions[symbol]:
                del self._subscriptions[symbol]
                is_last = True
        return is_last

    async def broadcast(self, symbol: str, message: dict):
        """Sends a message to all clients subscribed to a specific symbol."""
        if symbol in self._subscriptions:
            # We push to all queues. The actual sending is handled by the client's task.
            for queue in self._subscriptions[symbol]:
                await queue.put(message)

    def get_subscribers(self, symbol: str) -> Set[asyncio.Queue]:
        """Returns all registered queues for a symbol."""
        return self._subscriptions.get(symbol, set())
