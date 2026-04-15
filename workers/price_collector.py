"""
NSE Price Collector
Fetches daily OHLCV data for all tracked NSE tickers via Stooq
(pandas-datareader) and upserts into nse.stock_prices.

Schedule: 09:00, 12:00, 15:00, 17:30 EAT (Mon-Fri)

Data source note: Yahoo Finance (yfinance) rate-limits GitHub Actions IPs
even with batch downloads. We use Stooq via pandas-datareader instead —
it supports NSE Kenya tickers with the .KE suffix and is not restricted
on CI runners. Each ticker is fetched individually with a short polite delay.
"""
import time
from datetime import date, timedelta

import pandas as pd
import pandas_datareader.data as pdr
import structlog
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from models.stock import StockPrice
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# NSE tickers — bare symbols (no exchange suffix)
NSE_TICKERS = [
    "SCOM", "EQTY", "KCB",  "EABL", "COOP",
    "SCBK", "ABSA", "IMH",  "DTK",  "SBIC",
    "BAMB", "TOTL", "KEGN", "KPLC", "NMG",
    "KQ",   "BOC",  "SASN", "HFCK",
]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=3, max=20))
def fetch_ticker(symbol: str, start: date, end: date) -> pd.DataFrame:
    """Download a single NSE ticker from Stooq using the .KE suffix."""
    df = pdr.DataReader(f"{symbol}.KE", "stooq", start=str(start), end=str(end))
    if df.empty:
        return df
    df.columns = [c.lower() for c in df.columns]
    df = df.sort_index()           # Stooq returns newest-first; sort ascending
    return df.dropna(subset=["close"])


def build_rows(symbol: str, df: pd.DataFrame) -> list[dict]:
    rows = []
    for dt, row in df.iterrows():
        price = StockPrice(
            ticker=symbol,
            date=dt.date() if hasattr(dt, "date") else dt,
            open=round(float(row.get("open",   0) or 0), 2),
            high=round(float(row.get("high",   0) or 0), 2),
            low=round(float(row.get("low",     0) or 0), 2),
            close=round(float(row.get("close", 0) or 0), 2),
            volume=int(row.get("volume", 0) or 0),
        )
        rows.append(price.to_db_row())
    return rows


def run():
    db    = get_db()
    end   = date.today()
    start = end - timedelta(days=10)  # buffer to catch weekends and holidays

    total_rows = 0
    for symbol in NSE_TICKERS:
        try:
            df = fetch_ticker(symbol, start, end)
            if df.empty:
                log.warning("no_data", ticker=symbol)
                continue

            rows = build_rows(symbol, df)
            nse(db).table("stock_prices").upsert(rows, on_conflict="ticker,date").execute()
            total_rows += len(rows)
            log.info("upserted", ticker=symbol, rows=len(rows))

        except Exception as exc:
            log.error("fetch_or_upsert_failed", ticker=symbol, error=str(exc))

        finally:
            time.sleep(0.5)   # polite delay between Stooq requests

    log.info("price_collection_complete", total_rows=total_rows)


if __name__ == "__main__":
    run()
