"""
NSE Email Worker
Sends the daily signal digest via Gmail SMTP (no custom domain needed).

Schedule: 18:30 EAT (Mon-Fri) — runs after ai_worker generates signals at 18:00.
Also triggered ad-hoc via POST /api/notify/digest from the Express API.

Requires env:
  GMAIL_USER         — sender Gmail address (e.g. yourname@gmail.com)
  GMAIL_APP_PASSWORD — 16-char App Password from myaccount.google.com/apppasswords
  ALERT_EMAIL        — recipient address
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta, datetime, timezone

import structlog
from dotenv import load_dotenv

from services.db import get_db, nse

load_dotenv()
log = structlog.get_logger()

GMAIL_USER     = os.environ.get("GMAIL_USER", "")
GMAIL_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
ALERT_EMAIL    = os.environ.get("ALERT_EMAIL", "")

# ── HTML helpers ──────────────────────────────────────────────────────────────

SIGNAL_COLORS = {"BUY": "#10b981", "HOLD": "#f59e0b", "SELL": "#ef4444"}
SEVERITY_COLORS = {
    "critical": "#ef4444", "high": "#f97316",
    "medium":   "#f59e0b", "low":  "#3b82f6",
}


def _badge(text: str, bg: str, fg: str = "#000") -> str:
    return (f'<span style="background:{bg};color:{fg};padding:2px 10px;'
            f'border-radius:4px;font-weight:700;font-size:12px;">{text}</span>')


def _base_layout(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>{title}</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,sans-serif;color:#e4e4e7;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr>
        <td style="background:#18181b;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #27272a;">
          <span style="color:#10b981;font-size:20px;font-weight:700;">NSE AI Tracker</span>
          <span style="color:#71717a;font-size:13px;margin-left:12px;">Nairobi Securities Exchange</span>
        </td>
      </tr>
      <tr><td style="background:#18181b;padding:32px;border-radius:0 0 12px 12px;">{body}</td></tr>
      <tr>
        <td style="padding:20px 32px;text-align:center;">
          <p style="color:#52525b;font-size:11px;margin:0;">
            NSE AI Tracker · Not financial advice · AI signals are informational only.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _sentiment_label(score: float | None) -> tuple[str, str]:
    if score is None: return "—",          "#6b7280"
    if score >  0.1:  return "▲ Positive", "#10b981"
    if score < -0.1:  return "▼ Negative", "#ef4444"
    return "● Neutral", "#6b7280"


def build_digest_html(top5: list[dict], news_by_ticker: dict[str, list[dict]], date_str: str) -> str:
    blocks = ""
    for s in top5:
        color   = SIGNAL_COLORS.get(s["signal"], "#6b7280")
        badge   = _badge(s["signal"], color)
        summary = s.get("summary") or "—"
        ticker  = s["ticker"]

        news_rows = ""
        for n in news_by_ticker.get(ticker, [])[:3]:
            snt_label, snt_color = _sentiment_label(n.get("sentiment_score"))
            source = n.get("source") or ""
            url    = n.get("url", "")
            news_rows += (
                f'<tr style="border-bottom:1px solid #27272a;">'
                f'<td style="padding:8px 12px;">'
                f'  <span style="color:#d4d4d8;font-size:12px;line-height:1.5;display:block;">'
                f'    {n["title"][:110]}'
                f'  </span>'
                f'  <span style="display:block;color:{snt_color};font-size:10px;margin-top:3px;">'
                f'    {snt_label}{(" · " + source) if source else ""}'
                f'  </span>'
                f'  <a href="{url}" style="display:block;color:#52525b;font-size:10px;'
                f'     font-family:monospace;margin-top:4px;word-break:break-all;'
                f'     text-decoration:underline;">{url}</a>'
                f'</td>'
                f'</tr>'
            )

        news_section = ""
        if news_rows:
            news_section = f"""
<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid #27272a;border-radius:6px;border-collapse:collapse;margin-top:12px;">
  <tr style="background:#09090b;">
    <td style="padding:6px 12px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.05em;">
      Related News
    </td>
  </tr>
  {news_rows}
</table>"""

        blocks += f"""
<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid #27272a;border-radius:10px;border-collapse:collapse;margin-bottom:16px;">
  <tr style="background:#09090b;">
    <td style="padding:14px 16px;border-bottom:1px solid #27272a;">
      <span style="color:#10b981;font-family:monospace;font-weight:700;font-size:16px;">{ticker}</span>
      &nbsp;&nbsp;{badge}
      <span style="float:right;color:#a1a1aa;font-family:monospace;font-size:13px;">{s["confidence"]}% confidence</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 16px;color:#d4d4d8;font-size:13px;line-height:1.6;">
      {summary}{news_section}
    </td>
  </tr>
</table>"""

    body = f"""
