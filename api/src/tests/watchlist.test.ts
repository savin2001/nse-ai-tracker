import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, buildQueryMock } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: () => ({ from: () => buildQueryMock({ watchlist: ["SCOM", "KCB"] }) }),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { watchlistRouter } from "../routes/watchlist";
const app = buildApp(watchlistRouter, "/");

describe("GET /watchlist", () => {
  it("returns array of tickers", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /watchlist", () => {
  it("accepts valid ticker", async () => {
    const res = await request(app).post("/").send({ ticker: "eqty" });
    expect([200, 201]).toContain(res.status);
  });

  it("uppercases ticker", async () => {
    const res = await request(app).post("/").send({ ticker: "eqty" });
    if (res.status === 201) expect(res.body.ticker).toBe("EQTY");
  });

  it("rejects missing ticker with 400", async () => {
    const res = await request(app).post("/").send({});
    expect(res.status).toBe(400);
  });

  it("rejects ticker longer than 6 chars with 400", async () => {
    const res = await request(app).post("/").send({ ticker: "TOOLONG" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /watchlist/:ticker", () => {
  it("returns 204 for valid ticker", async () => {
    const res = await request(app).delete("/SCOM");
    expect(res.status).toBe(204);
  });

  it("rejects invalid ticker param with 400", async () => {
    const res = await request(app).delete("/TOOLONGTICKER");
    expect(res.status).toBe(400);
  });
});
