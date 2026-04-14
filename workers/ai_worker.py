"""
NSE AI Worker
Generates BUY/HOLD/SELL signals for each NSE ticker using Claude.

Schedule: 18:00 EAT (Mon-Fri), after market close
"""
import json
from datetime import date, timedelta

import structlog
from dotenv import load_dotenv

from models.analysis import AnalysisResult
from services.ai import get_ai
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

SIGNAL_PROMPT = """You are a financial analyst specialising in the Nairobi Securities Exchange.
Analyse the following stock data and generate an investment signal.

Ticker: {ticker}
Company: {name}
Sector: {sector}
Current Price: KES {price}
30-day Change: {change_30d}%
52W High: KES {high_52w}
52W Low: KES {low_52w}
Avg Daily Volume: {avg_volume}

Respond in this exact JSON (no markdown):
{{
  "signal": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence rationale>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "target_price": <number>,
  "time_horizon": "<e.g. 3-6 months>"
}}"""


def run():
    db = get_db()
    ai = get_ai()
    schema = nse(db)

    companies = schema.table("companies").select("*").execute().data
    cutoff = str(date.today() - timedelta(days=35))

    for co in companies:
        ticker = co["ticker"]
        try:
            prices = (
                schema.table("stock_prices")
                .select("close, volume, date")
                .eq("ticker", ticker)
                .gte("date", cutoff)
                .order("date", desc=True)
                .execute()
                .data
            )
            if len(prices) < 5:
                log.warning("insufficient_data", ticker=ticker)
                continue

            current = prices[0]["close"]
            oldest  = prices[-1]["close"]
            change_30d = round((current - oldest) / oldest * 100, 2) if oldest else 0
            avg_vol = int(sum(p["volume"] for p in prices) / len(prices))

            prompt = SIGNAL_PROMPT.format(
                ticker=ticker,
                name=co.get("name", ticker),
                sector=co.get("sector", "Unknown"),
                price=current,
                change_30d=change_30d,
                high_52w=co.get("high_52w", "N/A"),
                low_52w=co.get("low_52w", "N/A"),
                avg_volume=avg_vol,
            )

            msg = ai.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            result = AnalysisResult(ticker=ticker, **json.loads(raw))

            schema.table("analysis_results").insert(result.to_db_row()).execute()
            log.info("signal_generated", ticker=ticker, signal=result.signal)

        except Exception as exc:
            log.error("signal_failed", ticker=ticker, error=str(exc))


if __name__ == "__main__":
    run()
