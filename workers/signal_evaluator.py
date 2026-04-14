"""
NSE Signal Evaluator
Looks up analysis_results from N days ago, compares the predicted
direction against actual price movement, and writes outcomes to
nse.signal_evaluations.

Schedule: daily 08:00 EAT
"""
from datetime import date, timedelta

import structlog
from dotenv import load_dotenv

from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

EVAL_AFTER_DAYS = 5   # evaluate signals that are 5 trading days old


def determine_outcome(signal: str, pct_change: float) -> str:
    """
    Map predicted signal + actual % change to an evaluation outcome.
    Tolerates ±1% as noise.
    """
    if signal == "BUY":
        if pct_change > 1.0:
            return "correct"
        if pct_change < -1.0:
            return "incorrect"
        return "partial"
    if signal == "SELL":
        if pct_change < -1.0:
            return "correct"
        if pct_change > 1.0:
            return "incorrect"
        return "partial"
    # HOLD: correct if within ±3%
    return "correct" if abs(pct_change) <= 3.0 else "incorrect"


def run():
    db = get_db()
    schema = nse(db)

    cutoff_start = str(date.today() - timedelta(days=EVAL_AFTER_DAYS + 2))
    cutoff_end   = str(date.today() - timedelta(days=EVAL_AFTER_DAYS))

    # Fetch signals generated around EVAL_AFTER_DAYS ago that have no evaluation yet
    pending = (
        schema.table("analysis_results")
        .select("id, ticker, signal, generated_at")
        .gte("generated_at", cutoff_start)
        .lte("generated_at", cutoff_end)
        .execute()
        .data
    )

    if not pending:
        log.info("no_signals_to_evaluate")
        return

    evaluated = 0
    for signal_row in pending:
        ticker      = signal_row["ticker"]
        analysis_id = signal_row["id"]
        signal      = signal_row["signal"]

        # Get price at signal time (most recent price on/before signal date)
        signal_date = signal_row["generated_at"][:10]
        prices_at   = (
            schema.table("stock_prices")
            .select("close, date")
            .eq("ticker", ticker)
            .lte("date", signal_date)
            .order("date", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not prices_at:
            continue
        price_at_signal = float(prices_at[0]["close"])

        # Get current (latest) price
        prices_now = (
            schema.table("stock_prices")
            .select("close, date")
            .eq("ticker", ticker)
            .order("date", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not prices_now:
            continue
        price_at_eval = float(prices_now[0]["close"])

        pct_change = round((price_at_eval - price_at_signal) / price_at_signal * 100, 4)
        outcome    = determine_outcome(signal, pct_change)

        try:
            schema.table("signal_evaluations").upsert(
                {
                    "analysis_id":     analysis_id,
                    "ticker":          ticker,
                    "price_at_signal": price_at_signal,
                    "price_at_eval":   price_at_eval,
                    "evaluated_at":    "now()",
                    "outcome":         outcome,
                    "pct_change":      pct_change,
                    "notes":           f"Evaluated {EVAL_AFTER_DAYS} days after signal",
                },
                on_conflict="analysis_id",
            ).execute()
            log.info("evaluated", ticker=ticker, signal=signal,
                     pct_change=pct_change, outcome=outcome)
            evaluated += 1
        except Exception as exc:
            log.error("eval_failed", ticker=ticker, error=str(exc))

    log.info("evaluation_complete", evaluated=evaluated)


if __name__ == "__main__":
    run()
