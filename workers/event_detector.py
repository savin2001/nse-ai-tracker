"""
NSE Event Detector
Scans news_articles and stock_prices for significant events,
classifies them, and stores in nse.detected_events.

Schedule: every hour (Mon-Fri)
Model:    claude-haiku-4-5-20251001 — fast & cheap for classification-only tasks.
          Pattern matching handles most events; Haiku is used only when a
          headline matches multiple patterns and we need a single best category.
"""
import json
from datetime import date, timedelta

import structlog
from dotenv import load_dotenv

from services.ai import HAIKU, UsageRecord, calculate_cost, get_ai, log_usage
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# ── Haiku classification prompt (used when ≥2 patterns match) ─────────────────
CLASSIFY_PROMPT = """You are an NSE market analyst. Given a news headline, choose
the single most relevant event type from this list:
earnings_release, dividend_declared, rights_issue, merger_acquisition,
regulatory_action, leadership_change, credit_rating, other

Headline: {title}

Respond with ONLY a JSON object: {{"event_type": "<type>", "severity": "<low|medium|high|critical>"}}\
"""

# ── Event pattern library ─────────────────────────────────────────────────────

NEWS_PATTERNS: list[tuple[str, list[str], str]] = [
    # (event_type, keywords, severity)
    ("earnings_release",   ["profit", "loss", "earnings", "results", "revenue", "turnover"], "high"),
    ("dividend_declared",  ["dividend", "payout", "distribution", "interim dividend"],        "high"),
    ("rights_issue",       ["rights issue", "rights offer", "share issue", "fundraise"],      "high"),
    ("merger_acquisition", ["merger", "acquisition", "takeover", "buyout", "stake"],          "critical"),
    ("regulatory_action",  ["cma", "regulator", "fine", "suspended", "investigation"],       "critical"),
    ("leadership_change",  ["ceo", "md ", "managing director", "chairman", "resigned", "appointed"], "medium"),
    ("credit_rating",      ["rating", "downgrade", "upgrade", "outlook", "moody", "fitch"],   "medium"),
]

# Price-based event thresholds
PRICE_SPIKE_PCT   = 5.0   # >5% single-day move
VOLUME_SURGE_MULT = 3.0   # >3x 20-day average volume


def detect_news_events(articles: list[dict]) -> list[dict]:
    events = []
    for article in articles:
        title = (article.get("title") or "").lower()
        ticker   = article.get("ticker")
        if not ticker or not title:
            continue

        for event_type, keywords, severity in NEWS_PATTERNS:
            if any(kw in title for kw in keywords):
                events.append({
                    "ticker":      ticker,
                    "event_type":  event_type,
                    "severity":    severity,
                    "description": f"[news] {article.get('title', '')[:250]}",
                    "metadata":    {
                        "source":       article.get("source"),
                        "url":          article.get("url"),
                        "published_at": article.get("published_at"),
                        "sentiment_score": article.get("sentiment_score"),
                    },
                })
                break  # one event per article
    return events


def detect_price_events(ticker: str, prices: list[dict]) -> list[dict]:
    """Detect price spikes and volume surges from recent OHLCV rows."""
    if len(prices) < 21:
        return []

    events = []
    latest = prices[0]
    prev   = prices[1]

    # Price spike
    if prev["close"] and prev["close"] > 0:
        pct = (latest["close"] - prev["close"]) / prev["close"] * 100
        if abs(pct) >= PRICE_SPIKE_PCT:
            direction = "surge" if pct > 0 else "drop"
            events.append({
                "ticker":      ticker,
                "event_type":  f"price_{direction}",
                "severity":    "high" if abs(pct) >= 10 else "medium",
                "description": f"Price {direction} of {pct:+.1f}% on {latest['date']}",
                "metadata":    {"pct_change": round(pct, 2), "date": latest["date"]},
            })

    # Volume surge (compare latest vs 20-day avg)
    volumes = [p["volume"] for p in prices[1:21] if p.get("volume")]
    if volumes and latest.get("volume"):
        avg_vol = sum(volumes) / len(volumes)
        if avg_vol > 0 and latest["volume"] / avg_vol >= VOLUME_SURGE_MULT:
            ratio = round(latest["volume"] / avg_vol, 1)
            events.append({
                "ticker":      ticker,
                "event_type":  "volume_surge",
                "severity":    "medium",
                "description": f"Volume {ratio}x above 20-day average on {latest['date']}",
                "metadata":    {"vol_ratio": ratio, "date": latest["date"]},
            })

    return events


