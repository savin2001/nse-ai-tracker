"""
NSE Price Collector
Fetches daily OHLCV data for all tracked NSE tickers via yfinance
and upserts into Supabase stock_prices table.

Schedule: 09:00, 12:00, 15:00, 17:30 EAT (Mon-Fri)
"""
import os
import structlog
import yfinance as yf
import pandas as pd
from datetime import date, timedelta
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv
from services.db import get_db

load_dotenv()
log = structlog.get_logger()

# NSE tickers with Yahoo Finance suffix
NSE_TICKERS = [
    "SCOM.NR", "EQTY.NR", "KCB.NR", "EABL.NR", "COOP.NR",
    "SCBK.NR", "ABSA.NR", "IMH.NR",  "DTK.NR",  "SBIC.NR",
    "BAMB.NR", "TOTL.NR", "KEGN.NR", "KPLC.NR", "NMG.NR",
    "KQ.NR",   "BOC.NR",  "SASN.NR", "HFCK.NR",
]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def fetch_ticker(symbol: str, start: date, end: date) -> pd.DataFrame:
    df = yf.download(symbol, start=str(start), end=str(end), progress=False)
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    return df


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

            rows = []
            for dt, row in df.iterrows():
                rows.append({
                    "ticker": ticker,
                    "date": str(dt.date()),
                    "open":  round(float(row.get("open",  0)), 2),
                    "high":  round(float(row.get("high",  0)), 2),
                    "low":   round(float(row.get("low",   0)), 2),
                    "close": round(float(row.get("close", 0)), 2),
                    "volume": int(row.get("volume", 0)),
                })

            db.table("stock_prices").upsert(rows, on_conflict="ticker,date").execute()
            log.info("upserted", ticker=ticker, rows=len(rows))

        except Exception as exc:
            log.error("fetch_failed", ticker=ticker, error=str(exc))


if __name__ == "__main__":
    run()
