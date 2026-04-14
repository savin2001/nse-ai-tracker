import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, mockNse } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: mockNse([
    { indicator: "cbr_rate", value: 10.75, period_date: "2025-02-05", source: "CBK", unit: "%" },
    { indicator: "usd_kes",  value: 129.5, period_date: "2025-04-09", source: "Yahoo Finance", unit: "KES" },
    { indicator: "cpi_inflation", value: 3.48, period_date: "2025-02-01", source: "KNBS", unit: "%" },
  ]),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { macroRouter } from "../routes/macro";
const app = buildApp(macroRouter, "/");

describe("GET /macro", () => {
  it("returns 200 with array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes cbr_rate and usd_kes indicators", async () => {
    const res = await request(app).get("/");
    const names = res.body.map((r: any) => r.indicator);
    expect(names).toContain("cbr_rate");
    expect(names).toContain("usd_kes");
  });

  it("rejects limit > 200 with 400", async () => {
    const res = await request(app).get("/?limit=500");
    expect(res.status).toBe(400);
  });

  it("accepts indicator filter", async () => {
    const res = await request(app).get("/?indicator=cbr_rate");
    expect(res.status).toBe(200);
  });
});
