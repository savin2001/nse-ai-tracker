import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp, mockNse } from "./helpers";

vi.mock("../services/supabase", () => ({
  nse: mockNse([
    { id: 1, ticker: "SCOM", event_type: "earnings_release", severity: "high",
      description: "Safaricom reports strong Q3 earnings", metadata: {}, detected_at: "2025-04-09T10:00:00Z" },
  ]),
  supabaseAdmin: { auth: { getUser: vi.fn() } },
}));

import { eventsRouter } from "../routes/events";
const app = buildApp(eventsRouter, "/");

describe("GET /events", () => {
  it("returns 200 with array", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns event fields", async () => {
    const res = await request(app).get("/");
    expect(res.body[0]).toMatchObject({ ticker: "SCOM", event_type: "earnings_release" });
  });

  it("rejects invalid severity with 400", async () => {
    const res = await request(app).get("/?severity=extreme");
    expect(res.status).toBe(400);
  });

  it("rejects limit > 100 with 400", async () => {
    const res = await request(app).get("/?limit=500");
    expect(res.status).toBe(400);
  });

  it("accepts ticker filter", async () => {
    const res = await request(app).get("/?ticker=scom");
    expect(res.status).toBe(200);
  });
});
