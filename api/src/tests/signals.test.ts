import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, mockNse } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: mockNse([
    { id: 1, ticker: "SCOM", signal: "BUY", confidence: 78, summary: "Strong outlook",
      key_factors: ["M-Pesa"], risks: ["regulation"], target_price: 35, time_horizon: "3-6 months",
      generated_at: "2025-04-09T18:00:00Z", companies: { name: "Safaricom", sector: "Telco" } },
  ]),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { signalsRouter } from "../routes/signals";
const app = buildApp(signalsRouter, "/");

describe("GET /signals", () => {
  it("returns 200 with an array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes expected fields", async () => {
    const res = await request(app).get("/");
    const row = res.body[0];
    expect(row).toMatchObject({ ticker: "SCOM", signal: "BUY", confidence: 78 });
  });

  it("rejects invalid signal param with 400", async () => {
    const res = await request(app).get("/?signal=STRONG_BUY");
    expect(res.status).toBe(400);
  });

  it("rejects limit > 100 with 400", async () => {
    const res = await request(app).get("/?limit=200");
    expect(res.status).toBe(400);
  });

  it("accepts valid query params", async () => {
    const res = await request(app).get("/?ticker=scom&signal=BUY&limit=10&offset=0");
    expect(res.status).toBe(200);
  });
});

describe("GET /signals/latest", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/latest");
    expect(res.status).toBe(200);
  });
});
