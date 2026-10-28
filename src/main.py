import os
import asyncio
import logging
import time
from fastapi import FastAPI, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Literal, Dict, Tuple
from dotenv import load_dotenv
from src.providers.base import BaseDataProvider, BaseStreamProvider
from src.providers.alpha_vantage import AlphaVantageMCPProvider
from src.providers.mock_provider import MockStreamProvider
from src.core.connection_manager import ConnectionManager
from src.services.upstream_manager import UpstreamStreamManager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="Stocker Data Engine")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global managers
connection_manager = ConnectionManager()
# Using MockStreamProvider for now
mock_provider = MockStreamProvider()
upstream_manager = UpstreamStreamManager(mock_provider, connection_manager)

# In-memory cache for historical data: {(symbol, resolution): (timestamp, data)}
_history_cache: Dict[Tuple[str, str], Tuple[float, list]] = {}
CACHE_TTL = 3600  # Cache duration in seconds (1 hour)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up Stocker Data Engine...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Stocker Data Engine...")
    await upstream_manager.stop_all()

# Dependency provider
def get_data_provider() -> BaseDataProvider:
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        raise RuntimeError("ALPHA_VANTAGE_API_KEY not set in environment")
    return AlphaVantageMCPProvider(api_key)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/history/{symbol}")
async def get_history(
    symbol: str,
    resolution: str = Query("daily"),
    provider: BaseDataProvider = Depends(get_data_provider)
):
    cache_key = (symbol, resolution)
    
    if cache_key in _history_cache:
        timestamp, data = _history_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            logger.info(f"Cache hit for {symbol} ({resolution})")
            return data

    try:
        data = await provider.get_historical_data(symbol, resolution)
        # Cache the successful response
        _history_cache[cache_key] = (time.time(), data)
        return data
    except ValueError as e:
        if "Invalid symbol" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if "Rate Limit" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        if "Network error" in str(e) or "connection" in str(e).lower():
            raise HTTPException(status_code=502, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/api/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    """
    WebSocket endpoint for real-time price updates.
    """
    client_queue = asyncio.Queue()
    
    # 1. Accept connection
    await websocket.accept()
    
    # 2. Register client and check if we need to start upstream streaming
    is_first = await connection_manager.connect(symbol, client_queue)
    if is_first:
        await upstream_manager.start_streaming(symbol)
    
    logger.info(f"Client connected to {symbol}")

    try:
        # 3. Forward messages from the queue to the WebSocket
        while True:
            message = await client_queue.get()
            await websocket.send_json(message)
            client_queue.task_done()
            
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from {symbol}")
    except Exception as e:
        logger.error(f"WebSocket error for {symbol}: {e}")
    finally:
        # 4. Cleanup on disconnect
        is_last = await connection_manager.disconnect(symbol, client_queue)
        if is_last:
            await upstream_manager.stop_streaming(symbol)
