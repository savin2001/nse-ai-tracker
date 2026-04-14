"""Pydantic models for stock market data."""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class StockPrice(BaseModel):
    ticker: str
    date: date
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[int] = None

    def to_db_row(self) -> dict:
        return {
            "ticker": self.ticker,
            "date": str(self.date),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }


class Company(BaseModel):
    ticker: str
    name: str
    sector: str
    market_cap: Optional[float] = None
    high_52w: Optional[float] = None
    low_52w: Optional[float] = None
    shares_outstanding: Optional[int] = None
    description: Optional[str] = None


class FinancialStatement(BaseModel):
    ticker: str
    period_end: date
    period_type: str = Field(pattern="^(annual|interim)$")
    revenue: Optional[float] = None
    net_income: Optional[float] = None
    eps: Optional[float] = None
    total_assets: Optional[float] = None
    total_equity: Optional[float] = None
    debt_to_equity: Optional[float] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    source_url: Optional[str] = None

    def to_db_row(self) -> dict:
        return {
            "ticker": self.ticker,
            "period_end": str(self.period_end),
            "period_type": self.period_type,
            "revenue": self.revenue,
            "net_income": self.net_income,
            "eps": self.eps,
            "total_assets": self.total_assets,
            "total_equity": self.total_equity,
            "debt_to_equity": self.debt_to_equity,
            "pe_ratio": self.pe_ratio,
            "dividend_yield": self.dividend_yield,
            "source_url": self.source_url,
        }
