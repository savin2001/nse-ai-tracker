"""
NSE Price Collector
Fetches daily OHLCV data for all tracked NSE tickers via yfinance
and upserts into nse.stock_prices.

Schedule: 09:00, 12:00, 15:00, 17:30 EAT (Mon-Fri)
"""
from datetime import date, timedelta

import structlog
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from models.stock import StockPrice
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# NSE tickers with Yahoo Finance suffix
NSE_TICKERS = [
    "SCOM.NR", "EQTY.NR", "KCB.NR",  "EABL.NR", "COOP.NR",
    "SCBK.NR", "ABSA.NR", "IMH.NR",  "DTK.NR",  "SBIC.NR",
    "BAMB.NR", "TOTL.NR", "KEGN.NR", "KPLC.NR", "NMG.NR",
    "KQ.NR",   "BOC.NR",  "SASN.NR", "HFCK.NR",
]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def fetch_ticker(symbol: str, start: date, end: date) -> pd.DataFrame:
    df = yf.download(symbol, start=str(start), end=str(end), progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    return df


def build_rows(symbol: str, df: pd.DataFrame) -> list[dict]:
    ticker = symbol.split(".")[0]
    rows = []
    for dt, row in df.iterrows():
        price = StockPrice(
            ticker=ticker,
            date=dt.date(),
            open=round(float(row.get("open", 0) or 0), 2),
            high=round(float(row.get("high", 0) or 0), 2),
            low=round(float(row.get("low",  0) or 0), 2),
            close=round(float(row.get("close", 0) or 0), 2),
            volume=int(row.get("volume", 0) or 0),
        )
        rows.append(price.to_db_row())
    return rows


def run():
    db = get_db()
    end = date.today()
    start = end - timedelta(days=5)

    for symbol in NSE_TICKERS:
        ticker = symbol.split(".")[0]
        try:
            df = fetch_ticker(symbol, start, end)
            if df.empty:
                log.warning("no_data", ticker=ticker)
                continue

            rows = build_rows(symbol, df)
            nse(db).table("stock_prices").upsert(rows, on_conflict="ticker,date").execute()
            log.info("upserted", ticker=ticker, rows=len(rows))

        except Exception as exc:
            log.error("fetch_failed", ticker=ticker, error=str(exc))


if __name__ == "__main__":
    run()
