/**
 * Structured browser logger for the NSE AI Tracker frontend.
 *
 * - Development: coloured console output with timestamps
 * - Production: JSON-serialised entries (ready to forward to any log sink)
 *
 * Usage:
 *   import { logger } from "@/services/logger";
 *   logger.info("market_events_loaded", { count: 12 });
 *   logger.error("api_error", { url: "/api/signals", status: 500, err });
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const IS_PROD = import.meta.env.PROD;
const MIN_LEVEL: Level = (import.meta.env.VITE_LOG_LEVEL as Level) ?? (IS_PROD ? "warn" : "debug");

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function format(level: Level, event: string, fields: Fields): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "nse-frontend",
    event,
    ...fields,
  });
}

function devLog(level: Level, event: string, fields: Fields): void {
  const ts = new Date().toLocaleTimeString();
  const style: Record<Level, string> = {
    debug: "color:#6b7280",
    info:  "color:#34d399",
    warn:  "color:#fbbf24",
    error: "color:#f87171;font-weight:bold",
  };
  console[level === "debug" ? "log" : level](
    `%c[${ts}] [${level.toUpperCase()}] ${event}`,
    style[level],
    fields,
  );
}

function log(level: Level, event: string, fields: Fields = {}): void {
  if (!shouldLog(level)) return;

  if (IS_PROD) {
    // In production, emit structured JSON to console (forward to Datadog / BetterStack etc.)
    const line = format(level, event, fields);
    console[level === "debug" ? "log" : level](line);
  } else {
    devLog(level, event, fields);
  }
}

export const logger = {
  debug: (event: string, fields?: Fields) => log("debug", event, fields),
  info:  (event: string, fields?: Fields) => log("info",  event, fields),
  warn:  (event: string, fields?: Fields) => log("warn",  event, fields),
  error: (event: string, fields?: Fields) => log("error", event, fields),
};
