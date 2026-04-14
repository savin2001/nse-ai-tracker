/**
 * Email service — wraps Resend SDK.
 * All platform emails go to the configured ALERT_EMAIL (default: osukaexperiments@gmail.com).
 * From address must be a verified Resend domain; update RESEND_FROM_EMAIL in .env.
 */
import { Resend } from "resend";
import type { Signal, MarketEvent } from "./types";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "osukaexperiments@gmail.com";
export const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL ?? "nse-tracker@yourdomain.com";

// ── HTML helpers ─────────────────────────────────────────────────────────────

const SIGNAL_COLORS: Record<string, string> = {
  BUY:  "#10b981",
  HOLD: "#f59e0b",
  SELL: "#ef4444",
};

function signalBadge(signal: "BUY" | "HOLD" | "SELL"): string {
  const color = SIGNAL_COLORS[signal] ?? "#6b7280";
  return `<span style="background:${color};color:#000;padding:2px 10px;border-radius:4px;font-weight:700;font-size:12px;">${signal}</span>`;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6",
  };
  const c = colors[severity] ?? "#6b7280";
  return `<span style="background:${c};color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;">${severity.toUpperCase()}</span>`;
}

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #27272a;">
            <span style="color:#10b981;font-size:20px;font-weight:700;">NSE AI Tracker</span>
            <span style="color:#71717a;font-size:13px;margin-left:12px;">Nairobi Securities Exchange</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#18181b;padding:32px;border-radius:0 0 12px 12px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;text-align:center;">
            <p style="color:#52525b;font-size:11px;margin:0;">
              NSE AI Tracker · Not financial advice · AI signals are for informational purposes only.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

export function buildDailyDigestHtml(signals: Signal[], date: string): string {
  const buys  = signals.filter(s => s.signal === "BUY");
  const sells = signals.filter(s => s.signal === "SELL");
  const holds = signals.filter(s => s.signal === "HOLD");

  const signalRows = signals
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15)
    .map(s => `
      <tr style="border-bottom:1px solid #27272a;">
        <td style="padding:10px 8px;font-family:monospace;font-weight:700;color:#e4e4e7;">${s.ticker}</td>
        <td style="padding:10px 8px;">${signalBadge(s.signal)}</td>
        <td style="padding:10px 8px;font-family:monospace;color:#a1a1aa;">${s.confidence}%</td>
        <td style="padding:10px 8px;color:#a1a1aa;font-size:12px;">${(s.summary ?? "").slice(0, 80)}…</td>
      </tr>`).join("");

  const body = `
    <h1 style="color:#f4f4f5;font-size:20px;margin:0 0 4px;">Daily Signal Digest</h1>
    <p style="color:#71717a;font-size:13px;margin:0 0 24px;">${date}</p>

    <!-- Summary counts -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="background:#052e16;border:1px solid #14532d;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#10b981;">${buys.length}</div>
          <div style="font-size:11px;color:#6ee7b7;">BUY</div>
        </td>
        <td width="12"></td>
        <td align="center" style="background:#1c1917;border:1px solid #292524;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">${holds.length}</div>
          <div style="font-size:11px;color:#fcd34d;">HOLD</div>
        </td>
        <td width="12"></td>
        <td align="center" style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#ef4444;">${sells.length}</div>
          <div style="font-size:11px;color:#fca5a5;">SELL</div>
        </td>
      </tr>
    </table>

    <!-- Signal table -->
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
      <tbody>${signalRows}</tbody>
    </table>

    <p style="margin:24px 0 0;color:#52525b;font-size:12px;">
      Signals generated by Claude AI · ${new Date().toUTCString()}
    </p>`;

  return baseLayout(`NSE AI Daily Digest — ${date}`, body);
}

export function buildEventAlertHtml(event: MarketEvent): string {
  const body = `
    <h1 style="color:#f4f4f5;font-size:20px;margin:0 0 4px;">
      Market Event Alert ${severityBadge(event.severity)}
    </h1>
    <p style="color:#71717a;font-size:13px;margin:0 0 24px;">${new Date(event.detected_at).toUTCString()}</p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#09090b;border:1px solid #27272a;border-radius:8px;border-collapse:collapse;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #27272a;">
          <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Ticker</span>
          <span style="color:#10b981;font-family:monospace;font-weight:700;font-size:18px;">${event.ticker}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #27272a;">
          <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Event Type</span>
          <span style="color:#e4e4e7;font-weight:600;">${event.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <span style="color:#71717a;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Description</span>
          <span style="color:#d4d4d8;line-height:1.6;">${event.description}</span>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;color:#52525b;font-size:12px;">
      Detected by NSE AI Tracker event engine · ${new Date().toUTCString()}
    </p>`;

  return baseLayout(
    `[${event.severity.toUpperCase()}] ${event.ticker} — ${event.event_type}`,
    body,
  );
}

// ── Send helpers ──────────────────────────────────────────────────────────────

export async function sendDailyDigest(signals: Signal[]): Promise<void> {
  const dateStr = new Date().toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Africa/Nairobi",
  });
  const html = buildDailyDigestHtml(signals, dateStr);
  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      [ALERT_EMAIL],
    subject: `NSE AI Daily Digest — ${dateStr} (${signals.filter(s => s.signal === "BUY").length} BUY / ${signals.filter(s => s.signal === "SELL").length} SELL)`,
    html,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

export async function sendEventAlert(event: MarketEvent): Promise<void> {
  // Only alert on high or critical events
  if (!["high", "critical"].includes(event.severity)) return;
  const html = buildEventAlertHtml(event);
  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      [ALERT_EMAIL],
    subject: `[${event.severity.toUpperCase()}] NSE Alert: ${event.ticker} — ${event.event_type.replace(/_/g, " ")}`,
    html,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}
