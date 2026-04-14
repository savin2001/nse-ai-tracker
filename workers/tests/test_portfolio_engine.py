"""Tests for portfolio_engine.py"""
import pytest
from portfolio_engine import generate_report, _decide_action, Recommendation


class TestDecideAction:
    def test_strong_buy_no_position_enters(self):
        action, weight, rationale = _decide_action("BUY", 80, 0.0)
        assert action == "ENTER"
        assert weight > 0
        assert "initiate" in rationale.lower()

    def test_strong_buy_with_position_increases(self):
        action, weight, _ = _decide_action("BUY", 80, 0.05)
        assert action == "INCREASE"
        assert weight > 0.05

    def test_increase_capped_at_15pct(self):
        _, weight, _ = _decide_action("BUY", 80, 0.20)
        assert weight <= 0.15

    def test_moderate_buy_holds(self):
        action, weight, _ = _decide_action("BUY", 50, 0.05)
        assert action == "HOLD"
        assert weight == 0.05

    def test_strong_sell_with_position_exits(self):
        action, weight, _ = _decide_action("SELL", 75, 0.10)
        assert action == "EXIT"
        assert weight == 0.0

    def test_strong_sell_no_position_holds(self):
        action, _, _ = _decide_action("SELL", 75, 0.0)
        assert action == "HOLD"

    def test_moderate_sell_decreases(self):
        action, weight, _ = _decide_action("SELL", 55, 0.10)
        assert action == "DECREASE"
        assert weight < 0.10

    def test_hold_signal_maintains_weight(self):
        action, weight, _ = _decide_action("HOLD", 60, 0.08)
        assert action == "HOLD"
        assert weight == 0.08


class TestGenerateReport:
    def _allocations(self):
        return [
            {"ticker": "SCOM", "weight": 0.10},
            {"ticker": "EQTY", "weight": 0.05},
        ]

    def _signals(self):
        return [
            {"ticker": "SCOM", "signal": "BUY",  "confidence": 80},
            {"ticker": "EQTY", "signal": "SELL", "confidence": 75},
            {"ticker": "KCB",  "signal": "BUY",  "confidence": 72},  # not in portfolio
        ]

    def test_report_has_user_id(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        assert report.user_id == "user-123"

    def test_recommendations_cover_all_allocations(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        tickers = {r.ticker for r in report.recommendations}
        assert "SCOM" in tickers
        assert "EQTY" in tickers

    def test_new_strong_buy_enters_portfolio(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        entries = [r for r in report.recommendations if r.action == "ENTER"]
        assert any(r.ticker == "KCB" for r in entries)

    def test_strong_sell_exits_position(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        exits = [r for r in report.recommendations if r.action == "EXIT"]
        assert any(r.ticker == "EQTY" for r in exits)

    def test_total_drift_non_negative(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        assert report.total_drift >= 0

    def test_summary_dict_structure(self):
        report = generate_report("user-123", self._allocations(), self._signals())
        summary = report.summary()
        assert "user_id" in summary
        assert "recommendations" in summary
        assert "total_drift" in summary

    def test_no_signal_recommendation_is_hold(self):
        allocs = [{"ticker": "BOC", "weight": 0.05}]
        report = generate_report("user-999", allocs, [])
        assert report.recommendations[0].action == "HOLD"
        assert report.recommendations[0].signal == "N/A"