<h1 style="color:#f4f4f5;font-size:20px;margin:0 0 4px;">Top 5 Movers — Daily Digest</h1>
<p style="color:#71717a;font-size:13px;margin:0 0 24px;">{date_str} · Ranked by AI confidence</p>
{blocks}
<p style="margin:24px 0 0;color:#52525b;font-size:12px;">
  Signals generated by Claude AI (claude-sonnet-4-6) · Not financial advice
</p>"""
    return _base_layout(f"NSE AI Top 5 — {date_str}", body)


def build_event_alert_html(event: dict) -> str:
    severity_color = SEVERITY_COLORS.get(event["severity"], "#6b7280")
    sev_badge = _badge(event["severity"].upper(), severity_color, "#fff")
    et = event["event_type"].replace("_", " ").title()
    detected = event.get("detected_at", "")

    body = f"""
<h1 style="color:#f4f4f5;font-size:20px;margin:0 0 4px;">
  Market Event Alert &nbsp;{sev_badge}
</h1>
<p style="color:#71717a;font-size:13px;margin:0 0 24px;">{detected}</p>
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#09090b;border:1px solid #27272a;border-radius:8px;border-collapse:collapse;">
  <tr>
    <td style="padding:16px 20px;border-bottom:1px solid #27272a;">
      <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Ticker</span>
      <span style="color:#10b981;font-family:monospace;font-weight:700;font-size:18px;">{event["ticker"]}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 20px;border-bottom:1px solid #27272a;">
      <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Event Type</span>
      <span style="color:#e4e4e7;font-weight:600;">{et}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 20px;">
      <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Description</span>
      <span style="color:#d4d4d8;line-height:1.6;">{event.get("description","")}</span>
    </td>
  </tr>
</table>"""
    return _base_layout(
        f"[{event['severity'].upper()}] {event['ticker']} — {et}", body
    )


# ── Send via Resend ───────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html: str) -> None:
    if not GMAIL_USER or not GMAIL_PASSWORD:
        raise ValueError("Missing GMAIL_USER or GMAIL_APP_PASSWORD — add them as GitHub Actions secrets")
    if not to or "@" not in to:
        raise ValueError(f"Invalid ALERT_EMAIL: {to!r} — set the ALERT_EMAIL GitHub Actions variable")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"NSE AI Tracker <{GMAIL_USER}>"
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.sendmail(GMAIL_USER, [to], msg.as_string())

    log.info("email_sent", to=to, subject=subject)


# ── Worker entrypoints ────────────────────────────────────────────────────────

def send_daily_digest() -> None:
    """Email the top 5 highest-confidence signals with corroborating news."""
    db     = get_db()
    schema = nse(db)

    all_signals = (
        schema.table("latest_signals")
        .select("ticker, signal, confidence, summary")
        .order("confidence", desc=True)
        .limit(5)
        .execute()
        .data
    )

    if not all_signals:
        log.warning("no_signals_today", date=str(date.today()))
        return

    # Fetch recent news for each of the top-5 tickers
    top5 = all_signals[:5]
    tickers = [s["ticker"] for s in top5]
    since = (datetime.now(tz=timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")

    news_rows = (
        schema.table("news_articles")
        .select("ticker, title, url, published_at, sentiment_score, source")
        .in_("ticker", tickers)
        .gte("published_at", since)
        .order("published_at", desc=True)
        .limit(15)
        .execute()
        .data or []
    )

    news_by_ticker: dict[str, list[dict]] = {}
    for n in news_rows:
        news_by_ticker.setdefault(n["ticker"], []).append(n)

    date_str = datetime.now(tz=timezone.utc).strftime("%A, %d %B %Y")
    html     = build_digest_html(top5, news_by_ticker, date_str)
    top1     = top5[0]
    subject  = (
        f"NSE AI Top 5 — {date_str} | "
        f"#{1} {top1['ticker']} {top1['signal']} {top1['confidence']}%"
    )
    send_email(ALERT_EMAIL, subject, html)


def send_high_severity_events() -> None:
    """Email any high/critical events detected in the last hour."""
    db     = get_db()
    schema = nse(db)

    events = (
        schema.table("detected_events")
        .select("*")
        .in_("severity", ["high", "critical"])
        .gte("detected_at", datetime.now(tz=timezone.utc)
             .strftime("%Y-%m-%dT%H:00:00Z"))
        .execute()
        .data
    )

    for event in events:
        try:
            et  = event["event_type"].replace("_", " ").title()
            sev = event["severity"].upper()
            send_email(
                ALERT_EMAIL,
                f"[{sev}] NSE Alert: {event['ticker']} — {et}",
                build_event_alert_html(event),
            )
        except Exception as exc:
            log.error("event_alert_failed", event_id=event.get("id"), error=str(exc))


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "digest"
    if cmd == "digest":
        send_daily_digest()
    elif cmd == "events":
        send_high_severity_events()
    else:
        print(f"Usage: python email_worker.py [digest|events]")
