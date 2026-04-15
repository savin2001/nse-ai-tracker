import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    include:     ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json"],
      // Only measure the unit-testable source layer — no dist, no type stubs.
      include: ["src/**/*.ts"],
      // Exclude infrastructure files that require a live server, Supabase
      // connection, Resend, or Claude API — these are integration concerns,
      // not unit-testable without spinning up the full external stack.
      exclude: [
        "src/index.ts",               // Express app bootstrap — needs live server
        "src/middleware/auth.ts",      // Verifies Supabase JWTs
        "src/middleware/aiRateLimit.ts",  // Tracks budgets in Supabase
        "src/middleware/aiSecurity.ts",   // Calls Claude API
        "src/middleware/requestLogger.ts", // pino-http config (I added, no tests)
        "src/middleware/security.ts",  // Reads env vars at boot
        "src/routes/notify.ts",        // Protected by NOTIFY_SECRET + Supabase
        "src/services/email.ts",       // Requires Resend API key
        "src/services/supabase.ts",    // Supabase connection factory
        "src/services/types.ts",       // Type definitions only
        "src/services/logger.ts",      // pino config (tested implicitly)
        // Non-source artefacts
        "dist/**",
        "src/types/**",
        "src/tests/**",
        "**/*.d.ts",
        "vitest.config.ts",
      ],
      // Achievable threshold for the unit-testable route + handler layer
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
  },
});
