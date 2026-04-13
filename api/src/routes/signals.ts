import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../services/supabase";

const router = Router();

const querySchema = z.object({
  ticker: z.string().min(2).max(6).toUpperCase().optional(),
  signal: z.enum(["BUY", "HOLD", "SELL"]).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/", async (req, res, next) => {
  try {
    const { ticker, signal, limit, offset } = querySchema.parse(req.query);

    let query = supabaseAdmin
      .from("analysis_results")
      .select("*, companies(name, sector)")
      .order("generated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticker) query = query.eq("ticker", ticker);
    if (signal) query = query.eq("signal", signal);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) { next(err); }
});

export { router as signalsRouter };
