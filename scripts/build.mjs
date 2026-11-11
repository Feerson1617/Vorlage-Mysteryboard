import { build } from "vite";
import {
  projectRoot,
  loadBuildTargets,
  selectBuildTargets,
  validateBuildContents,
} from "./content-config.ts";
import { checkBuilds } from "./check-build.mjs";

process.chdir(projectRoot);
const registry = loadBuildTargets();
validateBuildContents(registry);
const targets = selectBuildTargets(process.argv.slice(2), registry);
for (const target of targets) {
  await build({ mode: target.key, build: { outDir: `dist/${target.key}` } });
}
await checkBuilds(targets);
