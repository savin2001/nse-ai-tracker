import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

/** GET /api/usage — daily AI token usage aggregated from daily_ai_cost view */
router.get("/", async (req, res, next) => {
  try {
    const { days } = querySchema.parse(req.query);
    const since = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    const { data, error } = await nse()
      .from("daily_ai_cost")
      .select("day, model, worker, calls, total_input_tokens, total_output_tokens, total_cache_reads, total_cost_usd, failures")
      .gte("day", since)
      .order("day", { ascending: false });

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) { next(err); }
});

export { router as usageRouter };
