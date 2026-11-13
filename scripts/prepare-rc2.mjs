import { copyFile, writeFile } from "node:fs/promises";
import { packageScorm } from "./package-scorm.mjs";
import { projectRoot } from "./content-config.ts";
process.chdir(projectRoot);
const html = "artifacts/MysteryBoard-Boden-Klasse11-RC2.html";
const zip = "artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip";
await copyFile("artifacts/MysteryBoard-Boden-Klasse11.html", html);
const result = await packageScorm(html, zip);
await writeFile(
  "artifacts/RC2-integrity.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
