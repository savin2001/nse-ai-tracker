/**
 * POST /api/notify/digest   — trigger daily digest email (webhook-safe)
 * POST /api/notify/event/:id — send alert for a specific event
 *
 * Protected by NOTIFY_SECRET header (set in env).
 * Called from systemd timer / cron after ai_worker completes.
 */
import { Router, Request, Response, NextFunction } from "express";
import { nse } from "../services/supabase";
import { sendDailyDigest, sendEventAlert } from "../services/email";

export const notifyRouter = Router();

function requireNotifySecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) { next(); return; }            // secret not configured → open
  if (req.headers["x-notify-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  next();
}

/** POST /api/notify/digest */
notifyRouter.post("/digest", requireNotifySecret, async (_req, res, next) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const { data, error } = await nse()
      .from("analysis_results")
      .select("id,ticker,signal,confidence,summary,key_factors,risks,target_price,time_horizon,generated_at")
      .gte("generated_at", today)
      .order("confidence", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      res.json({ sent: false, reason: "no_signals_today" });
      return;
    }

    await sendDailyDigest(data as any);
    res.json({ sent: true, signals: data.length });
  } catch (err) { next(err); }
});

/** POST /api/notify/event/:id */
notifyRouter.post("/event/:id", requireNotifySecret, async (req, res, next) => {
  try {
    const { data, error } = await nse()
      .from("detected_events")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    await sendEventAlert(data as any);
    res.json({ sent: true, event_id: data.id });
  } catch (err) { next(err); }
});
