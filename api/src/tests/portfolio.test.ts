import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, buildQueryMock } from "./helpers";

const allocationData = [{ id: 1, ticker: "SCOM", weight: 0.1, rationale: "Core holding", updated_at: "2025-04-09T00:00:00Z", companies: { name: "Safaricom", sector: "Telco" } }];

vi.mock("../services/supabase", () => ({
  nse: () => ({ from: () => buildQueryMock(allocationData) }),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { portfolioRouter } from "../routes/portfolio";
const app = buildApp(portfolioRouter, "/");

describe("GET /portfolio", () => {
  it("returns 200 with allocations array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /portfolio", () => {
  it("accepts valid allocation body", async () => {
    const res = await request(app)
      .post("/")
      .send({ ticker: "EQTY", weight: 0.05, rationale: "Growth play" });
    expect([200, 201]).toContain(res.status);
  });

  it("rejects weight > 1 with 400", async () => {
    const res = await request(app).post("/").send({ ticker: "EQTY", weight: 1.5 });
    expect(res.status).toBe(400);
  });

  it("rejects missing ticker with 400", async () => {
    const res = await request(app).post("/").send({ weight: 0.05 });
    expect(res.status).toBe(400);
  });

  it("rejects negative weight with 400", async () => {
    const res = await request(app).post("/").send({ ticker: "KCB", weight: -0.1 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /portfolio/:ticker", () => {
  it("returns 204 on deletion", async () => {
    const res = await request(app).delete("/SCOM");
    expect(res.status).toBe(204);
  });

  it("rejects invalid ticker param with 400", async () => {
    const res = await request(app).delete("/TOOLONGTICKER");
    expect(res.status).toBe(400);
  });
});
