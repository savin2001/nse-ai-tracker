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


def build_digest_html(signals: list[dict], date_str: str) -> str:
    buys  = sum(1 for s in signals if s["signal"] == "BUY")
    holds = sum(1 for s in signals if s["signal"] == "HOLD")
    sells = sum(1 for s in signals if s["signal"] == "SELL")

    rows = ""
    for s in sorted(signals, key=lambda x: -x["confidence"])[:15]:
        color  = SIGNAL_COLORS.get(s["signal"], "#6b7280")
        badge  = _badge(s["signal"], color)
        summary = (s.get("summary") or "")[:90]
        rows += (
            f'<tr style="border-bottom:1px solid #27272a;">'
            f'<td style="padding:10px 8px;font-family:monospace;font-weight:700;color:#e4e4e7;">{s["ticker"]}</td>'
            f'<td style="padding:10px 8px;">{badge}</td>'
            f'<td style="padding:10px 8px;font-family:monospace;color:#a1a1aa;">{s["confidence"]}%</td>'
            f'<td style="padding:10px 8px;color:#a1a1aa;font-size:12px;">{summary}…</td>'
            f'</tr>'
        )

    body = f"""
<h1 style="color:#f4f4f5;font-size:20px;margin:0 0 4px;">Daily Signal Digest</h1>
<p style="color:#71717a;font-size:13px;margin:0 0 24px;">{date_str}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  <tr>
    <td align="center" style="background:#052e16;border:1px solid #14532d;border-radius:8px;padding:16px;">
      <div style="font-size:28px;font-weight:700;color:#10b981;">{buys}</div>
      <div style="font-size:11px;color:#6ee7b7;">BUY</div>
    </td>
    <td width="12"></td>
    <td align="center" style="background:#1c1917;border:1px solid #292524;border-radius:8px;padding:16px;">
      <div style="font-size:28px;font-weight:700;color:#f59e0b;">{holds}</div>
      <div style="font-size:11px;color:#fcd34d;">HOLD</div>
    </td>
    <td width="12"></td>
    <td align="center" style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;">
      <div style="font-size:28px;font-weight:700;color:#ef4444;">{sells}</div>
      <div style="font-size:11px;color:#fca5a5;">SELL</div>
    </td>
  </tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid #27272a;border-radius:8px;border-collapse:collapse;overflow:hidden;">
  <thead>
    <tr style="background:#09090b;">
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#71717a;text-transform:uppercase;">Ticker</th>
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#71717a;text-transform:uppercase;">Signal</th>
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#71717a;text-transform:uppercase;">Conf.</th>
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#71717a;text-transform:uppercase;">Summary</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
<p style="margin:24px 0 0;color:#52525b;font-size:12px;">
  Signals generated by Claude AI (claude-sonnet-4-6)
</p>"""
    return _base_layout(f"NSE AI Daily Digest — {date_str}", body)


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
    """Fetch the latest signal per ticker and email the digest."""
    db     = get_db()
    schema = nse(db)

    signals = (
        schema.table("latest_signals")
        .select("ticker, signal, confidence, summary")
        .order("confidence", desc=True)
        .execute()
        .data
    )

    if not signals:
        log.warning("no_signals_today", date=str(date.today()))
        return

    date_str = datetime.now(tz=timezone.utc).strftime("%A, %d %B %Y")
    html     = build_digest_html(signals, date_str)
    buys     = sum(1 for s in signals if s["signal"] == "BUY")
    sells    = sum(1 for s in signals if s["signal"] == "SELL")
    subject  = (
        f"NSE AI Daily Digest — {date_str} "
        f"({buys} BUY / {sells} SELL / {len(signals)-buys-sells} HOLD)"
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
