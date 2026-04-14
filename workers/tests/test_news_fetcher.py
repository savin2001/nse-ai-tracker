"""Tests for news_fetcher — pure-logic functions only (no network, no feedparser)."""
import sys
from unittest.mock import MagicMock

# Stub packages unavailable in minimal local install
for mod in ("feedparser", "supabase", "structlog", "yfinance", "tenacity"):
    sys.modules.setdefault(mod, MagicMock())
# tenacity decorators need real callables — provide a passthrough retry
import tenacity as _tc
_tc.retry = lambda *a, **kw: (lambda f: f)
_tc.stop_after_attempt = MagicMock(return_value=None)
_tc.wait_exponential = MagicMock(return_value=None)

import pytest
from datetime import datetime, timezone
from news_fetcher import naive_sentiment, detect_ticker, parse_published


class TestNaiveSentiment:
    def test_positive_headline(self):
        score = naive_sentiment("Safaricom records record profit growth and dividend")
        assert score > 0

    def test_negative_headline(self):
        score = naive_sentiment("KCB reports loss amid rising debt and fraud risk")
        assert score < 0

    def test_neutral_headline(self):
        score = naive_sentiment("Equity Bank announces AGM date")
        assert score == 0.0

    def test_score_within_bounds(self):
        score = naive_sentiment("strong growth profit rise surge record beat expansion")
        assert -1.0 <= score <= 1.0


class TestDetectTicker:
    def test_safaricom_detected(self):
        assert detect_ticker("Safaricom posts strong M-Pesa revenues") == "SCOM"

    def test_kcb_detected(self):
        assert detect_ticker("KCB Group launches new SME product") == "KCB"

    def test_no_match_returns_none(self):
        assert detect_ticker("Government announces budget cuts") is None

    def test_case_insensitive(self):
        assert detect_ticker("EQUITY BANK reports Q3 results") == "EQTY"


class TestParsePublished:
    def test_valid_rfc2822(self):
        class FakeEntry:
            published = "Mon, 07 Apr 2025 08:00:00 +0300"
        result = parse_published(FakeEntry())
        assert result is not None
        assert result.tzinfo is not None

    def test_missing_published_returns_none(self):
        class FakeEntry:
            pass
        assert parse_published(FakeEntry()) is None

    def test_invalid_date_returns_none(self):
        class FakeEntry:
            published = "not-a-date"
        assert parse_published(FakeEntry()) is None
