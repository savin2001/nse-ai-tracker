/**
 * Structured logger for the NSE AI Tracker API.
 *
 * - Production: JSON lines (stdout) — pipe to any log aggregator
 * - Development: pretty-printed via pino-pretty (set LOG_PRETTY=true)
 *
 * Usage:
 *   import { logger } from "./services/logger";
 *   logger.info({ ticker: "SCOM", signal: "BUY" }, "Signal generated");
 *   logger.error({ err }, "Unexpected error");
 */
import pino from "pino";

const isPretty  = process.env.LOG_PRETTY === "true";
const logLevel  = (process.env.LOG_LEVEL ?? "info") as pino.Level;

export const logger = pino(
  {
    level: logLevel,
    base: {
      service: "nse-api",
      env: process.env.NODE_ENV ?? "development",
    },
    // Redact sensitive fields before they reach any log sink
    redact: {
      paths: [
        "req.headers.authorization",
        'req.headers["x-notify-secret"]',
        "*.password",
        "*.apiKey",
        "*.service_role_key",
      ],
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isPretty
    ? (pino as any).transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined,
);
