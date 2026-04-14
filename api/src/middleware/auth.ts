import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../services/supabase";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}
