import { Router } from "express";
import { z } from "zod";
import { nse } from "../services/supabase";

const router = Router();

const allocationBody = z.object({
  ticker:    z.string().min(2).max(6).toUpperCase(),
  weight:    z.number().min(0).max(1),
  rationale: z.string().max(500).optional(),
});

const tickerParam = z.object({
  ticker: z.string().min(2).max(6).toUpperCase(),
});

/** GET /api/portfolio — user's allocations with latest signals */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data, error } = await nse()
      .from("portfolio_allocations")
      .select("id, ticker, weight, rationale, updated_at, companies(name, sector)")
      .eq("user_id", userId)
      .order("weight", { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) { next(err); }
});

/** POST /api/portfolio — add or update a position */
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { ticker, weight, rationale } = allocationBody.parse(req.body);

    const { data, error } = await nse()
      .from("portfolio_allocations")
      .upsert({ user_id: userId, ticker, weight, rationale },
               { onConflict: "user_id,ticker" })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

/** PUT /api/portfolio/:ticker — update weight/rationale */
router.put("/:ticker", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { ticker } = tickerParam.parse(req.params);
    const body = allocationBody.partial().omit({ ticker: true }).parse(req.body);

    const { data, error } = await nse()
      .from("portfolio_allocations")
      .update(body)
      .eq("user_id", userId)
      .eq("ticker", ticker)
      .select()
      .single();

    if (error) throw error;
    if (!data) { res.status(404).json({ error: "Allocation not found" }); return; }
    res.json(data);
  } catch (err) { next(err); }
});

/** DELETE /api/portfolio/:ticker — remove a position */
router.delete("/:ticker", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { ticker } = tickerParam.parse(req.params);

    const { error } = await nse()
      .from("portfolio_allocations")
      .delete()
      .eq("user_id", userId)
      .eq("ticker", ticker);

    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});

export { router as portfolioRouter };
