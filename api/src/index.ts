import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { signalsRouter }   from "./routes/signals";
import { stocksRouter }    from "./routes/stocks";
import { portfolioRouter } from "./routes/portfolio";
import { watchlistRouter } from "./routes/watchlist";
import { authMiddleware }  from "./middleware/auth";
import { errorHandler }    from "./middleware/errorHandler";

const app = express();

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
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
}));
app.use(express.json({ limit: "10kb" }));

// Rate limiting
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
app.use("/api/signals", rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

// Routes
app.use("/api/signals",   authMiddleware, signalsRouter);
app.use("/api/stocks",    authMiddleware, stocksRouter);
app.use("/api/portfolio", authMiddleware, portfolioRouter);
app.use("/api/watchlist", authMiddleware, watchlistRouter);

// Health check (no auth)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`NSE AI Tracker API running on port ${PORT}`));
