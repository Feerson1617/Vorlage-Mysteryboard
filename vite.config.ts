import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  projectRoot,
  targetForMode,
  validateBuildContents,
} from "./scripts/content-config.ts";
import { validateMystery } from "./src/core/model.ts";
export default defineConfig(({ mode }) => {
  validateBuildContents();
  const target = targetForMode(mode),
    content = resolve(projectRoot, target.content);
  // Apply the same validator in development, direct Vite builds and scripted builds.
  validateMystery(JSON.parse(readFileSync(content, "utf8")));
  return {
    define: {
      __UNIVERSAL__: JSON.stringify(target.key === "universal"),
      __INITIAL_DOCUMENT__: "null",
    },
    plugins: [react(), viteSingleFile()],
    resolve: { alias: { "@mystery": content } },
    build: { target: "es2022", assetsInlineLimit: 10000000, sourcemap: false },
    test: { include: ["tests/**/*.test.ts"] },
  };
});
