/**
 * HTTP request/response logger middleware using pino-http.
 * Logs: method, url, status, response time, request-id, user-id (if authed).
 */
import pinoHttp from "pino-http";
import { logger } from "../services/logger";

export const requestLogger = pinoHttp({
  logger,
  // Assign a log level per status code bucket
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Enrich log with request-id injected by the security middleware
  customProps(req, res) {
    return {
      requestId: res.getHeader("X-Request-ID"),
      userId:    (req as any).userId ?? undefined,
    };
  },
  // Skip health-check noise in logs
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
});
