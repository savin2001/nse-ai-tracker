import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const querySchema = z.object({
  ticker:  z.string().min(2).max(6).toUpperCase().optional(),
  limit:   z.coerce.number().int().min(1).max(50).default(20),
  days:    z.coerce.number().int().min(1).max(30).default(7),
});

/** GET /api/news — recent news articles, optionally filtered by ticker */
router.get("/", async (req, res, next) => {
  try {
    const { ticker, limit, days } = querySchema.parse(req.query);

    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    let query = nse()
      .from("news_articles")
      .select("id, ticker, title, url, published_at, sentiment_score, source")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (ticker) query = query.eq("ticker", ticker);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) { next(err); }
});

export { router as newsRouter };
