import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Frozen classroom release: never use the current branch's build artifacts.
const release = {
  tag: "unterricht-2026-11-13-rc1",
  commit: "240d5fcfcac7e5924efe169493c9f7525ba5ed74",
  artifact: "artifacts/MysteryBoard-Boden-Klasse11.html",
  bytes: 459540,
  sha256: "4c451aec074a8cca75dd1879fce21ef5a6e0b32ce40b6af9412b9f70186540e8",
};
if (process.argv.length !== 2)
  throw new Error(
    "Aufruf ohne Argumente: node scripts/prepare-classroom-pages.mjs",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(root, "dist/unterricht-pages");
const git = (...args) => execFileSync("git", args, { cwd: root });
const tagCommit = git("rev-parse", "--verify", `${release.tag}^{commit}`)
  .toString("utf8")
  .trim();
if (tagCommit !== release.commit)
  throw new Error(
    "Die Unterrichtsmarkierung zeigt nicht auf den eingefrorenen Commit. Abbruch.",
  );
const html = git("show", `${release.commit}:${release.artifact}`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (html.length !== release.bytes || sha256(html) !== release.sha256)
  throw new Error(
    "Die Boden-HTML stimmt nicht mit der geprüften Unterrichtsversion überein.",
  );
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length)
  throw new Error(
    "dist/unterricht-pages muss leer sein. Vorhandene Dateien werden nicht überschrieben.",
  );
const manifest = {
  generated: true,
  purpose:
    "Statische Unterrichtsversion für den 13. November 2026; keine Veröffentlichung durch dieses Skript.",
  documentationDate: "2026-11-12",
  timeZone: "Europe/Berlin",
  repository: "https://github.com/Feerson1617/Vorlage-Mysteryboard",
  releaseTag: release.tag,
  sourceCommit: release.commit,
  source:
    "Unveränderte Datei aus git show des festen Unterrichtscommits; Tag-Ziel und festgelegte SHA-256 geprüft. Kein Build des aktuellen Entwicklungsbranches.",
  files: [
    {
      path: "index.html",
      copiedFrom: release.artifact,
      bytes: html.length,
      sha256: release.sha256,
      byteIdenticalToFrozenArtifact: true,
    },
    { path: ".nojekyll", bytes: 0, sha256: sha256(Buffer.alloc(0)) },
  ],
  publication:
    "Nur lokal vorbereitet. Öffentliche Bereitstellung erfordert gesonderte Freigabe.",
  realManagedSchoolIpadTest: "Offen; nicht durch diese Paketierung geprüft.",
};
await writeFile(resolve(destination, "index.html"), html, { flag: "wx" });
await writeFile(resolve(destination, ".nojekyll"), "", { flag: "wx" });
await writeFile(
  resolve(destination, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: "wx" },
);
if (
  sha256(await readFile(resolve(destination, "index.html"))) !== release.sha256
)
  throw new Error("Prüfsumme der kopierten index.html stimmt nicht überein.");
console.log(`Unterrichtspaket lokal vorbereitet: ${destination}`);
console.log(`${release.tag} → ${release.commit}`);
console.log(`index.html: ${html.length} Bytes; SHA-256 ${release.sha256}`);
console.log(
  "Keine Gitänderung, kein Push und keine Veröffentlichung ausgeführt.",
);
