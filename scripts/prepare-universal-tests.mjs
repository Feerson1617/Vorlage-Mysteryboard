// Rebuild the specific fixture with the same current core; never test a stale
// checked-in example. The CLI's no-overwrite safeguard remains in force.
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { projectRoot } from "./content-config.ts";
process.chdir(projectRoot);
execFileSync(process.execPath, ["scripts/package-universal.mjs"], {
  stdio: "inherit",
});
await mkdir("dist", { recursive: true });
const staging = await mkdtemp(join(projectRoot, "dist", "authoring-test-"));
try {
  const html = join(staging, "MysteryBoard-Editierbares-Beispiel.html");
  const scorm = join(staging, "MysteryBoard-Editierbares-Beispiel-SCORM.zip");
  execFileSync(
    process.execPath,
    [
      "scripts/mystery-tools.mjs",
      "build",
      "examples/universal/ki-beispiel.mysteryboard",
      html,
      scorm,
    ],
    { stdio: "inherit" },
  );
  await mkdir("artifacts/tests", { recursive: true });
  await copyFile(
    html,
    "artifacts/tests/MysteryBoard-Editierbares-Beispiel.html",
  );
  await copyFile(
    scorm,
    "artifacts/tests/MysteryBoard-Editierbares-Beispiel-SCORM.zip",
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
