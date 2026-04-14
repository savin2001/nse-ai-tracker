"""
NSE Event Detector
Scans news_articles and stock_prices for significant events,
classifies them, and stores in nse.detected_events.

Schedule: every hour (Mon-Fri)
"""
from datetime import date, timedelta, datetime, timezone

import structlog
from dotenv import load_dotenv

from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

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
        headline = (article.get("headline") or "").lower()
        ticker   = article.get("ticker")
        if not ticker or not headline:
            continue

        for event_type, keywords, severity in NEWS_PATTERNS:
            if any(kw in headline for kw in keywords):
                events.append({
                    "ticker":      ticker,
                    "event_type":  event_type,
                    "severity":    severity,
                    "description": f"[news] {article.get('headline', '')[:250]}",
                    "metadata":    {
                        "source":       article.get("source"),
                        "url":          article.get("url"),
                        "published_at": article.get("published_at"),
                        "sentiment":    article.get("sentiment"),
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


def run():
    db = get_db()
    schema = nse(db)
    cutoff = str(date.today() - timedelta(days=2))
    total = 0

    companies = schema.table("companies").select("ticker").execute().data

    for co in companies:
        ticker = co["ticker"]

        # ── News-based events ─────────────────────────────────────────────
        articles = (
            schema.table("news_articles")
            .select("ticker, headline, source, url, published_at, sentiment")
            .eq("ticker", ticker)
            .gte("published_at", cutoff)
            .execute()
            .data
        )
        news_events = detect_news_events(articles)

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
