// Package already-built HTML; never rebuild or alter the application bytes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync, strToU8 } from "fflate";

export const RC2_MANIFEST_ID = "MysteryBoard-Boden-Klasse11-2026-11-13-RC2";
const root = fileURLToPath(new URL("../", import.meta.url));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const xml = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export async function packageScorm(
  input,
  output,
  identifier = RC2_MANIFEST_ID,
) {
  assert(
    /^[A-Za-z][A-Za-z0-9._-]*$/.test(identifier),
    "Invalid manifest identifier",
  );
  const app = await readFile(input);
  assert(
    app.length > 0 && app.length < 10_000_000,
    "HTML size outside release limit",
  );
  assert(
    /<html[\s>]/i.test(app.toString()) && /<\/html>/i.test(app.toString()),
    "Complete HTML required",
  );
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(identifier)}" version="1.0"
 xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
 xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>MysteryBoard – Boden Klasse 11 RC2</title>
      <item identifier="ITEM" identifierref="SCO" isvisible="true">
        <title>MysteryBoard – Boden Klasse 11 RC2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="SCO" type="webcontent" adlcp:scormtype="sco" href="launch.html">
      <file href="launch.html"/><file href="session.js"/><file href="app.html"/>
    </resource>
  </resources>
</manifest>
`;
  const entries = {
    "imsmanifest.xml": strToU8(manifest),
    "launch.html": new Uint8Array(
      await readFile(join(root, "scorm/launch.html")),
    ),
    "session.js": new Uint8Array(
      await readFile(join(root, "scorm/session.js")),
    ),
    "app.html": new Uint8Array(app),
  };
  // Fixed timestamps make the same inputs produce an identical release ZIP.
  const archive = zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, bytes]) => [
        name,
        [bytes, { mtime: new Date(2026, 10, 13, 0, 0, 0) }],
      ]),
    ),
    { level: 9 },
  );
  const unpacked = unzipSync(archive);
  assert.deepEqual(Object.keys(unpacked).sort(), Object.keys(entries).sort());
  for (const [name, bytes] of Object.entries(entries))
    assert.deepEqual(unpacked[name], bytes, `ZIP roundtrip changed ${name}`);
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, archive);
  return {
    manifestIdentifier: identifier,
    scormVersion: "1.2",
    html: { file: basename(input), bytes: app.length, sha256: sha(app) },
    zip: {
      file: basename(output),
      bytes: archive.length,
      sha256: sha(archive),
    },
    applicationByteIdentical: true,
    entries: Object.entries(entries).map(([file, b]) => ({
      file,
      bytes: b.length,
      sha256: sha(b),
    })),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [input, output] = process.argv.slice(2);
  assert(
    input && output && process.argv.length === 4,
    "Usage: node scripts/package-scorm.mjs FINAL-RC2.html OUTPUT-SCORM-1.2.zip",
  );
  console.log(
    JSON.stringify(
      await packageScorm(resolve(input), resolve(output)),
      null,
      2,
    ),
  );
}
