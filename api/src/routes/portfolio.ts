import { Router } from "express";
import { supabaseAdmin } from "../services/supabase";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { data, error } = await supabaseAdmin
      .from("portfolio_allocations")
      .select("*, companies(name, sector)")
      .eq("user_id", userId)
      .order("weight", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export { router as portfolioRouter };
