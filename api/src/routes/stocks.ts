import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../services/supabase";

const router = Router();

const tickerSchema = z.object({
  ticker: z.string().min(2).max(6).toUpperCase(),
});

router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("ticker, name, sector")
      .order("ticker");
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get("/:ticker", async (req, res, next) => {
  try {
    const { ticker } = tickerSchema.parse(req.params);
    const { data, error } = await supabaseAdmin
      .from("stock_prices")
      .select("*")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(90);
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: "Ticker not found" });
    res.json(data);
  } catch (err) { next(err); }
});

export { router as stocksRouter };
