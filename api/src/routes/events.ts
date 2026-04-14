import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const querySchema = z.object({
  ticker:   z.string().min(2).max(6).toUpperCase().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(50),
  offset:   z.coerce.number().int().min(0).default(0),
});

/** GET /api/events — detected market events */
router.get("/", async (req, res, next) => {
  try {
    const { ticker, severity, limit, offset } = querySchema.parse(req.query);

    let query = nse()
      .from("detected_events")
      .select("id, ticker, event_type, severity, description, metadata, detected_at")
      .order("detected_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticker)   query = query.eq("ticker", ticker);
    if (severity) query = query.eq("severity", severity);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) { next(err); }
});

export { router as eventsRouter };
