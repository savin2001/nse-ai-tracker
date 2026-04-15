import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Spy on console methods before importing so the module picks up the mocks
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("exports debug / info / warn / error", async () => {
    const { logger } = await import("./logger");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("info does not throw with event only", async () => {
    const { logger } = await import("./logger");
    expect(() => logger.info("page_loaded")).not.toThrow();
  });

  it("info does not throw with fields", async () => {
    const { logger } = await import("./logger");
    expect(() => logger.info("stocks_fetched", { count: 20 })).not.toThrow();
  });

  it("warn does not throw", async () => {
    const { logger } = await import("./logger");
    expect(() => logger.warn("slow_response", { ms: 3000 })).not.toThrow();
  });

  it("error does not throw", async () => {
    const { logger } = await import("./logger");
    expect(() => logger.error("api_error", { status: 500 })).not.toThrow();
  });

  it("debug does not throw", async () => {
    const { logger } = await import("./logger");
    expect(() => logger.debug("cache_hit", { key: "scom" })).not.toThrow();
  });
});
