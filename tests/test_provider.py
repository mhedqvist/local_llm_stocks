import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.providers.alpha_vantage import AlphaVantageMCPProvider

@pytest.mark.asyncio
async def test_alpha_vantage_provider_success():
    mock_response_json = {
        "Time Series (Daily)": {
            "2023-10-27": {
                "1. open": "150.0",
                "2. high": "155.0",
                "3. low": "149.0",
                "4. close": "152.0",
                "5. volume": "1000000"
            },
            "2023-10-26": {
                "1. open": "148.0",
                "2. high": "151.0",
                "3. low": "147.0",
                "4. close": "150.0",
                "5. volume": "900000"
            }
        }
    }

    provider = AlphaVantageMCPProvider(api_key="test_key")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        # Mock the response object
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_response_json
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        data = await provider.get_historical_data("AAPL", "daily")

        assert len(data) == 2
        # Check sorting (26th should be first)
        assert data[0].time < data[1].time
        # Check values of the first element
        assert data[0].open == 148.0
        assert data[0].close == 150.0

@pytest.mark.asyncio
async def test_alpha_vantage_provider_invalid_symbol():
    mock_response_json = {"Error Message": "Invalid symbol"}
    provider = AlphaVantageMCPProvider(api_key="test_key")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_response_json
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        with pytest.raises(ValueError, match="Invalid symbol"):
            await provider.get_historical_data("INVALID", "daily")

@pytest.mark.asyncio
async def test_alpha_vantage_provider_rate_limit():
    mock_response_json = {"Note": "Thank you for using Alpha Vantage! Our standard API rate limit is 5 calls per minute..."}
    provider = AlphaVantageMCPProvider(api_key="test_key")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_response_json
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        with pytest.raises(Exception, match="API Rate Limit Exceeded"):
            await provider.get_historical_data("AAPL", "daily")
