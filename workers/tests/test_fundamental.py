"""Tests for analysis/fundamental.py"""
import pytest
from analysis.fundamental import FundamentalAnalysis, FundamentalScore


def stmt(revenue=None, net_income=None, eps=None, total_equity=None,
         debt_to_equity=None, period_type="annual", year=2024):
    return {
        "ticker": "TEST",
        "period_end": f"{year}-12-31",
        "period_type": period_type,
        "revenue": revenue,
        "net_income": net_income,
        "eps": eps,
        "total_assets": None,
        "total_equity": total_equity,
        "debt_to_equity": debt_to_equity,
        "pe_ratio": None,
        "dividend_yield": None,
    }


class TestFundamentalAnalysis:
    def test_no_statements_returns_hold(self):
        result = FundamentalAnalysis([]).analyse()
        assert result.signal == "HOLD"

    def test_no_annual_statements_returns_hold(self):
        result = FundamentalAnalysis([stmt(period_type="interim")]).analyse()
        assert result.signal == "HOLD"

    def test_low_pe_drives_buy(self):
        s = stmt(eps=4.0)
        result = FundamentalAnalysis([s], current_price=40.0).analyse()
        # P/E = 10 < 15 → +0.3
        assert result.score > 0
        assert result.metrics["pe_ratio"] == 10.0

    def test_high_pe_drives_sell(self):
        s = stmt(eps=1.0)
        result = FundamentalAnalysis([s], current_price=50.0).analyse()
        # P/E = 50 > 30 → -0.3
        assert result.score < 0

    def test_positive_net_margin_boosts_score(self):
        s = stmt(revenue=100_000_000, net_income=15_000_000)
        result = FundamentalAnalysis([s]).analyse()
        assert result.metrics["net_margin"] == pytest.approx(0.15, abs=0.001)
        assert result.score > 0

    def test_loss_making_penalises_score(self):
        s = stmt(revenue=100_000_000, net_income=-10_000_000)
        result = FundamentalAnalysis([s]).analyse()
        assert result.score < 0

    def test_revenue_growth_yoy(self):
        stmts = [
            stmt(revenue=120_000_000, year=2024),
            stmt(revenue=100_000_000, year=2023),
        ]
        result = FundamentalAnalysis(stmts).analyse()
        assert result.metrics["revenue_growth_yoy"] == pytest.approx(0.2, abs=0.01)
        assert result.score > 0

    def test_high_leverage_penalises(self):
        s = stmt(debt_to_equity=3.0)
        result = FundamentalAnalysis([s]).analyse()
        assert result.score < 0

    def test_score_within_bounds(self):
        s = stmt(eps=5.0, revenue=200_000_000, net_income=30_000_000, debt_to_equity=0.5)
        result = FundamentalAnalysis([s], current_price=50.0).analyse()
        assert -1.0 <= result.score <= 1.0

    def test_signal_buy_when_score_high_enough(self):
        # Low P/E + good margin + low leverage
        s = stmt(eps=5.0, revenue=100_000_000, net_income=12_000_000, debt_to_equity=0.4)
        result = FundamentalAnalysis([s], current_price=50.0).analyse()
        assert result.signal == "BUY"
