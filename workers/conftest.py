"""Shared pytest fixtures for all worker tests."""
import pytest
from unittest.mock import MagicMock, patch
from datetime import date
import pandas as pd


@pytest.fixture
def mock_db():
    """Mock Supabase client with chainable query builder."""
    db = MagicMock()
    schema = MagicMock()
    table = MagicMock()
    query = MagicMock()

    db.schema.return_value = schema
    schema.table.return_value = table
    table.select.return_value = query
    table.upsert.return_value = query
    table.insert.return_value = query
    query.eq.return_value = query
    query.gte.return_value = query
    query.order.return_value = query
    query.execute.return_value = MagicMock(data=[])

    return db


@pytest.fixture
def sample_ohlcv() -> pd.DataFrame:
    """A small OHLCV DataFrame mimicking yfinance output."""
    idx = pd.to_datetime(["2025-04-07", "2025-04-08", "2025-04-09"])
    return pd.DataFrame({
        "open":   [28.50, 29.00, 28.75],
        "high":   [29.20, 29.50, 29.10],
        "low":    [28.30, 28.80, 28.60],
        "close":  [29.00, 28.90, 29.05],
        "volume": [1_200_000, 980_000, 1_050_000],
    }, index=idx)


@pytest.fixture
def sample_prices() -> list[dict]:
    """Rows as returned from nse.stock_prices."""
    return [
        {"ticker": "SCOM", "date": "2025-04-09", "close": 29.05, "volume": 1_050_000},
        {"ticker": "SCOM", "date": "2025-04-08", "close": 28.90, "volume": 980_000},
        {"ticker": "SCOM", "date": "2025-04-07", "close": 29.00, "volume": 1_200_000},
        {"ticker": "SCOM", "date": "2025-03-25", "close": 27.50, "volume": 900_000},
        {"ticker": "SCOM", "date": "2025-03-14", "close": 26.80, "volume": 850_000},
    ]
