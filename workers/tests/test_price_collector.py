"""Tests for price_collector."""
import sys
from unittest.mock import MagicMock

# Stub packages unavailable in minimal local install
for mod in ("yfinance", "supabase", "structlog"):
    sys.modules.setdefault(mod, MagicMock())
import tenacity as _tc
_tc.retry = lambda *a, **kw: (lambda f: f)
_tc.stop_after_attempt = MagicMock(return_value=None)
_tc.wait_exponential = MagicMock(return_value=None)

import pytest
from datetime import date
from unittest.mock import patch
import pandas as pd

from price_collector import build_rows, NSE_TICKERS


class TestBuildRows:
    def test_returns_one_row_per_date(self, sample_ohlcv):
        rows = build_rows("SCOM.NR", sample_ohlcv)
        assert len(rows) == 3

    def test_ticker_stripped_of_suffix(self, sample_ohlcv):
        rows = build_rows("SCOM.NR", sample_ohlcv)
        assert all(r["ticker"] == "SCOM" for r in rows)

    def test_close_rounded_to_2dp(self, sample_ohlcv):
        rows = build_rows("KCB.NR", sample_ohlcv)
        for r in rows:
            assert r["close"] == round(r["close"], 2)

    def test_date_serialised_as_string(self, sample_ohlcv):
        rows = build_rows("EQTY.NR", sample_ohlcv)
        for r in rows:
            assert isinstance(r["date"], str)
            date.fromisoformat(r["date"])  # must parse without error

    def test_empty_dataframe_returns_empty_list(self):
        rows = build_rows("SCOM.NR", pd.DataFrame())
        assert rows == []


class TestNSETickers:
    def test_19_tickers(self):
        assert len(NSE_TICKERS) == 19

    def test_all_have_nr_suffix(self):
        assert all(t.endswith(".NR") for t in NSE_TICKERS)


class TestRun:
    @patch("price_collector.fetch_ticker")
    @patch("price_collector.get_db")
    @patch("price_collector.nse")
    def test_upserts_on_success(self, mock_nse, mock_get_db, mock_fetch, sample_ohlcv, mock_db):
        mock_get_db.return_value = mock_db
        mock_nse.return_value = mock_db.schema.return_value
        mock_fetch.return_value = sample_ohlcv

        from price_collector import run
        run()

        assert mock_fetch.call_count == 19

    @patch("price_collector.fetch_ticker")
    @patch("price_collector.get_db")
    @patch("price_collector.nse")
    def test_skips_empty_dataframe(self, mock_nse, mock_get_db, mock_fetch, mock_db):
        mock_get_db.return_value = mock_db
        mock_nse.return_value = mock_db.schema.return_value
        mock_fetch.return_value = pd.DataFrame()

        from price_collector import run
        run()  # should not raise
