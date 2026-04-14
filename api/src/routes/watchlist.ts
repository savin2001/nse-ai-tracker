import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const tickerBody  = z.object({ ticker: z.string().min(2).max(6).toUpperCase() });
const tickerParam = z.object({ ticker: z.string().min(2).max(6).toUpperCase() });

/** GET /api/watchlist — user's watchlist tickers */
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await nse()
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", req.user.id)
      .single();
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    res.json(data?.watchlist ?? []);
  } catch (err) { next(err); }
});

/** POST /api/watchlist — add a ticker */
router.post("/", async (req, res, next) => {
  try {
    const { ticker } = tickerBody.parse(req.body);
    const userId = req.user.id;

    const { data: existing } = await nse()
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", userId)
      .single();

    const current: string[] = existing?.watchlist ?? [];
    if (!current.includes(ticker)) {
      await nse()
        .from("user_preferences")
        .upsert({ user_id: userId, watchlist: [...current, ticker] },
                 { onConflict: "user_id" });
    }
    res.status(201).json({ ticker });
  } catch (err) { next(err); }
});

/** DELETE /api/watchlist/:ticker — remove a ticker */
router.delete("/:ticker", async (req, res, next) => {
  try {
    const { ticker } = tickerParam.parse(req.params);
    const userId = req.user.id;

    const { data: existing } = await nse()
      .from("user_preferences")
      .select("watchlist")
      .eq("user_id", userId)
      .single();

    const updated = (existing?.watchlist ?? []).filter((t: string) => t !== ticker);
    await nse()
      .from("user_preferences")
      .upsert({ user_id: userId, watchlist: updated },
               { onConflict: "user_id" });

    res.status(204).send();
  } catch (err) { next(err); }
});

export { router as watchlistRouter };
