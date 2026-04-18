"""
NSE Event Detector
Fetches live prices directly from TradingView (tvdatafeed) and scans
news_articles for significant events, then stores results in nse.detected_events.

Price events are detected from live TradingView data so the worker runs
independently — it doesn't depend on price_collector having run first.
Falls back to cached stock_prices if TV credentials are absent.

Deduplication: skips events with the same ticker + event_type already
inserted today so repeated runs don't create duplicates.

Schedule: every 2 h during market hours (Mon-Fri)
Model:    claude-haiku-4-5-20251001 — fast & cheap for classification-only.
"""
import json
import os
import time
from datetime import date, timedelta

import structlog
from dotenv import load_dotenv
from tvDatafeed import TvDatafeed, Interval

from services.ai import HAIKU, UsageRecord, calculate_cost, get_ai, log_usage
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

_tv: TvDatafeed = None

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
PRICE_SPIKE_PCT   = 5.0   # >5% single-day move triggers an alert
VOLUME_SURGE_MULT = 3.0   # >3x rolling-average volume triggers an alert


# ── Live price fetching ────────────────────────────────────────────────────────

def fetch_prices_live(ticker: str, n_bars: int = 25) -> list[dict]:
    """Fetch the most recent daily bars from TradingView (newest-first)."""
    try:
        df = _tv.get_hist(
            symbol=ticker, exchange="NSEKE",
            interval=Interval.in_daily, n_bars=n_bars,
        )
        if df is None or df.empty:
            return []
        df.columns = [c.lower() for c in df.columns]
        rows = []
        for dt, row in df.iterrows():
            rows.append({
                "date":   str(dt.date()),
                "close":  round(float(row.get("close",  0) or 0), 2),
                "volume": int(row.get("volume", 0) or 0),
            })
        rows.reverse()          # put newest first, matching DB query order
        return rows
    except Exception as exc:
        log.warning("tv_fetch_failed", ticker=ticker, error=str(exc))
        return []


# ── Event detection ────────────────────────────────────────────────────────────

def detect_price_events(ticker: str, prices: list[dict]) -> list[dict]:
    """Detect price spikes and volume surges from OHLCV rows (newest first)."""
    if len(prices) < 2:
        return []

    events = []
    latest = prices[0]
    prev   = prices[1]

    # Price spike — only needs two bars
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

    # Volume surge — use however many prior bars we have (up to 20)
    lookback = min(len(prices) - 1, 20)
    volumes  = [p["volume"] for p in prices[1:lookback + 1] if p.get("volume")]
    if len(volumes) >= 5 and latest.get("volume"):
        avg_vol = sum(volumes) / len(volumes)
        if avg_vol > 0 and latest["volume"] / avg_vol >= VOLUME_SURGE_MULT:
            ratio = round(latest["volume"] / avg_vol, 1)
            events.append({
                "ticker":      ticker,
                "event_type":  "volume_surge",
                "severity":    "medium",
                "description": f"Volume {ratio}x above {lookback}-day average on {latest['date']}",
                "metadata":    {"vol_ratio": ratio, "date": latest["date"]},
            })

    return events


def classify_with_haiku(
    ai: object,
    schema: object,
    title: str,
    ticker: str,
) -> tuple[str, str]:
    """Use Haiku to pick the best event_type when ≥2 patterns match.
    Returns (event_type, severity). Falls back to ('other', 'low') on error."""
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
        title  = (article.get("title") or "").lower()
        ticker = article.get("ticker")
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
            event_type, severity = classify_with_haiku(
                ai, schema, article.get("title", ""), ticker
            )

        events.append({
            "ticker":      ticker,
            "event_type":  event_type,
            "severity":    severity,
            "description": f"[news] {article.get('title', '')[:250]}",
            "metadata":    {
                "source":          article.get("source"),
                "url":             article.get("url"),
                "published_at":    article.get("published_at"),
                "sentiment_score": article.get("sentiment_score"),
            },
        })
    return events


# ── Worker entrypoint ─────────────────────────────────────────────────────────

def run() -> None:
    global _tv
    db     = get_db()
    ai     = get_ai()
    schema = nse(db)
    cutoff = str(date.today() - timedelta(days=2))
    today  = str(date.today())
    total  = 0

    # Connect to TradingView for live price fetching
    tv_user = os.environ.get("TV_USERNAME", "")
    tv_pass = os.environ.get("TV_PASSWORD", "")  # pragma: allowlist secret
    if tv_user and tv_pass:
        _tv = TvDatafeed(username=tv_user, password=tv_pass)  # pragma: allowlist secret
        log.info("tv_connected", mode="live")
    else:
        log.warning("tv_creds_missing", fallback="cached stock_prices")

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
        if _tv:
            prices = fetch_prices_live(ticker)
            time.sleep(0.5)     # stay within TradingView rate limits
        else:
            prices = (
                schema.table("stock_prices")
                .select("date, close, volume")
                .eq("ticker", ticker)
                .order("date", desc=True)
                .limit(25)
                .execute()
                .data
            )
        price_events = detect_price_events(ticker, prices)

        # ── Insert, skipping today's duplicates ───────────────────────────
        for evt in news_events + price_events:
            try:
                existing = (
                    schema.table("detected_events")
                    .select("id")
                    .eq("ticker", ticker)
                    .eq("event_type", evt["event_type"])
                    .gte("detected_at", today)
                    .execute()
                    .data
                )
                if existing:
                    continue
                schema.table("detected_events").insert(evt).execute()
                total += 1
            except Exception as exc:
                log.error("event_insert_failed", ticker=ticker, error=str(exc))

    log.info("event_detection_complete", events_inserted=total)


if __name__ == "__main__":
    run()
