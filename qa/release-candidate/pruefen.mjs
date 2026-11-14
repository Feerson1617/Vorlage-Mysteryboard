// The extracted delivery is the sole source of app bytes and fixtures.
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] || "..");
const output = join(root, "browserpruefung", "ergebnisse");
await mkdir(output, { recursive: true });
for (const name of ["hilfe-pruefen.mjs", "papier-pruefen.mjs"])
  execFileSync(process.execPath, [join(here, name), root], {
    stdio: "inherit",
  });
const help = JSON.parse(await readFile(join(output, "ERGEBNIS.json"), "utf8"));
const paper = JSON.parse(
  await readFile(join(output, "papier", "ERGEBNIS.json"), "utf8"),
);
if (help.status !== "passed" || paper.status !== "passed")
  throw new Error("Ein Browserlauf ist fehlgeschlagen.");
await writeFile(
  join(output, "ENDABNAHME.json"),
  JSON.stringify(
    {
      status: "passed",
      help,
      paper,
      externalAiTrial: "OPEN",
      realSchoolDevices: "OPEN",
    },
    null,
    2,
  ) + "\n",
);
