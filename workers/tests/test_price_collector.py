"""Tests for price_collector."""
import sys
from unittest.mock import MagicMock

# Stub packages unavailable in the minimal test install.
for mod in ("tvDatafeed", "supabase", "structlog"):
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
        rows = build_rows("SCOM", sample_ohlcv)
        assert len(rows) == 3

    def test_ticker_matches_symbol_arg(self, sample_ohlcv):
        rows = build_rows("SCOM", sample_ohlcv)
        assert all(r["ticker"] == "SCOM" for r in rows)

    def test_close_rounded_to_2dp(self, sample_ohlcv):
        rows = build_rows("KCB", sample_ohlcv)
        for r in rows:
            assert r["close"] == round(r["close"], 2)

    def test_date_serialised_as_string(self, sample_ohlcv):
        rows = build_rows("EQTY", sample_ohlcv)
        for r in rows:
            assert isinstance(r["date"], str)
            date.fromisoformat(r["date"])  # must parse without error

    def test_empty_dataframe_returns_empty_list(self):
        rows = build_rows("SCOM", pd.DataFrame())
        assert rows == []


class TestNSETickers:
    def test_20_tickers(self):
        assert len(NSE_TICKERS) == 20

    def test_limuru_included(self):
        assert "LIMURU" in NSE_TICKERS

    def test_symbols_are_bare(self):
        # NSEKE exchange code is added at fetch time; symbols stored without suffix
        assert all("." not in t for t in NSE_TICKERS)


class TestRun:
    @patch("price_collector.time.sleep")
    @patch("price_collector.fetch_ticker")
    @patch("price_collector.get_db")
    @patch("price_collector.nse")
    def test_upserts_on_success(self, mock_nse, mock_get_db, mock_fetch, mock_sleep,
                                sample_ohlcv, mock_db):
        mock_get_db.return_value = mock_db
        mock_nse.return_value = mock_db.schema.return_value
        mock_fetch.return_value = sample_ohlcv

        from price_collector import run
        run()

        assert mock_fetch.call_count == 20

    @patch("price_collector.time.sleep")
    @patch("price_collector.fetch_ticker")
    @patch("price_collector.get_db")
    @patch("price_collector.nse")
    def test_skips_empty_dataframe(self, mock_nse, mock_get_db, mock_fetch, mock_sleep,
                                   mock_db):
        mock_get_db.return_value = mock_db
        mock_nse.return_value = mock_db.schema.return_value
        mock_fetch.return_value = pd.DataFrame()

        from price_collector import run
        run()  # should not raise
