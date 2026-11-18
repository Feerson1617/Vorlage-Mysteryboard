import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import {
  loadBuildTargets,
  projectRoot,
  validateBuildContents,
} from "./content-config.ts";

// Packaging only: the existing build and its tests must run before this script.
// Never modify the student document or publish anything from here.
const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || arguments_[0]?.startsWith("-"))
  throw new Error(
    "Aufruf: node scripts/prepare-pages.mjs [Ausgabeverzeichnis]",
  );
const destination = resolve(projectRoot, arguments_[0] || "dist/pages");
const registry = loadBuildTargets();
validateBuildContents(registry);
const soil = registry.find((target) => target.key === "boden-klasse11");
if (!soil || soil.testOnly)
  throw new Error("Der Produktions-Build boden-klasse11 fehlt.");
const git = (...args) =>
  execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const sourceModified = Boolean(
  git(
    "status",
    "--porcelain",
    "--untracked-files=normal",
    "--",
    ".",
    ":(exclude)artifacts",
  ),
);
if (process.env.CI && sourceModified)
  throw new Error(
    "Der Quellstand wurde nach dem Checkout verändert; Pages-Paket abgebrochen.",
  );
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const artifacts = [];
let studentHtml;
for (const target of registry.filter((entry) => !entry.testOnly)) {
  const file = `artifacts/${target.output}`;
  const bytes = await readFile(resolve(projectRoot, file));
  if (!bytes.length || bytes.length >= 10_000_000)
    throw new Error(
      `${file}: Die HTML-Datei muss kleiner als 10.000.000 Bytes sein.`,
    );
  const text = bytes.toString("utf8");
  if (
    !/<html\b/i.test(text) ||
    !/<\/html>/i.test(text) ||
    /<(?:script|link|img)\b[^>]*(?:src|href)=["'](?:https?:|\/|\.\/)/i.test(
      text,
    )
  )
    throw new Error(`${file}: Kein gültiges eigenständiges Build-Artefakt.`);
  artifacts.push({
    target: target.key,
    file,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
  if (target.key === soil.key) studentHtml = bytes;
}

await mkdir(destination, { recursive: true });
const allowedFiles = new Set([
  "index.html",
  ".nojekyll",
  "manifest.json",
  "README.md",
]);
const existing = await readdir(destination, { withFileTypes: true });
if (existing.some((entry) => !allowedFiles.has(entry.name) || !entry.isFile()))
  throw new Error(
    "Das Ausgabeverzeichnis enthält fremde Dateien. Bitte ein leeres Verzeichnis wählen.",
  );
const content = JSON.parse(
  await readFile(resolve(projectRoot, soil.content), "utf8"),
);
const manifest = {
  generated: true,
  purpose:
    "Vorbereitetes GitHub-Pages-Paket; keine Veröffentlichung durch dieses Skript.",
  source: {
    commit,
    sourceModified,
    provenance: sourceModified
      ? "Lokaler Entwurf mit Änderungen gegenüber dem angegebenen Basiscommit."
      : "Unveränderter Quellstand des angegebenen Commits; Artefakte separat geprüft.",
  },
  content: { file: soil.content, id: content.id, version: content.version },
  productionArtifacts: artifacts,
  pages: {
    file: "index.html",
    copiedFrom: `artifacts/${soil.output}`,
    bytes: studentHtml.length,
    sha256: sha256(studentHtml),
    byteIdentical: true,
  },
};
await writeFile(resolve(destination, "index.html"), studentHtml);
await writeFile(resolve(destination, ".nojekyll"), "");
await writeFile(
  resolve(destination, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  resolve(destination, "README.md"),
  `# Generiertes MysteryBoard-Pages-Paket\n\n` +
    `index.html ist eine unveränderte Kopie von artifacts/${soil.output}.\n` +
    `Nicht von Hand bearbeiten; aus der universellen Vorlage neu erzeugen.\n\n` +
    `Quellcommit: ${commit}\n` +
    `Lokale Quelländerungen: ${sourceModified ? "ja – Entwurf, kein reines Commit-Artefakt" : "nein"}\n` +
    `HTML: ${studentHtml.length} Bytes\nSHA-256: ${sha256(studentHtml)}\n\n` +
    `manifest.json enthält die Prüfsummen aller Produktions-HTMLs.\n` +
    `Dieses Paket ist vorbereitet, nicht automatisch veröffentlicht.\n` +
    `Eine technische Browserprüfung ersetzt weder Canva- noch echte Schul-iPad-Tests.\n`,
);
if (!(await readFile(resolve(destination, "index.html"))).equals(studentHtml))
  throw new Error(
    "Die Pages-Datei stimmt nicht mit der erzeugten Boden-HTML überein.",
  );
console.log(
  `Pages-Paket: ${relative(projectRoot, destination) || destination}`,
);
console.log(
  `Quellcommit: ${commit}${sourceModified ? " (mit lokalen Quelländerungen)" : ""}`,
);
console.log(
  `index.html: ${studentHtml.length} Bytes; SHA-256 ${sha256(studentHtml)}`,
);
