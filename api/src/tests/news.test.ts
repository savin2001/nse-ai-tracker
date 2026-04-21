import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, mockNse } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: mockNse([
    { id: 1, ticker: "SCOM", title: "Safaricom Q3 results", url: "https://example.com/1",
      published_at: "2025-04-09T10:00:00Z", sentiment_score: 0.8, source: "Business Daily" },
    { id: 2, ticker: "EQTY", title: "Equity Bank expands", url: "https://example.com/2",
      published_at: "2025-04-08T08:00:00Z", sentiment_score: -0.2, source: "The Star" },
  ]),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { newsRouter } from "../routes/news";
const app = buildApp(newsRouter, "/");

describe("GET /news", () => {
  it("returns 200 with array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns news fields", async () => {
    const res = await request(app).get("/");
    expect(res.body[0]).toMatchObject({ ticker: "SCOM", title: "Safaricom Q3 results" });
  });

  it("accepts ticker filter", async () => {
    const res = await request(app).get("/?ticker=scom");
    expect(res.status).toBe(200);
  });

  it("rejects limit > 50 with 400", async () => {
    const res = await request(app).get("/?limit=100");
    expect(res.status).toBe(400);
  });

  it("rejects days > 30 with 400", async () => {
    const res = await request(app).get("/?days=60");
    expect(res.status).toBe(400);
  });

  it("rejects ticker too short with 400", async () => {
    const res = await request(app).get("/?ticker=X");
    expect(res.status).toBe(400);
  });

  it("accepts offset param", async () => {
    const res = await request(app).get("/?offset=10");
    expect(res.status).toBe(200);
  });
});
