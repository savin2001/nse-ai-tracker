import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, buildQueryMock } from "./helpers";

// Data must be defined inside vi.mock factory (hoisting constraint)
vi.mock("../services/supabase", () => ({
  nse: () => ({
    from: () => buildQueryMock([
      { ticker: "SCOM", name: "Safaricom", sector: "Telco", market_cap: 400e9, high_52w: 40, low_52w: 22 },
    ]),
  }),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { stocksRouter } from "../routes/stocks";
const app = buildApp(stocksRouter, "/");

describe("GET /stocks", () => {
  it("returns 200 with a list", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns company fields", async () => {
    const res = await request(app).get("/");
    expect(res.body[0]).toMatchObject({ ticker: "SCOM", name: "Safaricom" });
  });
});

describe("GET /stocks/:ticker/prices", () => {
  it("returns 200 for valid ticker", async () => {
    const res = await request(app).get("/SCOM/prices");
    expect(res.status).toBe(200);
  });

  it("rejects ticker longer than 6 chars with 400", async () => {
    const res = await request(app).get("/TOOLONG/prices");
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric days param with 400", async () => {
    const res = await request(app).get("/SCOM/prices?days=abc");
    expect(res.status).toBe(400);
  });

  it("rejects days > 365 with 400", async () => {
    const res = await request(app).get("/SCOM/prices?days=500");
    expect(res.status).toBe(400);
  });

  it("accepts valid days param", async () => {
    const res = await request(app).get("/SCOM/prices?days=30");
    expect(res.status).toBe(200);
  });
});
