import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { signalsRouter }   from "./routes/signals";
import { stocksRouter }    from "./routes/stocks";
import { portfolioRouter } from "./routes/portfolio";
import { watchlistRouter } from "./routes/watchlist";
import { eventsRouter }    from "./routes/events";
import { macroRouter }     from "./routes/macro";
import { notifyRouter }    from "./routes/notify";
import { authMiddleware }  from "./middleware/auth";
import { errorHandler }    from "./middleware/errorHandler";
import { requestLogger }   from "./middleware/requestLogger";
import { logger }          from "./services/logger";
import {
  validateEnv,
  requestId,
  stripServerHeader,
  blockPathTraversal,
  requireJson,
} from "./middleware/security";
import { promptInjectionGuard } from "./middleware/aiSecurity";
import {
  perUserAiRateLimit,
  dailyTokenBudget,
  deduplicateAiRequest,
} from "./middleware/aiRateLimit";
import { nse } from "./services/supabase";

// ── Fail fast on missing env vars ─────────────────────────────────────────────
validateEnv();

const app = express();

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL ?? ""],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,   // Allow Supabase storage assets
  hsts: {
    maxAge:            31536000,      // 1 year
    includeSubDomains: true,
    preload:           true,
  },
}));

// ── CORS — locked to configured origins ───────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin(origin, cb) {
    // Allow server-to-server (no origin header) and configured origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Notify-Secret"],
  maxAge: 86400,   // cache preflight 24 h
}));

// ── Structured HTTP logging (must come before routes) ─────────────────────────
app.use(requestLogger);

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(requestId);
app.use(stripServerHeader);
app.use(blockPathTraversal);
app.use(express.json({ limit: "10kb" }));
app.use(requireJson);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Global: 60 req/min per IP
app.use("/api/", rateLimit({
  windowMs:       60_000,
  max:            60,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: "Too many requests — try again in 60 seconds" },
}));
// Tighter limit on AI-heavy signal endpoints
app.use("/api/signals", rateLimit({
  windowMs:       60_000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: "Signal rate limit reached — 20 requests per minute" },
}));
// Notify webhook: 10 req/min (called by cron, not users)
app.use("/api/notify", rateLimit({
  windowMs:       60_000,
  max:            10,
  standardHeaders: true,
  legacyHeaders:  false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
// Prompt injection guard runs globally on all mutating requests (POST/PUT/PATCH)
app.use(promptInjectionGuard);

// AI-heavy signal routes: per-user rate limit + daily token budget + dedup
app.use("/api/signals",
  authMiddleware,
  perUserAiRateLimit,
  dailyTokenBudget,
  signalsRouter,
);

// Stock detail may trigger analysis — dedup by ticker
app.use("/api/stocks",
  authMiddleware,
  perUserAiRateLimit,
  deduplicateAiRequest,
  stocksRouter,
);

// Portfolio + watchlist accept free-text rationale — injection guard already global
app.use("/api/portfolio", authMiddleware, portfolioRouter);
app.use("/api/watchlist", authMiddleware, watchlistRouter);
app.use("/api/events",    authMiddleware, eventsRouter);
app.use("/api/macro",     authMiddleware, macroRouter);
app.use("/api/notify",    notifyRouter);   // NOTIFY_SECRET-protected

// ── Health checks (unauthenticated, not rate-limited) ────────────────────────

// Lightweight ping — used by load balancers and UptimeRobot
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Detailed readiness check — DB latency + row counts per subsystem
app.get("/health/detailed", async (_req, res) => {
  const start = Date.now();
  const checks: Record<string, unknown> = {};
  let allOk = true;

  // DB connectivity
  try {
    const t0 = Date.now();
    const { error } = await nse().from("companies").select("ticker").limit(1);
    checks.db = { status: error ? "error" : "ok", latencyMs: Date.now() - t0, detail: error?.message };
    if (error) allOk = false;
  } catch (err: any) {
    checks.db = { status: "error", detail: err?.message };
    allOk = false;
  }

  // Row counts — a rough data freshness indicator
  try {
    const [prices, events, signals] = await Promise.all([
      nse().from("stock_prices").select("*", { count: "exact", head: true }),
      nse().from("detected_events").select("*", { count: "exact", head: true }),
      nse().from("analysis_results").select("*", { count: "exact", head: true }),
    ]);
    checks.data = {
      stock_prices:     prices.count ?? 0,
      detected_events:  events.count ?? 0,
      analysis_results: signals.count ?? 0,
    };
  } catch {
    checks.data = { status: "unavailable" };
  }

  const status = allOk ? "ok" : "degraded";
  const code   = allOk ? 200 : 503;

  logger.info({ status, durationMs: Date.now() - start, checks }, "health_detailed");

  res.status(code).json({
    status,
    ts:         new Date().toISOString(),
    durationMs: Date.now() - start,
    checks,
  });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4000);
// Bind to 0.0.0.0 so Railway (and any cloud platform) can route traffic in.
// 127.0.0.1 (loopback) only accepts connections from the same machine.
app.listen(PORT, "0.0.0.0", () =>
  logger.info({ port: PORT }, "NSE AI Tracker API listening")
);

export default app;
