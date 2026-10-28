import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from src.main import app, get_data_provider
from src.models.schemas import ChartDataPoint
from src.providers.base import BaseDataProvider

client = TestClient(app)

class MockProvider(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        return [
            ChartDataPoint(time=1698412800, open=100.0, high=110.0, low=90.0, close=105.0)
        ]

class MockProviderError(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        raise ValueError("Invalid symbol")

@pytest.fixture
def override_provider():
    app.dependency_overrides[get_data_provider] = lambda: MockProvider()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def override_provider_error():
    app.dependency_overrides[get_data_provider] = lambda: MockProviderError()
    yield
    app.dependency_overrides.clear()

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_get_history_success(override_provider):
    response = client.get("/api/history/AAPL?resolution=daily")
    assert response.status_code == 200
    assert response.json()[0]["open"] == 100.0

def test_get_history_invalid_symbol(override_provider_error):
    response = client.get("/api/history/INVALID")
    assert response.status_code == 404
