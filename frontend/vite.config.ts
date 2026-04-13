import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            motion: ["motion"],
          },
        },
      },
    },
  };
});
