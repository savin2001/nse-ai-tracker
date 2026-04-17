"""
NSE Financials Fetcher
Pulls annual and interim financial statements from Yahoo Finance
and stores them in nse.financials.

Schedule: weekly on Saturday 06:00 EAT
"""
from datetime import date

import structlog
import yfinance as yf
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

from models.stock import FinancialStatement
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# Tickers available on Yahoo Finance with .NR suffix
NSE_TICKERS = [
    "SCOM.NR", "EQTY.NR", "KCB.NR",  "EABL.NR", "COOP.NR",
    "SCBK.NR", "ABSA.NR", "IMH.NR",  "DTK.NR",  "SBIC.NR",
    "TOTL.NR", "KEGN.NR", "KPLC.NR", "NMG.NR",
    "KQ.NR",   "BOC.NR",  "SASN.NR", "HFCK.NR",
]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def fetch_financials(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol)


def safe_float(value) -> float | None:
    try:
        v = float(value)
        return round(v, 4) if v == v else None  # NaN check
    except (TypeError, ValueError):
        return None


def extract_statements(ticker_obj: yf.Ticker, ticker: str) -> list[FinancialStatement]:
    statements = []

    for period_type, income_stmt, balance in [
        ("annual",  ticker_obj.income_stmt,         ticker_obj.balance_sheet),
        ("interim", ticker_obj.quarterly_income_stmt, ticker_obj.quarterly_balance_sheet),
    ]:
        if income_stmt is None or income_stmt.empty:
            continue

        for col in income_stmt.columns:
            try:
                period_end = col.date() if hasattr(col, "date") else date.fromisoformat(str(col)[:10])
            except Exception:
                continue

            def get(df, *keys):
                for k in keys:
                    if df is not None and k in df.index:
                        return safe_float(df[col].get(k))
                return None

            revenue     = get(income_stmt, "Total Revenue", "TotalRevenue")
            net_income  = get(income_stmt, "Net Income", "NetIncome")
            eps         = get(income_stmt, "Basic EPS", "Diluted EPS", "EPS")
            total_assets = get(balance, "Total Assets", "TotalAssets")
            total_equity = get(balance, "Stockholders Equity", "Total Equity Gross Minority Interest")
            debt        = get(balance, "Total Debt", "Long Term Debt")
            de_ratio = round(debt / total_equity, 4) if debt and total_equity else None

            stmt = FinancialStatement(
                ticker=ticker,
                period_end=period_end,
                period_type=period_type,
                revenue=revenue,
                net_income=net_income,
                eps=eps,
                total_assets=total_assets,
                total_equity=total_equity,
                debt_to_equity=de_ratio,
                source_url=f"https://finance.yahoo.com/quote/{ticker}.NR/financials",
            )
            statements.append(stmt)

    return statements


def run():
    db = get_db()
    schema = nse(db)

    for symbol in NSE_TICKERS:
        ticker = symbol.split(".")[0]
        try:
            ticker_obj = fetch_financials(symbol)
            stmts = extract_statements(ticker_obj, ticker)
            if not stmts:
                log.warning("no_financials", ticker=ticker)
                continue

            rows = [s.to_db_row() for s in stmts]
            schema.table("financials").upsert(rows, on_conflict="ticker,period_end,period_type").execute()
            log.info("financials_upserted", ticker=ticker, rows=len(rows))

        except Exception as exc:
            log.error("financials_failed", ticker=ticker, error=str(exc))


if __name__ == "__main__":
    run()
