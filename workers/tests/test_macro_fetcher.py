"""Tests for macro_fetcher."""
import sys
from unittest.mock import MagicMock

for mod in ("yfinance", "supabase", "structlog"):
    sys.modules.setdefault(mod, MagicMock())
import tenacity as _tc
_tc.retry = lambda *a, **kw: (lambda f: f)
_tc.stop_after_attempt = MagicMock(return_value=None)
_tc.wait_exponential = MagicMock(return_value=None)

import pytest
from datetime import date

from macro_fetcher import latest_static, CBK_RATE_HISTORY, CPI_HISTORY
from models.macro import MacroIndicator


class TestLatestStatic:
    def test_returns_most_recent_cbk_rate(self):
        d, rate = latest_static(CBK_RATE_HISTORY)
        assert isinstance(d, date)
        assert isinstance(rate, float)
        # Most recent should be >= all others
        assert d == max(entry[0] for entry in CBK_RATE_HISTORY)

    def test_returns_most_recent_cpi(self):
        d, value = latest_static(CPI_HISTORY)
        assert d == max(entry[0] for entry in CPI_HISTORY)


class TestMacroIndicatorModel:
    def test_cbk_indicator_valid(self):
        d, rate = latest_static(CBK_RATE_HISTORY)
        m = MacroIndicator(indicator="cbr_rate", value=rate, period_date=d, source="CBK", unit="%")
        row = m.to_db_row()
        assert row["indicator"] == "cbr_rate"
        assert row["unit"] == "%"

    def test_fx_indicator_valid(self):
        m = MacroIndicator(
            indicator="usd_kes", value=129.5,
            period_date=date(2025, 4, 9), source="Yahoo Finance", unit="KES"
        )
        assert m.value == 129.5
