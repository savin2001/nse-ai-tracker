"""Pydantic models for news articles."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NewsArticle(BaseModel):
    ticker: str
    headline: str
    source: str
    url: Optional[str] = None
    published_at: Optional[datetime] = None
    sentiment: Optional[float] = None  # -1.0 (negative) to 1.0 (positive)
    summary: Optional[str] = None
    raw_text: Optional[str] = None

    def to_db_row(self) -> dict:
        return {
            "ticker":          self.ticker,
            "title":           self.headline,       # DB column is "title"
            "source":          self.source,
            "url":             self.url,
            "published_at":    self.published_at.isoformat() if self.published_at else None,
            "sentiment_score": self.sentiment,      # DB column is "sentiment_score"
            "summary":         self.summary,
            "content":         self.raw_text,       # DB column is "content"
        }
