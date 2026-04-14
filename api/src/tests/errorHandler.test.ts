import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { errorHandler } from "../middleware/errorHandler";

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get("/zod-error", (_req, _res, next) => {
    try { z.object({ n: z.number() }).parse({ n: "bad" }); }
    catch (err) { next(err); }
  });

  app.get("/generic-error", (_req, _res, next) => {
    next(new Error("Something exploded"));
  });

  app.use(errorHandler);
  return app;
}

const app = buildTestApp();

describe("errorHandler", () => {
  it("returns 400 with fieldErrors for ZodError", async () => {
    const res = await request(app).get("/zod-error");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 400, title: "Validation Error" });
    expect(res.body.errors).toBeDefined();
  });

  it("returns 500 for generic errors", async () => {
    const res = await request(app).get("/generic-error");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ status: 500, title: "Internal Server Error" });
  });

  it("includes RFC 7807 type field", async () => {
    const res = await request(app).get("/zod-error");
    expect(res.body.type).toMatch(/^https?:\/\//);
  });
});
