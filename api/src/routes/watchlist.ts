import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../services/supabase";

const router = Router();

const tickerSchema = z.object({ ticker: z.string().min(2).max(6).toUpperCase() });

router.get("/", async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    res.json(data?.watchlist ?? []);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { ticker } = tickerSchema.parse(req.body);
    const { data: existing } = await supabaseAdmin
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", userId)
      .single();
    const current: string[] = existing?.watchlist ?? [];
    if (!current.includes(ticker)) {
      await supabaseAdmin
        .from("user_preferences")
        .upsert({ user_id: userId, watchlist: [...current, ticker] });
    }
    res.status(201).json({ ticker });
  } catch (err) { next(err); }
});

router.delete("/:ticker", async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { ticker } = tickerSchema.parse(req.params);
    const { data: existing } = await supabaseAdmin
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", userId)
      .single();
    const updated = (existing?.watchlist ?? []).filter((t: string) => t !== ticker);
    await supabaseAdmin
      .from("user_preferences")
      .upsert({ user_id: userId, watchlist: updated });
    res.status(204).send();
  } catch (err) { next(err); }
});

export { router as watchlistRouter };
