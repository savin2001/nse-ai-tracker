import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, mockNse } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: mockNse([
    { day: "2025-04-09", model: "claude-sonnet-4-6", worker: "ai_worker",
      calls: 5, total_input_tokens: 12000, total_output_tokens: 3000,
      total_cache_reads: 500, total_cost_usd: 0.045, failures: 0 },
    { day: "2025-04-08", model: "claude-haiku-4-5-20251001", worker: "event_detector",
      calls: 10, total_input_tokens: 5000, total_output_tokens: 1000,
      total_cache_reads: 0, total_cost_usd: 0.012, failures: 1 },
  ]),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { usageRouter } from "../routes/usage";
const app = buildApp(usageRouter, "/");

describe("GET /usage", () => {
  it("returns 200 with array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns usage fields", async () => {
    const res = await request(app).get("/");
    expect(res.body[0]).toMatchObject({ day: "2025-04-09", worker: "ai_worker" });
  });

  it("accepts days param", async () => {
    const res = await request(app).get("/?days=7");
    expect(res.status).toBe(200);
  });

  it("rejects days > 90 with 400", async () => {
    const res = await request(app).get("/?days=91");
    expect(res.status).toBe(400);
  });

  it("rejects days < 1 with 400", async () => {
    const res = await request(app).get("/?days=0");
    expect(res.status).toBe(400);
  });
});
