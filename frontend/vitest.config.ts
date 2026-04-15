import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",   // pure-logic tests only; React components need a separate browser setup
    passWithNoTests: true, // don't fail if no test files matched
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json"],
      // Only measure the pure-logic layer — React components / pages / auth
      // all require a browser environment and have no tests yet.
      include: [
        "src/services/logger.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 60 },
    },
  },
});
