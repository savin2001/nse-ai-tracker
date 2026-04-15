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

describe("logger — development mode (IS_PROD=false)", () => {
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

// ── Production mode ───────────────────────────────────────────────────────────
// Covers the format() function body and the IS_PROD=true branch in log().
// IS_PROD is evaluated at module-load time, so we reset the module registry
// after setting import.meta.env.PROD=true to force a fresh evaluation.
describe("logger — production mode (IS_PROD=true)", () => {
  beforeEach(() => {
    vi.resetModules();
    import.meta.env.PROD = true;
  });

  afterEach(() => {
    import.meta.env.PROD = false;
    vi.resetModules();
  });

  it("emits structured JSON to console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("./logger");
    logger.error("api_error", { status: 500 });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("error");
    expect(output.event).toBe("api_error");
    expect(output.service).toBe("nse-frontend");
    expect(output.status).toBe(500);
    expect(typeof output.ts).toBe("string");
  });

  it("emits structured JSON to console.warn", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logger } = await import("./logger");
    logger.warn("slow_response", { ms: 3000 });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.level).toBe("warn");
    expect(output.event).toBe("slow_response");
    expect(output.ms).toBe(3000);
  });

  it("filters debug and info below production threshold (warn)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger } = await import("./logger");
    logger.debug("cache_hit");
    logger.info("page_loaded");
    expect(logSpy).not.toHaveBeenCalled();
  });
});
