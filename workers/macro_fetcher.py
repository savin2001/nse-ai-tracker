"""
NSE Macro Indicators Fetcher
Collects Kenya macroeconomic data (CBK rate, CPI, FX) and stores
in nse.macro_indicators.

Data sourced from:
  - USD/KES exchange rate: Yahoo Finance (USDKES=X)
  - CBK Base Rate:         static/manually updated until CBK provides an API
  - CPI / Inflation:       Kenya National Bureau of Statistics (KNBS) — static fallback

Schedule: daily 07:00 EAT
"""
from datetime import date

import structlog
import yfinance as yf
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from models.macro import MacroIndicator
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# Known CBK rates by effective date (updated manually each MPC meeting)
CBK_RATE_HISTORY: list[tuple[date, float]] = [
    (date(2024,  2, 6),  13.00),
    (date(2024,  4, 3),  13.50),
    (date(2024,  6, 5),  13.00),
    (date(2024,  8, 6),  12.75),
    (date(2024, 10, 8),  12.00),
    (date(2024, 12, 5),  11.25),
    (date(2025,  2, 5),  10.75),
    (date(2025,  4, 8),  10.00),
]

# Known CPI / inflation readings (KNBS monthly releases)
CPI_HISTORY: list[tuple[date, float]] = [
    (date(2024, 10, 1),  2.71),
    (date(2024, 11, 1),  2.83),
    (date(2024, 12, 1),  3.01),
    (date(2025,  1, 1),  3.30),
    (date(2025,  2, 1),  3.48),
    (date(2025,  3, 1),  3.60),
]


def latest_static(history: list[tuple[date, float]]) -> tuple[date, float]:
    return max(history, key=lambda x: x[0])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def fetch_fx_rate(pair: str = "USDKES=X") -> tuple[float, date]:
    ticker = yf.Ticker(pair)
    hist = ticker.history(period="2d")
    if hist.empty:
        raise ValueError(f"No data for {pair}")
    latest = hist.iloc[-1]
    return round(float(latest["Close"]), 4), hist.index[-1].date()


def run():
    db = get_db()
    schema = nse(db)
    today = date.today()
    indicators: list[MacroIndicator] = []

    # ── USD/KES exchange rate ─────────────────────────────────────────────
    try:
        rate, fx_date = fetch_fx_rate()
        indicators.append(MacroIndicator(
            indicator="usd_kes",
            value=rate,
            period_date=fx_date,
            source="Yahoo Finance",
            unit="KES",
            notes="USD to KES spot rate",
        ))
    except Exception as exc:
        log.error("fx_fetch_failed", error=str(exc))

    # ── CBK Base Rate ─────────────────────────────────────────────────────
    cbk_date, cbk_rate = latest_static(CBK_RATE_HISTORY)
    indicators.append(MacroIndicator(
        indicator="cbr_rate",
        value=cbk_rate,
        period_date=cbk_date,
        source="CBK",
        unit="%",
        notes="Central Bank Rate (MPC decision)",
    ))

    # ── CPI / Inflation ───────────────────────────────────────────────────
    cpi_date, cpi_value = latest_static(CPI_HISTORY)
    indicators.append(MacroIndicator(
        indicator="cpi_inflation",
        value=cpi_value,
        period_date=cpi_date,
        source="KNBS",
        unit="%",
        notes="Year-on-year CPI inflation rate",
    ))

    # ── Upsert all indicators ─────────────────────────────────────────────
    rows = [m.to_db_row() for m in indicators]
    try:
        schema.table("macro_indicators").upsert(
            rows, on_conflict="indicator,period_date"
        ).execute()
        log.info("macro_upserted", count=len(rows))
    except Exception as exc:
        log.error("macro_upsert_failed", error=str(exc))


if __name__ == "__main__":
    run()
