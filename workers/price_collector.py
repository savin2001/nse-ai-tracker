"""
NSE Price Collector
Fetches daily OHLCV data for all tracked NSE tickers via yfinance
and upserts into nse.stock_prices.

Schedule: 09:00, 12:00, 15:00, 17:30 EAT (Mon-Fri)

Rate-limit note: GitHub Actions IPs are heavily rate-limited by Yahoo Finance
when making per-ticker requests. We download ALL tickers in a single batch
call (one HTTP request) to minimise the chance of triggering rate limits.
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


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=3, min=5, max=30))
def fetch_all(tickers: list[str], start: date, end: date) -> pd.DataFrame:
    """Download all tickers in a single batch request to avoid per-IP rate limits."""
    df = yf.download(
        tickers,
        start=str(start),
        end=str(end),
        progress=False,
        group_by="ticker",
        auto_adjust=True,
    )
    return df


def extract_ticker_df(raw: pd.DataFrame, symbol: str) -> pd.DataFrame:
    """Slice per-ticker data out of a multi-ticker batch download."""
    if symbol not in raw.columns.get_level_values(0):
        return pd.DataFrame()
    df = raw[symbol].copy()
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    df = df.dropna(subset=["close"])
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
    db    = get_db()
    end   = date.today()
    start = end - timedelta(days=7)   # extra buffer to catch weekend gaps

    try:
        raw = fetch_all(NSE_TICKERS, start, end)
    except Exception as exc:
        log.error("batch_fetch_failed", error=str(exc))
        return

    total_rows = 0
    for symbol in NSE_TICKERS:
        ticker = symbol.split(".")[0]
        try:
            df = extract_ticker_df(raw, symbol)
            if df.empty:
                log.warning("no_data", ticker=ticker)
                continue

            rows = build_rows(symbol, df)
            nse(db).table("stock_prices").upsert(rows, on_conflict="ticker,date").execute()
            total_rows += len(rows)
            log.info("upserted", ticker=ticker, rows=len(rows))

        except Exception as exc:
            log.error("upsert_failed", ticker=ticker, error=str(exc))

    log.info("price_collection_complete", total_rows=total_rows)


if __name__ == "__main__":
    run()
