import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../services/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    logger.warn({ requestId: res.getHeader("X-Request-ID"), err }, "Validation error");
    return res.status(400).json({
      type:   "https://nse-platform.dev/errors/validation",
      title:  "Validation Error",
      status: 400,
      errors: err.flatten().fieldErrors,
    });
  }

  logger.error(
    { requestId: res.getHeader("X-Request-ID"), url: req.url, method: req.method, err },
    "Unhandled error",
  );

  res.status(500).json({
    type:   "https://nse-platform.dev/errors/internal",
    title:  "Internal Server Error",
    status: 500,
  });
}
