import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const listSchema = z.object({
  ticker: z.string().min(2).max(6).toUpperCase().optional(),
  signal: z.enum(["BUY", "HOLD", "SELL"]).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/signals — paginated signal history */
router.get("/", async (req, res, next) => {
  try {
    const { ticker, signal, limit, offset } = listSchema.parse(req.query);

    let query = nse()
      .from("analysis_results")
      .select("id, ticker, signal, confidence, summary, key_factors, risks, target_price, time_horizon, generated_at, companies(name, sector)")
      .order("generated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticker) query = query.eq("ticker", ticker);
    if (signal) query = query.eq("signal", signal);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/signals/latest — one signal per ticker (most recent) */
router.get("/latest", async (_req, res, next) => {
  try {
    const { data, error } = await nse()
      .from("latest_signals")
      .select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export { router as signalsRouter };
