import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const tickerParam = z.object({
  ticker: z.string().min(2).max(6).toUpperCase(),
});

const priceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(600).default(90),
});

/** GET /api/stocks — list all companies */
router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await nse()
      .from("companies")
      .select("ticker, name, sector, market_cap, high_52w, low_52w")
      .order("ticker");
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

/** GET /api/stocks/:ticker — company detail + recent prices */
router.get("/:ticker", async (req, res, next) => {
  try {
    const { ticker } = tickerParam.parse(req.params);
    const { days }   = priceQuerySchema.parse(req.query);

    const [companyRes, pricesRes, latestSignalRes] = await Promise.all([
      nse().from("companies").select("*").eq("ticker", ticker).single(),
      nse().from("stock_prices").select("date, open, high, low, close, volume")
        .eq("ticker", ticker).order("date", { ascending: false }).limit(days),
      nse().from("latest_signals").select("signal, confidence, summary, target_price, time_horizon, generated_at")
        .eq("ticker", ticker).maybeSingle(),
    ]);

    if (companyRes.error || !companyRes.data) {
      res.status(404).json({ error: "Ticker not found" });
      return;
    }
    if (pricesRes.error) throw pricesRes.error;

    res.json({
      company:      companyRes.data,
      prices:       pricesRes.data ?? [],
      latestSignal: latestSignalRes.data ?? null,
    });
  } catch (err) { next(err); }
});

/** GET /api/stocks/:ticker/prices — raw OHLCV only */
router.get("/:ticker/prices", async (req, res, next) => {
  try {
    const { ticker } = tickerParam.parse(req.params);
    const { days }   = priceQuerySchema.parse(req.query);

    const { data, error } = await nse()
      .from("stock_prices")
      .select("date, open, high, low, close, volume")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(days);

    if (error) throw error;
    if (!data?.length) { res.status(404).json({ error: "No price data found" }); return; }
    res.json(data);
  } catch (err) { next(err); }
});

export { router as stocksRouter };
