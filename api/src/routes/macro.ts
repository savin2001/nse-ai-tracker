import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const querySchema = z.object({
  indicator: z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(30),
});

/** GET /api/macro — macroeconomic indicators */
router.get("/", async (req, res, next) => {
  try {
    const { indicator, limit } = querySchema.parse(req.query);

    let query = nse()
      .from("macro_indicators")
      .select("indicator, value, period_date, source, unit, notes")
      .order("period_date", { ascending: false })
      .limit(limit);

    if (indicator) query = query.eq("indicator", indicator);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) { next(err); }
});

export { router as macroRouter };
