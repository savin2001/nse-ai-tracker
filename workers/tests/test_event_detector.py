"""Tests for event_detector.py"""
import sys
from unittest.mock import MagicMock

for mod in ("supabase", "structlog"):
    sys.modules.setdefault(mod, MagicMock())

import pytest
from event_detector import detect_news_events, detect_price_events


class TestDetectNewsEvents:
    def test_earnings_keyword_detected(self):
        articles = [{"ticker": "SCOM", "title": "Safaricom posts strong earnings results", "source": "BD", "url": None, "published_at": None, "sentiment_score": 0.5}]
        events = detect_news_events(articles)
        assert len(events) == 1
        assert events[0]["event_type"] == "earnings_release"
        assert events[0]["ticker"] == "SCOM"

    def test_dividend_detected(self):
        articles = [{"ticker": "EQTY", "title": "Equity Bank declares interim dividend", "source": "Nation", "url": None, "published_at": None, "sentiment_score": 0.3}]
        events = detect_news_events(articles)
        assert events[0]["event_type"] == "dividend_declared"

    def test_regulatory_action_critical_severity(self):
        articles = [{"ticker": "KCB", "title": "CMA launches investigation into KCB dealings", "source": "BD", "url": None, "published_at": None, "sentiment_score": -0.8}]
        events = detect_news_events(articles)
        assert events[0]["severity"] == "critical"

    def test_no_match_returns_empty(self):
        articles = [{"ticker": "SCOM", "title": "Safaricom AGM scheduled for June", "source": "BD", "url": None, "published_at": None, "sentiment_score": 0.0}]
        events = detect_news_events(articles)
        assert events == []

    def test_one_event_per_article(self):
        # Headline matches multiple categories — only first match captured
        articles = [{"ticker": "SCOM", "title": "Safaricom records earnings profit and dividend", "source": "BD", "url": None, "published_at": None, "sentiment_score": 0.6}]
        events = detect_news_events(articles)
        assert len(events) == 1

    def test_missing_ticker_skipped(self):
        articles = [{"ticker": None, "title": "Some company reports profit", "source": "BD", "url": None, "published_at": None, "sentiment_score": 0.0}]
        events = detect_news_events(articles)
        assert events == []


class TestDetectPriceEvents:
    def _make_prices(self, closes: list[float], volumes: list[int] | None = None) -> list[dict]:
        n = len(closes)
        vols = volumes or [1_000_000] * n
        prices = []
        for i, (c, v) in enumerate(zip(reversed(closes), reversed(vols))):
            prices.append({"ticker": "SCOM", "date": f"2025-04-{n-i:02d}", "close": c, "volume": v})
        return prices

    def test_price_surge_detected(self):
        closes = [30.0] * 20 + [32.0]  # +6.7%
        prices = self._make_prices(closes)
        events = detect_price_events("SCOM", prices)
        types = [e["event_type"] for e in events]
        assert "price_surge" in types

    def test_price_drop_detected(self):
        closes = [30.0] * 20 + [27.0]  # -10%
        prices = self._make_prices(closes)
        events = detect_price_events("SCOM", prices)
        types = [e["event_type"] for e in events]
        assert "price_drop" in types

    def test_volume_surge_detected(self):
        closes = [30.0] * 22
        vols = [1_000_000] * 21 + [4_000_000]
        prices = self._make_prices(closes, vols)
        events = detect_price_events("SCOM", prices)
        types = [e["event_type"] for e in events]
        assert "volume_surge" in types

    def test_normal_day_no_events(self):
        closes = [30.0] * 22
        prices = self._make_prices(closes)
        events = detect_price_events("SCOM", prices)
        assert events == []

    def test_insufficient_data_returns_empty(self):
        prices = [{"ticker": "SCOM", "date": "2025-04-01", "close": 30.0, "volume": 1_000_000}]
        events = detect_price_events("SCOM", prices)
        assert events == []
