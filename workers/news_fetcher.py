"""
NSE News Fetcher
Pulls headlines from RSS feeds relevant to NSE-listed companies
and stores them in nse.news_articles with basic sentiment scoring.

Schedule: every 2 hours (Mon-Fri)
"""
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import structlog
from dotenv import load_dotenv

from models.news import NewsArticle
from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

# RSS feeds that cover NSE / Kenya business news
RSS_FEEDS = [
    "https://www.businessdailyafrica.com/rss/markets",
    "https://www.nation.africa/kenya/business/rss.xml",
    "https://www.standardmedia.co.ke/rss/business.php",
]

# Map keywords to NSE tickers
TICKER_KEYWORDS: dict[str, list[str]] = {
    "SCOM":  ["safaricom", "scom", "m-pesa", "mpesa"],
    "EQTY":  ["equity bank", "equity group", "eqty"],
    "KCB":   ["kcb", "kenya commercial bank"],
    "EABL":  ["eabl", "east african breweries", "tusker", "senator"],
    "COOP":  ["co-operative bank", "co-op bank", "coop"],
    "SCBK":  ["standard chartered", "stanchart", "scbk"],
    "ABSA":  ["absa", "barclays kenya"],
    "IMH":   ["im bank", "imh", "imperial bank"],
    "DTK":   ["diamond trust", "dtb", "dtk"],
    "SBIC":  ["stanbic", "sbic"],
    "TOTL":  ["total energies", "totl", "total kenya"],
    "KEGN":  ["kengen", "kegn"],
    "KPLC":  ["kenya power", "kplc"],
    "NMG":   ["nation media", "nmg"],
    "KQ":    ["kenya airways", "kq"],
    "BOC":   ["boc kenya", "boc gases"],
    "SASN":  ["sasini", "sasn"],
    "HFCK":  ["housing finance", "hfc", "hfck"],
    "NCBA":  ["ncba", "commercial bank of africa", "cba"],
}

# Simple positive/negative word lists for naive sentiment
POSITIVE_WORDS = {
    "profit", "growth", "gain", "rise", "surge", "strong", "record",
    "dividend", "upgrade", "beat", "expansion", "investment", "buy",
}
NEGATIVE_WORDS = {
    "loss", "decline", "fall", "drop", "weak", "downgrade", "miss",
    "debt", "fraud", "lawsuit", "cut", "risk", "sell", "warning",
}


def naive_sentiment(text: str) -> float:
    """Return a sentiment score in [-1.0, 1.0] based on keyword counts."""
    words = set(re.findall(r"\b\w+\b", text.lower()))
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 3)


def detect_ticker(text: str) -> Optional[str]:
    """Return the first NSE ticker whose keywords appear in the text."""
    lower = text.lower()
    for ticker, keywords in TICKER_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return ticker
    return None


def parse_published(entry) -> Optional[datetime]:
    try:
        if hasattr(entry, "published"):
            return parsedate_to_datetime(entry.published).astimezone(timezone.utc)
    except Exception:
        pass
    return None


def run():
    db = get_db()
    schema = nse(db)
    inserted = 0

    for feed_url in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
        except Exception as exc:
            log.error("feed_error", url=feed_url, error=str(exc))
            continue

        for entry in feed.entries:
            headline = entry.get("title", "").strip()
            text = headline + " " + entry.get("summary", "")
            ticker = detect_ticker(text)
            if not ticker:
                continue

            article = NewsArticle(
                ticker=ticker,
                headline=headline,
                source=feed.feed.get("title", feed_url),
                url=entry.get("link"),
                published_at=parse_published(entry),
                sentiment=naive_sentiment(text),
                summary=entry.get("summary", "")[:500] or None,
            )

            try:
                schema.table("news_articles").upsert(
                    article.to_db_row(),
                    on_conflict="ticker,url",
                ).execute()
                inserted += 1
            except Exception as exc:
                log.error("insert_error", ticker=ticker, error=str(exc))

    log.info("news_fetch_complete", articles_inserted=inserted)


if __name__ == "__main__":
    run()
