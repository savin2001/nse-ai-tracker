/**
 * AI-Specific Rate Limiting
 * ─────────────────────────
 * IP-based rate limiting (in index.ts via express-rate-limit) is the first
 * defence. This module adds a second, per-authenticated-user layer that:
 *
 *   1. Per-user request rate  — max N AI-trigger requests per minute
 *   2. Daily token budget     — hard cap on total tokens consumed per user/day
 *   3. Concurrent dedup       — if user already has an in-flight request for
 *                               the same ticker, return 429 immediately instead
 *                               of launching a duplicate Claude call
 *
 * State is held in-process (Map) which is sufficient for a single VPS instance.
 * For multi-instance deployments, replace with Redis.
 */
import { Request, Response, NextFunction } from "express";
import { nse } from "../services/supabase";

// ── Configuration ─────────────────────────────────────────────────────────────

const AI_REQUESTS_PER_MINUTE = 5;        // per authenticated user
const DAILY_TOKEN_BUDGET      = 50_000;  // tokens per user per day (input+output)
const IN_FLIGHT_TTL_MS        = 30_000;  // consider a request stale after 30 s

// ── In-process state ──────────────────────────────────────────────────────────

interface UserWindow {
  count:       number;
  windowStart: number;
}

const requestWindows = new Map<string, UserWindow>();    // userId → window
const inFlight       = new Map<string, number>();        // `userId:ticker` → timestamp

// ── Helpers ───────────────────────────────────────────────────────────────────

function userId(req: Request): string {
  return (req as any).user?.id ?? req.ip ?? "anonymous";
}

/** Returns today's date string in UTC (used as budget key). */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fetch total tokens consumed by this user today from nse.model_usage. */
async function fetchDailyTokens(uid: string): Promise<number> {
  try {
    const today = todayKey();
    const { data, error } = await nse()
      .from("model_usage")
      .select("input_tokens, output_tokens")
      .eq("ticker", uid)          // model_usage.ticker stores user ID for user-triggered calls
      .gte("recorded_at", `${today}T00:00:00Z`);

    if (error || !data) return 0;
    return data.reduce((s: number, r: any) =>
      s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0
    );
  } catch {
    return 0;  // fail open — don't block users if DB is unavailable
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * perUserAiRateLimit — sliding window, per-user, max AI_REQUESTS_PER_MINUTE.
 * Must run AFTER authMiddleware so req.user is populated.
 */
export function perUserAiRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const uid  = userId(req);
  const now  = Date.now();
  const win  = requestWindows.get(uid);

  if (!win || now - win.windowStart > 60_000) {
    // Start a fresh window
    requestWindows.set(uid, { count: 1, windowStart: now });
    next();
    return;
  }

  if (win.count >= AI_REQUESTS_PER_MINUTE) {
    const retryAfter = Math.ceil((60_000 - (now - win.windowStart)) / 1000);
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      error:       "AI request rate limit exceeded",
      retryAfter,
      limit:       AI_REQUESTS_PER_MINUTE,
      window:      "60s",
    });
    return;
  }

  win.count++;
  next();
}

/**
 * dailyTokenBudget — async middleware; checks the user's total token usage
 * today against DAILY_TOKEN_BUDGET. Blocks if over budget.
 */
export async function dailyTokenBudget(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const uid  = userId(req);
  const used = await fetchDailyTokens(uid);

  if (used >= DAILY_TOKEN_BUDGET) {
    res.status(429).json({
      error:  "Daily AI token budget reached",
      used,
      budget: DAILY_TOKEN_BUDGET,
      resetsAt: `${todayKey()}T23:59:59Z`,
    });
    return;
  }

  next();
}

/**
 * deduplicateAiRequest — blocks concurrent identical requests from the same user.
 * Requires `req.params.ticker` (or `req.query.ticker`) to identify the resource.
 *
 * Usage: apply only on routes that trigger a Claude call (e.g. stock analysis).
 */
export function deduplicateAiRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const uid    = userId(req);
  const ticker = (req.params.ticker ?? req.query.ticker ?? "global") as string;
  const key    = `${uid}:${ticker.toUpperCase()}`;
  const now    = Date.now();
  const last   = inFlight.get(key);

  if (last && now - last < IN_FLIGHT_TTL_MS) {
    res.status(429).json({
      error:     "Duplicate request — analysis already in progress for this ticker",
      retryAfterMs: IN_FLIGHT_TTL_MS - (now - last),
    });
    return;
  }

  inFlight.set(key, now);

  // Clean up after the request finishes (or times out)
  res.on("finish", () => inFlight.delete(key));
  res.on("close",  () => inFlight.delete(key));

  next();
}

// ── Periodic cleanup to prevent memory leaks ──────────────────────────────────
setInterval(() => {
  const now = Date.now();
  // Remove stale windows (>2 minutes old)
  for (const [uid, win] of requestWindows) {
    if (now - win.windowStart > 120_000) requestWindows.delete(uid);
  }
  // Remove stale in-flight markers
  for (const [key, ts] of inFlight) {
    if (now - ts > IN_FLIGHT_TTL_MS) inFlight.delete(key);
  }
}, 60_000).unref();  // .unref() so this timer doesn't prevent process exit
