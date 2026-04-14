"""
NSE AI Analysis Worker
Combines technical, fundamental, and sentiment analysis into an
enriched prompt for Claude and generates BUY/HOLD/SELL signals.

Schedule: 18:00 EAT (Mon-Fri), after market close
"""
import json
from datetime import date, timedelta

import pandas as pd
import structlog
from dotenv import load_dotenv

from analysis.fundamental import FundamentalAnalysis
from analysis.sentiment import SentimentAnalysis
from analysis.technical import TechnicalAnalysis
from models.analysis import AnalysisResult
from services.ai import get_ai
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

SIGNAL_PROMPT = """You are a senior financial analyst specialising in the Nairobi Securities Exchange (NSE).
You have been provided with pre-computed technical, fundamental, and sentiment analysis for a stock.
Use this data to generate a final consolidated investment signal.

## Stock
Ticker:  {ticker}
Company: {name}
Sector:  {sector}

## Technical Analysis
Signal: {tech_signal} (score: {tech_score})
{tech_reasons}
Indicators: {tech_indicators}

## Fundamental Analysis
Signal: {fund_signal} (score: {fund_score})
{fund_reasons}
Metrics: {fund_metrics}

## Sentiment Analysis
Signal: {sent_signal} (score: {sent_score})
{sent_reasons}
Articles analysed: {sent_count}

## Current Price Data
Current Close: KES {close}
SMA-20: {sma_20}
RSI-14: {rsi}

Generate your consolidated signal. Respond ONLY with valid JSON (no markdown):
{{
  "signal": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence rationale integrating all three analyses>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "target_price": <number or null>,
  "time_horizon": "<e.g. 3-6 months>"
}}"""


def run():
    db  = get_db()
    ai  = get_ai()
    schema = nse(db)

    companies = schema.table("companies").select("*").execute().data
    cutoff_35 = str(date.today() - timedelta(days=35))
    cutoff_7  = str(date.today() - timedelta(days=7))

    for co in companies:
        ticker = co["ticker"]
        try:
            # ── Fetch raw data ────────────────────────────────────────────
            price_rows = (
                schema.table("stock_prices")
                .select("date, open, high, low, close, volume")
                .eq("ticker", ticker)
                .gte("date", cutoff_35)
                .order("date", desc=False)
                .execute()
                .data
            )
            if len(price_rows) < 5:
                log.warning("insufficient_prices", ticker=ticker)
                continue

            financials = (
                schema.table("financials")
                .select("*")
                .eq("ticker", ticker)
                .order("period_end", desc=True)
                .limit(6)
                .execute()
                .data
            )

            articles = (
                schema.table("news_articles")
                .select("headline, sentiment, published_at")
                .eq("ticker", ticker)
                .gte("published_at", cutoff_7)
                .execute()
                .data
            )

            # ── Run analysis engines ──────────────────────────────────────
            df = pd.DataFrame(price_rows)
            for col in ("open", "high", "low", "close"):
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype(int)

            tech  = TechnicalAnalysis(df).analyse()
            fund  = FundamentalAnalysis(financials, current_price=df.iloc[-1]["close"]).analyse()
            sent  = SentimentAnalysis(articles).analyse()

            last = df.iloc[-1]

            prompt = SIGNAL_PROMPT.format(
                ticker=ticker,
                name=co.get("name", ticker),
                sector=co.get("sector", "Unknown"),
                tech_signal=tech.signal,
                tech_score=tech.score,
                tech_reasons="\n".join(f"- {r}" for r in tech.reasons) or "- N/A",
                tech_indicators=json.dumps(tech.indicators),
                fund_signal=fund.signal,
                fund_score=fund.score,
                fund_reasons="\n".join(f"- {r}" for r in fund.reasons) or "- N/A",
                fund_metrics=json.dumps(fund.metrics),
                sent_signal=sent.signal,
                sent_score=sent.score,
                sent_reasons="\n".join(f"- {r}" for r in sent.reasons) or "- N/A",
                sent_count=sent.article_count,
                close=round(float(last["close"]), 2),
                sma_20=tech.indicators.get("sma_20", "N/A"),
                rsi=tech.indicators.get("rsi", "N/A"),
            )

            msg = ai.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw    = msg.content[0].text.strip()
            parsed = json.loads(raw)
            result = AnalysisResult(ticker=ticker, **parsed)

            row = result.to_db_row()
            row["raw_context"] = {
                "technical":   {"signal": tech.signal, "score": tech.score, "indicators": tech.indicators},
                "fundamental": {"signal": fund.signal, "score": fund.score, "metrics": fund.metrics},
                "sentiment":   {"signal": sent.signal, "score": sent.score, "articles": sent.article_count},
            }

            schema.table("analysis_results").insert(row).execute()
            log.info("signal_generated", ticker=ticker,
                     signal=result.signal, confidence=result.confidence)

        except Exception as exc:
            log.error("signal_failed", ticker=ticker, error=str(exc))


if __name__ == "__main__":
    run()
