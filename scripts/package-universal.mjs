import { writeFile } from "node:fs/promises";
import { packageScorm } from "./package-scorm.mjs";
import { projectRoot } from "./content-config.ts";
process.chdir(projectRoot);
const result = await packageScorm(
  "artifacts/MysteryBoard-Universal.html",
  "artifacts/MysteryBoard-Universal-SCORM-1.2.zip",
  "MysteryBoard-Universal-v3",
  "MysteryBoard – universelle Autoren- und Unterrichtsvorlage",
);
await writeFile(
  "artifacts/Universal-integrity.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
