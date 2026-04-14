"""
Sentiment analysis engine.

Aggregates news article sentiments for a ticker with
exponential recency weighting and returns a scored signal.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal
import math


@dataclass
class SentimentScore:
    signal: Literal["BUY", "HOLD", "SELL"]
    score: float          # -1.0 → +1.0
    article_count: int = 0
    weighted_avg: float = 0.0
    reasons: list[str] = field(default_factory=list)


class SentimentAnalysis:
    """
    Compute an aggregate sentiment signal from news_articles rows.

    Each row must have: sentiment (float -1..1), published_at (ISO str or None).
    Recency weight: w = exp(-days_old / half_life_days)
    """

    HALF_LIFE_DAYS = 7     # sentiment older than ~7 days carries half the weight
    BUY_THRESHOLD  = 0.20
    SELL_THRESHOLD = -0.20

    def __init__(self, articles: list[dict], half_life_days: int = 7):
        self.articles = [a for a in articles if a.get("sentiment") is not None]
        self.half_life = half_life_days

    def _age_days(self, article: dict) -> float:
        raw = article.get("published_at")
        if not raw:
            return 30.0  # penalise undated articles
        try:
            if isinstance(raw, str):
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            else:
                dt = raw
            now = datetime.now(timezone.utc)
            return max(0.0, (now - dt.replace(tzinfo=dt.tzinfo or timezone.utc)).days)
        except Exception:
            return 30.0

    def analyse(self) -> SentimentScore:
        if not self.articles:
            return SentimentScore(signal="HOLD", score=0.0,
                                  reasons=["No news articles available"])

        total_weight = 0.0
        weighted_sum = 0.0
        decay_k = math.log(2) / self.half_life

        for article in self.articles:
            sentiment = float(article["sentiment"])
            age = self._age_days(article)
            weight = math.exp(-decay_k * age)
            weighted_sum += sentiment * weight
            total_weight += weight

        if total_weight == 0:
            return SentimentScore(signal="HOLD", score=0.0,
                                  reasons=["All articles have zero weight"])

        weighted_avg = weighted_sum / total_weight
        score = max(-1.0, min(1.0, weighted_avg))

        reasons: list[str] = []
        n = len(self.articles)

        if score >= self.BUY_THRESHOLD:
            signal = "BUY"
            reasons.append(f"Positive news sentiment ({score:+.2f}) across {n} articles")
        elif score <= self.SELL_THRESHOLD:
            signal = "SELL"
            reasons.append(f"Negative news sentiment ({score:+.2f}) across {n} articles")
        else:
            signal = "HOLD"
            reasons.append(f"Neutral news sentiment ({score:+.2f}) across {n} articles")

        return SentimentScore(
            signal=signal,
            score=round(score, 3),
            article_count=n,
            weighted_avg=round(weighted_avg, 4),
            reasons=reasons,
        )
