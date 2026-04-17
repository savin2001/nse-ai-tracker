"""
NSE Price Collector
Fetches daily OHLCV data for all tracked NSE tickers via TradingView
(tvdatafeed, exchange NSEKE) and upserts into nse.stock_prices.

Schedule: 09:00, 12:00, 15:00, 17:30 EAT (Mon-Fri)

Credentials: TV_USERNAME and TV_PASSWORD env vars (free TradingView account).
"""
import os
import time
from datetime import date, timedelta

import pandas as pd
import structlog
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from tvDatafeed import TvDatafeed, Interval

from models.stock import StockPrice
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# NSE tickers — bare symbols (NSEKE exchange code added at fetch time)
# BAMB excluded: delisted 2023 (acquired by Savannah Clinker)
# LIMURU excluded: not carried by TradingView NSEKE
NSE_TICKERS = [
    "SCOM",  "EQTY",  "KCB",   "EABL",  "COOP",
    "SCBK",  "ABSA",  "IMH",   "DTK",   "SBIC",
    "TOTL",  "KEGN",  "KPLC",  "NMG",
    "KQ",    "BOC",   "SASN",  "HFCK",
]

_tv: TvDatafeed = None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=3, max=20))
def fetch_ticker(symbol: str, start: date, end: date) -> pd.DataFrame:
    """Download a single NSE ticker from TradingView (exchange NSEKE)."""
    df = _tv.get_hist(symbol=symbol, exchange="NSEKE", interval=Interval.in_daily, n_bars=20)
    if df is None or df.empty:
        return pd.DataFrame()
    df.columns = [c.lower() for c in df.columns]
    df = df[["open", "high", "low", "close", "volume"]]
    df = df.loc[pd.Timestamp(start):pd.Timestamp(end)]
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
    global _tv
    _tv = TvDatafeed(
        username=os.environ.get("TV_USERNAME", ""),
        password=os.environ.get("TV_PASSWORD", ""),
    )

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
            time.sleep(1)

    log.info("price_collection_complete", total_rows=total_rows)


if __name__ == "__main__":
    run()
