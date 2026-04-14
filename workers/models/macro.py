"""Pydantic models for macroeconomic indicators."""
from datetime import date
from typing import Optional
from pydantic import BaseModel


class MacroIndicator(BaseModel):
    indicator: str   # e.g. "cbr_rate", "cpi_inflation", "usd_kes"
    value: float
    period_date: date
    source: str      # e.g. "CBK", "KNBS", "NSE"
    unit: Optional[str] = None   # e.g. "%", "KES"
    notes: Optional[str] = None

    def to_db_row(self) -> dict:
        return {
            "indicator": self.indicator,
            "value": self.value,
            "period_date": str(self.period_date),
            "source": self.source,
            "unit": self.unit,
            "notes": self.notes,
        }
