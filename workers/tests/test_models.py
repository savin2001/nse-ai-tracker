"""Tests for Pydantic models."""
import pytest
from datetime import date, datetime, timezone
from pydantic import ValidationError

from models.stock import StockPrice, Company, FinancialStatement
from models.news import NewsArticle
from models.macro import MacroIndicator
from models.analysis import AnalysisResult


class TestStockPrice:
    def test_valid(self):
        sp = StockPrice(ticker="SCOM", date=date(2025, 4, 9), close=29.05, volume=1_000_000)
        assert sp.ticker == "SCOM"
        assert sp.close == 29.05

    def test_to_db_row_formats_date(self):
        sp = StockPrice(ticker="KCB", date=date(2025, 1, 15), close=40.00)
        row = sp.to_db_row()
        assert row["date"] == "2025-01-15"
        assert row["ticker"] == "KCB"

    def test_optional_ohlv_defaults_to_none(self):
        sp = StockPrice(ticker="EQTY", date=date(2025, 4, 9), close=55.00)
        assert sp.open is None
        assert sp.volume is None


class TestFinancialStatement:
    def test_valid_annual(self):
        fs = FinancialStatement(ticker="SCOM", period_end=date(2024, 12, 31), period_type="annual")
        assert fs.period_type == "annual"

    def test_invalid_period_type(self):
        with pytest.raises(ValidationError):
            FinancialStatement(ticker="SCOM", period_end=date(2024, 12, 31), period_type="quarterly")

    def test_to_db_row(self):
        fs = FinancialStatement(
            ticker="SCOM", period_end=date(2024, 12, 31), period_type="annual",
            revenue=250_000_000.0, net_income=40_000_000.0,
        )
        row = fs.to_db_row()
        assert row["period_end"] == "2024-12-31"
        assert row["revenue"] == 250_000_000.0


class TestNewsArticle:
    def test_valid(self):
        article = NewsArticle(
            ticker="EABL",
            headline="EABL records strong Q2 profits",
            source="Business Daily",
            sentiment=0.6,
        )
        assert article.sentiment == 0.6

    def test_to_db_row_none_published(self):
        article = NewsArticle(ticker="KCB", headline="KCB expands to Tanzania", source="Nation")
        row = article.to_db_row()
        assert row["published_at"] is None

    def test_to_db_row_with_datetime(self):
        dt = datetime(2025, 4, 9, 10, 0, tzinfo=timezone.utc)
        article = NewsArticle(ticker="SCOM", headline="Test", source="Test", published_at=dt)
        row = article.to_db_row()
        assert "2025-04-09" in row["published_at"]


class TestMacroIndicator:
    def test_valid(self):
        m = MacroIndicator(indicator="cbr_rate", value=10.75, period_date=date(2025, 2, 5), source="CBK", unit="%")
        assert m.value == 10.75

    def test_to_db_row(self):
        m = MacroIndicator(indicator="usd_kes", value=129.5, period_date=date(2025, 4, 9), source="Yahoo Finance", unit="KES")
        row = m.to_db_row()
        assert row["period_date"] == "2025-04-09"
        assert row["value"] == 129.5


class TestAnalysisResult:
    def test_valid_buy(self):
        r = AnalysisResult(
            ticker="SCOM", signal="BUY", confidence=78,
            summary="Strong mobile money growth.", key_factors=["M-Pesa", "Ethiopia expansion"],
            risks=["Regulation", "Competition"], target_price=35.0, time_horizon="3-6 months",
        )
        assert r.signal == "BUY"
        assert r.confidence == 78

    def test_invalid_signal(self):
        with pytest.raises(ValidationError):
            AnalysisResult(
                ticker="SCOM", signal="STRONG BUY", confidence=90,
                summary="x", key_factors=[], risks=[],
            )

    def test_confidence_bounds(self):
        with pytest.raises(ValidationError):
            AnalysisResult(
                ticker="SCOM", signal="HOLD", confidence=150,
                summary="x", key_factors=[], risks=[],
            )

    def test_to_db_row(self):
        r = AnalysisResult(
            ticker="EQTY", signal="HOLD", confidence=55,
            summary="Stable outlook.", key_factors=["SME lending"], risks=["NPLs"],
        )
        row = r.to_db_row()
        assert row["signal"] == "HOLD"
        assert row["raw_context"] == {}
