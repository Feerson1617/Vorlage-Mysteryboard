import { copyFile, writeFile } from "node:fs/promises";
import { packageScorm } from "./package-scorm.mjs";
import { projectRoot } from "./content-config.ts";
import { execFileSync } from "node:child_process";
process.chdir(projectRoot);
if (
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !==
    "2c39d5427dc7cbd03558657d62821823949ac170" ||
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
) {
  throw new Error(
    "RC2 ist eingefroren. Diese Entwicklungsphase darf die RC2-Artefakte nicht neu verpacken. Für eine Reproduktion den unveränderten RC2-Tag verwenden.",
  );
}
const html = "artifacts/MysteryBoard-Boden-Klasse11-RC2.html";
const zip = "artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip";
await copyFile("artifacts/MysteryBoard-Boden-Klasse11.html", html);
const result = await packageScorm(html, zip);
await writeFile(
  "artifacts/RC2-integrity.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
