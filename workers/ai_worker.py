"""
NSE AI Analysis Worker
Combines technical, fundamental, and sentiment analysis into an
enriched prompt for Claude and generates BUY/HOLD/SELL signals.

Schedule: 18:00 EAT (Mon-Fri), after market close
Model:    claude-sonnet-4-6 (balanced cost/capability for signal generation)
Caching:  System prompt block cached — saves ~75 % on input tokens for
          the 20-stock daily run (~600 tokens × 20 = 12 000 tokens/run).
"""
import json
from datetime import date, timedelta

import pandas as pd
from dotenv import load_dotenv

from services.logging import configure_logging, get_logger

from analysis.fundamental import FundamentalAnalysis
from analysis.sentiment import SentimentAnalysis
from analysis.technical import TechnicalAnalysis
from models.analysis import AnalysisResult
from services.ai import SONNET, UsageRecord, calculate_cost, get_ai, log_usage
from services.circuit_breaker import CircuitOpenError, sonnet_breaker
from services.db import get_db, nse
from services.prompt_guard import (
    parse_and_validate_signal,
    sanitize_company_name,
    sanitize_headline,
    SignalValidationError,
)

load_dotenv()
configure_logging()
log = get_logger("ai_worker")

# ── System prompt (cached — changes rarely) ────────────────────────────────────
SYSTEM_PROMPT = (
    "You are a senior financial analyst specialising in the Nairobi Securities "
    "Exchange (NSE). You receive pre-computed technical, fundamental, and "
    "sentiment scores for a stock and must produce a consolidated investment "
    "signal. Be concise, data-driven, and aware of Kenya-specific macro risks "
    "(KES/USD rate, CBK policy rate, commodity prices). "
    "Respond ONLY with valid JSON — no markdown, no preamble."
)

USER_TEMPLATE = """## Stock
Ticker:  {ticker}
Company: {name}
Sector:  {sector}

## Technical Analysis
Signal: {tech_signal} (score: {tech_score:.3f})
{tech_reasons}
Indicators: {tech_indicators}

## Fundamental Analysis
Signal: {fund_signal} (score: {fund_score:.3f})
{fund_reasons}
Metrics: {fund_metrics}

## Sentiment Analysis
Signal: {sent_signal} (score: {sent_score:.3f})
{sent_reasons}
Articles analysed: {sent_count}

## Current Price Data
Close: KES {close}   SMA-20: {sma_20}   RSI-14: {rsi}

Respond with this JSON (no other text):
{{
  "signal": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence rationale integrating all three analyses>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "target_price": <number or null>,
  "time_horizon": "<e.g. 3-6 months>"
}}"""


def run() -> None:
    db     = get_db()
    ai     = get_ai()
    schema = nse(db)

    companies  = schema.table("companies").select("*").execute().data
    cutoff_35  = str(date.today() - timedelta(days=35))
    cutoff_7   = str(date.today() - timedelta(days=7))

    total_cost = 0.0
    processed  = 0
    errors     = 0
    sonnet_breaker.reset_cost()  # reset per-run cost accumulator

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
                .order("created_at", desc=True)
                .limit(6)
                .execute()
                .data
            )
            articles = (
                schema.table("news_articles")
                .select("title, sentiment_score, published_at")
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

            # Sanitise all external strings before prompt interpolation
            safe_name   = sanitize_company_name(co.get("name", ticker))
            safe_sector = sanitize_company_name(co.get("sector", "Unknown"))
            # Remap DB column names and sanitise headlines
            safe_articles = [
                {
                    **a,
                    "headline":  sanitize_headline(a.get("title", "")),
                    "sentiment": a.get("sentiment_score"),   # SentimentAnalysis expects "sentiment"
                }
                for a in articles
            ]

            tech = TechnicalAnalysis(df).analyse()
            fund = FundamentalAnalysis(financials, current_price=float(df.iloc[-1]["close"])).analyse()
            sent = SentimentAnalysis(safe_articles).analyse()
            last = df.iloc[-1]

            user_msg = USER_TEMPLATE.format(
                ticker=ticker,
                name=safe_name,
                sector=safe_sector,
                tech_signal=tech.signal,     tech_score=tech.score,
                tech_reasons="\n".join(f"- {r}" for r in tech.reasons) or "- N/A",
                tech_indicators=json.dumps(tech.indicators),
                fund_signal=fund.signal,     fund_score=fund.score,
                fund_reasons="\n".join(f"- {r}" for r in fund.reasons) or "- N/A",
                fund_metrics=json.dumps(fund.metrics),
                sent_signal=sent.signal,     sent_score=sent.score,
                sent_reasons="\n".join(f"- {r}" for r in sent.reasons) or "- N/A",
                sent_count=sent.article_count,
                close=round(float(last["close"]), 2),
                sma_20=tech.indicators.get("sma_20", "N/A"),
                rsi=tech.indicators.get("rsi", "N/A"),
            )

            # ── Call Claude via circuit breaker + cached system prompt ────
            try:
                with sonnet_breaker:
                    msg = ai.messages.create(
                        model=SONNET,
                        max_tokens=512,
                        system=[{
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }],
                        messages=[{"role": "user", "content": user_msg}],
                    )
            except CircuitOpenError as exc:
                log.error("circuit_open_skip", ticker=ticker, reason=str(exc))
                errors += 1
                continue

            usage_rec = calculate_cost(SONNET, msg.usage)
            total_cost += usage_rec.cost_usd
            sonnet_breaker.record_cost(usage_rec.cost_usd)
            log_usage(schema, usage_rec, worker="ai_worker",
                      task="signal_generation", ticker=ticker)

            # ── Validate + parse output ───────────────────────────────────
            raw = msg.content[0].text.strip()
            try:
                validated = parse_and_validate_signal(raw)
            except (SignalValidationError, ValueError) as exc:
                log.error("signal_validation_failed", ticker=ticker, error=str(exc))
                errors += 1
                continue
            result = AnalysisResult(ticker=ticker, **validated)

            row = result.to_db_row()
            row["raw_context"] = {
                "technical":   {"signal": tech.signal, "score": tech.score,
                                "indicators": tech.indicators},
                "fundamental": {"signal": fund.signal, "score": fund.score,
                                "metrics": fund.metrics},
                "sentiment":   {"signal": sent.signal, "score": sent.score,
                                "articles": sent.article_count},
                "ai_cost_usd": usage_rec.cost_usd,
            }
            schema.table("analysis_results").insert(row).execute()
            processed += 1
            log.info("signal_generated", ticker=ticker,
                     signal=result.signal, confidence=result.confidence,
                     cost_usd=usage_rec.cost_usd,
                     cache_read_tokens=usage_rec.cache_read_tokens)

        except Exception as exc:
            errors += 1
            log.error("signal_failed", ticker=ticker, error=str(exc))
            log_usage(
                schema,
                UsageRecord(model=SONNET, input_tokens=0, output_tokens=0,
                            cache_read_tokens=0, cache_write_tokens=0, cost_usd=0.0),
                worker="ai_worker", task="signal_generation",
                ticker=ticker, succeeded=False, error_message=str(exc),
            )

    log.info("run_complete", processed=processed, errors=errors,
             total_cost_usd=round(total_cost, 6))


if __name__ == "__main__":
    run()
