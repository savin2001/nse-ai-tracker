import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json"],
      thresholds: { lines: 70, functions: 70, branches: 70 },
      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",
        "**/*.d.ts",
        "dist/**",
      ],
    },
  },
});
