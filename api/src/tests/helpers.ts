/**
 * Shared test helpers — mock Supabase and build a test Express app.
 */
import { vi } from "vitest";
import express from "express";
import { errorHandler } from "../middleware/errorHandler";

// ── Supabase mock factory ─────────────────────────────────────────────────────
export function buildQueryMock(data: unknown, error: unknown = null) {
  const q: any = {
    data,
    error,
    select:    () => q,
    insert:    () => q,
    upsert:    () => q,
    update:    () => q,
    delete:    () => q,
    eq:        () => q,
    neq:       () => q,
    gte:       () => q,
    lte:       () => q,
    order:     () => q,
    range:     () => q,
    limit:     () => q,
    single:    () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }),
    maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }),
    execute:   () => Promise.resolve({ data, error }),
  };
  q.then = (resolve: Function) => Promise.resolve({ data, error }).then(resolve);
  return q;
}

/** Mock nse() to return chainable query builder that resolves to { data, error } */
export function mockNse(data: unknown, error: unknown = null) {
  const q = buildQueryMock(data, error);
  return vi.fn(() => ({ from: () => q }));
}

// ── Auth bypass middleware ─────────────────────────────────────────────────────
export function fakeAuthMiddleware(req: any, _res: any, next: any) {
  req.user = { id: "test-user-uuid", email: "test@example.com" };
  next();
}

// ── Minimal Express app for a router under test ───────────────────────────────
export function buildApp(router: express.Router, path = "/") {
  const app = express();
  app.use(express.json());
  app.use(path, fakeAuthMiddleware, router);
  app.use(errorHandler);
  return app;
}
