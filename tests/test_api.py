import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from src.main import app, get_data_provider
from src.models.schemas import ChartDataPoint
from src.providers.base import BaseDataProvider
from src.providers.exceptions import RateLimitExceeded, UpstreamError

client = TestClient(app)

class MockProvider(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        return [
            ChartDataPoint(time=1698412800, open=100.0, high=110.0, low=90.0, close=105.0)
        ]

class MockProviderError(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        raise ValueError("Invalid symbol")

class MockProviderRateLimited(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        raise RateLimitExceeded("Too many requests")

class MockProviderUpstream(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        raise UpstreamError("Upstream provider unavailable")

class MockProviderUnexpected(BaseDataProvider):
    async def get_historical_data(self, symbol: str, resolution: str) -> list[ChartDataPoint]:
        raise RuntimeError("boom")

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

@pytest.fixture
def override_provider_rate_limited():
    app.dependency_overrides[get_data_provider] = lambda: MockProviderRateLimited()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def override_provider_upstream():
    app.dependency_overrides[get_data_provider] = lambda: MockProviderUpstream()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def override_provider_unexpected():
    app.dependency_overrides[get_data_provider] = lambda: MockProviderUnexpected()
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

def test_get_history_rate_limit_maps_to_429(override_provider_rate_limited):
    # Distinct symbol avoids the module-level history cache populated by the
    # earlier success test.
    response = client.get("/api/history/TESTRL?resolution=daily")
    assert response.status_code == 429
    assert "Too many requests" in response.json()["detail"]
    assert response.headers.get("Retry-After") == "15"

def test_get_history_upstream_error_maps_to_502(override_provider_upstream):
    response = client.get("/api/history/TESTUS?resolution=daily")
    assert response.status_code == 502
    assert "Upstream provider unavailable" in response.json()["detail"]

def test_get_history_unexpected_error_maps_to_500(override_provider_unexpected):
    response = client.get("/api/history/TESTUN?resolution=daily")
    assert response.status_code == 500
    assert "boom" in response.json()["detail"]
