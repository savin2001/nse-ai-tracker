"""Pydantic models for AI analysis results."""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    ticker: str
    signal: Literal["BUY", "HOLD", "SELL"]
    confidence: int = Field(ge=0, le=100)
    summary: str
    key_factors: List[str]
    risks: List[str]
    target_price: Optional[float] = None
    time_horizon: Optional[str] = None
    raw_context: Optional[dict] = None

    def to_db_row(self) -> dict:
        return {
            "ticker": self.ticker,
            "signal": self.signal,
            "confidence": self.confidence,
            "summary": self.summary,
            "key_factors": self.key_factors,
            "risks": self.risks,
            "target_price": self.target_price,
            "time_horizon": self.time_horizon,
            "raw_context": self.raw_context or {},
        }
