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
import { nse }             from "./services/supabase";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.SUPABASE_URL ?? ""],
    },
  },
}));
app.use(cors({
  origin:      process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60,  standardHeaders: true, legacyHeaders: false }));
app.use("/api/signals", rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/signals",   authMiddleware, signalsRouter);
app.use("/api/stocks",    authMiddleware, stocksRouter);
app.use("/api/portfolio", authMiddleware, portfolioRouter);
app.use("/api/watchlist", authMiddleware, watchlistRouter);
app.use("/api/events",    authMiddleware, eventsRouter);
app.use("/api/macro",     authMiddleware, macroRouter);
app.use("/api/notify",    notifyRouter);   // webhook — protected by NOTIFY_SECRET

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    const { error } = await nse().from("companies").select("ticker").limit(1);
    if (error) throw error;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use(errorHandler);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`NSE AI Tracker API listening on port ${PORT}`));

export default app;
