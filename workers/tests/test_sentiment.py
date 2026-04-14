"""Tests for analysis/sentiment.py"""
import pytest
from datetime import datetime, timedelta, timezone
from analysis.sentiment import SentimentAnalysis, SentimentScore


def article(sentiment: float, days_ago: int = 0) -> dict:
    pub = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return {"ticker": "SCOM", "headline": "Test", "sentiment": sentiment, "published_at": pub}


class TestSentimentAnalysis:
    def test_no_articles_returns_hold(self):
        result = SentimentAnalysis([]).analyse()
        assert result.signal == "HOLD"
        assert result.article_count == 0

    def test_articles_without_sentiment_ignored(self):
        result = SentimentAnalysis([{"ticker": "X", "sentiment": None}]).analyse()
        assert result.signal == "HOLD"

    def test_positive_recent_articles_return_buy(self):
        articles = [article(0.8, 0), article(0.6, 1), article(0.5, 2)]
        result = SentimentAnalysis(articles).analyse()
        assert result.signal == "BUY"
        assert result.score > 0.2

    def test_negative_recent_articles_return_sell(self):
        articles = [article(-0.7, 0), article(-0.5, 1), article(-0.6, 2)]
        result = SentimentAnalysis(articles).analyse()
        assert result.signal == "SELL"
        assert result.score < -0.2

    def test_old_articles_have_less_weight(self):
        # One strong positive 1 day ago vs one strong negative 30 days ago
        articles = [article(0.9, 1), article(-0.9, 30)]
        result = SentimentAnalysis(articles).analyse()
        # Recent positive should dominate
        assert result.score > 0

    def test_score_within_bounds(self):
        articles = [article(s, i) for i, s in enumerate([1.0, -1.0, 0.5, -0.3])]
        result = SentimentAnalysis(articles).analyse()
        assert -1.0 <= result.score <= 1.0

    def test_neutral_sentiment_returns_hold(self):
        articles = [article(0.0, 1), article(0.05, 2), article(-0.05, 3)]
        result = SentimentAnalysis(articles).analyse()
        assert result.signal == "HOLD"

    def test_article_count_correct(self):
        articles = [article(0.5, i) for i in range(5)]
        result = SentimentAnalysis(articles).analyse()
        assert result.article_count == 5

    def test_missing_published_at_handled(self):
        # With one article, recency weight cancels in the ratio — score equals sentiment.
        # Undated articles get 30-day age but the weighted avg still equals sentiment value.
        arts = [{"ticker": "X", "sentiment": 0.4, "published_at": None}]
        result = SentimentAnalysis(arts).analyse()
        assert result.score == pytest.approx(0.4, abs=0.01)
        assert result.signal == "BUY"  # 0.4 > BUY_THRESHOLD (0.2)
