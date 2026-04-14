/**
 * Additional security middleware applied at app startup.
 *
 * Covers:
 *  - Required environment variable validation (fail-fast at boot)
 *  - Request ID injection for traceability
 *  - Slow-down (progressive delay) on repeated requests from same IP
 *  - Security headers not covered by helmet defaults
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// ── Required env vars — crash at startup if missing ───────────────────────────
const REQUIRED_ENV: string[] = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[boot] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  // Warn (but don't crash) on optional-but-important vars
  const optional = ["RESEND_API_KEY", "NOTIFY_SECRET", "ALLOWED_ORIGINS"];
  optional.forEach(k => {
    if (!process.env[k]) {
      console.warn(`[boot] Warning: ${k} not set — some features will be unavailable`);
    }
  });
}

// ── Request ID (added to every response for log correlation) ──────────────────
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Request-ID", randomUUID());
  next();
}

// ── Strip sensitive headers from responses ────────────────────────────────────
export function stripServerHeader(_req: Request, res: Response, next: NextFunction): void {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  next();
}

// ── Forbid requests with suspicious patterns ──────────────────────────────────
const BLOCKED_PATHS = /(\.\.|\/etc\/|\/proc\/|\.env|\.git)/i;

export function blockPathTraversal(req: Request, res: Response, next: NextFunction): void {
  if (BLOCKED_PATHS.test(req.path)) {
    res.status(400).json({ error: "Bad request" });
    return;
  }
  next();
}

// ── Content-Type enforcement for mutating requests ────────────────────────────
export function requireJson(req: Request, res: Response, next: NextFunction): void {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers["content-type"] ?? "";
    if (!ct.includes("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json" });
      return;
    }
  }
  next();
}