def classify_with_haiku(
    ai: object,
    schema: object,
    title: str,
    ticker: str,
) -> tuple[str, str]:
    """
    Use Haiku to pick the best event_type when ≥2 patterns match.
    Returns (event_type, severity). Falls back to ('other', 'low') on error.
    """
    try:
        msg = ai.messages.create(
            model=HAIKU,
            max_tokens=64,
            messages=[{"role": "user",
                        "content": CLASSIFY_PROMPT.format(title=title)}],
        )
        rec = calculate_cost(HAIKU, msg.usage)
        log_usage(schema, rec, worker="event_detector",
                  task="event_classification", ticker=ticker)
        parsed = json.loads(msg.content[0].text.strip())
        return parsed.get("event_type", "other"), parsed.get("severity", "low")
    except Exception as exc:
        log.warning("haiku_classify_failed", ticker=ticker, error=str(exc))
        log_usage(
            schema,
            UsageRecord(model=HAIKU, input_tokens=0, output_tokens=0,
                        cache_read_tokens=0, cache_write_tokens=0, cost_usd=0.0),
            worker="event_detector", task="event_classification",
            ticker=ticker, succeeded=False, error_message=str(exc),
        )
        return "other", "low"


def detect_news_events(
    articles: list[dict],
    ai: object | None = None,
    schema: object | None = None,
) -> list[dict]:
    events = []
    for article in articles:
        title = (article.get("title") or "").lower()
        ticker   = article.get("ticker")
        if not ticker or not title:
            continue

        matches = [
            (event_type, severity)
            for event_type, keywords, severity in NEWS_PATTERNS
            if any(kw in title for kw in keywords)
        ]

        if not matches:
            continue

        if len(matches) == 1 or ai is None:
            event_type, severity = matches[0]
        else:
            # Multiple patterns matched — use Haiku to pick the best one
            event_type, severity = classify_with_haiku(
                ai, schema, article.get("title", ""), ticker
            )

        events.append({
            "ticker":      ticker,
            "event_type":  event_type,
            "severity":    severity,
            "description": f"[news] {article.get('title', '')[:250]}",
            "metadata":    {
                "source":       article.get("source"),
                "url":          article.get("url"),
                "published_at": article.get("published_at"),
                "sentiment_score": article.get("sentiment_score"),
            },
        })
    return events


def run() -> None:
    db     = get_db()
    ai     = get_ai()
    schema = nse(db)
    cutoff = str(date.today() - timedelta(days=2))
    total  = 0

    companies = schema.table("companies").select("ticker").execute().data

    for co in companies:
        ticker = co["ticker"]

        # ── News-based events ─────────────────────────────────────────────
        articles = (
            schema.table("news_articles")
            .select("ticker, title, source, url, published_at, sentiment_score")
            .eq("ticker", ticker)
            .gte("published_at", cutoff)
            .execute()
            .data
        )
        news_events = detect_news_events(articles, ai=ai, schema=schema)

        # ── Price-based events ────────────────────────────────────────────
        prices = (
            schema.table("stock_prices")
            .select("ticker, date, close, volume")
            .eq("ticker", ticker)
            .order("date", desc=True)
            .limit(22)
            .execute()
            .data
        )
        price_events = detect_price_events(ticker, prices)

        all_events = news_events + price_events
        for evt in all_events:
            try:
                schema.table("detected_events").insert(evt).execute()
                total += 1
            except Exception as exc:
                log.error("event_insert_failed", ticker=ticker, error=str(exc))

    log.info("event_detection_complete", events_inserted=total)


if __name__ == "__main__":
    run()
