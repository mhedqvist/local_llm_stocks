import pytest
from src.utils.transformer import transform_alpha_vantage_to_chart_data, transform_alpha_vantage_to_stock_data
from src.models.schemas import AlphaVantagePricePoint

@pytest.fixture
def sample_raw_data():
    return {
        "2023-10-27": AlphaVantagePricePoint(
            **{"1. open": "150.0", "2. high": "155.0", "3. low": "149.0", "4. close": "152.0", "5. volume": "1000000"}
        ),
        "2023-10-26": AlphaVantagePricePoint(
            **{"1. open": "148.0", "2. high": "151.0", "3. low": "147.0", "4. close": "150.0", "5. volume": "900000"}
        ),
    }

def test_transform_alpha_vantage_to_chart_data(sample_raw_data):
    chart_data = transform_alpha_vantage_to_chart_data(sample_raw_data)
    
    assert len(chart_data) == 2
    # Check sorting (26th should be first)
    assert chart_data[0].time < chart_data[1].time
    # Check values of the first element
    assert chart_data[0].open == 148.0
    assert chart_data[0].close == 150.0

def test_transform_alpha_vantage_to_stock_data(sample_raw_data):
    stock_data = transform_alpha_vantage_to_stock_data(sample_raw_data)
    
    assert len(stock_data) == 2
    assert stock_data[0].timestamp < stock_data[1].timestamp
    assert stock_data[0].open == 148.0
    assert stock_data[0].volume == 900000

def test_transformer_invalid_date_format():
    invalid_data = {
        "invalid-date": AlphaVantagePricePoint(
            **{"1. open": "150.0", "2. high": "155.0", "3. low": "149.0", "4. close": "152.0", "5. volume": "1000000"}
        )
    }
    with pytest.raises(ValueError, match="Unknown date format"):
        transform_alpha_vantage_to_chart_data(invalid_data)
