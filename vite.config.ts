import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@mystery": fileURLToPath(
        new URL(
          mode === "review"
            ? "./tests/fixtures/review/stress-220.json"
            : `./src/content/${mode === "large" ? "large" : "small"}.json`,
          import.meta.url,
        ),
      ),
    },
  },
  build: { target: "es2022", assetsInlineLimit: 10000000, sourcemap: false },
  test: { include: ["tests/**/*.test.ts"] },
}));
