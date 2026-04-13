import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      type:   "https://nse-platform.dev/errors/validation",
      title:  "Validation Error",
      status: 400,
      errors: err.flatten().fieldErrors,
    });
  }
  console.error(err);
  res.status(500).json({
    type:   "https://nse-platform.dev/errors/internal",
    title:  "Internal Server Error",
    status: 500,
  });
}
