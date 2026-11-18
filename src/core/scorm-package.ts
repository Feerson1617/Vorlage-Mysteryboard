import { zipSync, strToU8 } from "fflate";

const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// Shared by browser export and the existing Node packager. The wrapper remains
// the original lifecycle-only SCORM 1.2 wrapper; no learner-data API is added.
export function scormEntries(
  app: Uint8Array,
  launch: string,
  session: string,
  identifier: string,
  title: string,
) {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(identifier))
    throw new Error("Ungültige SCORM-Kennung.");
  if (!app.length || app.length >= 10_000_000)
    throw new Error(
      "Die vollständige Unterrichts-HTML überschreitet die Grenze von 10 MB. Bitte Bilder verkleinern oder die Schülerversion als Datei mit der universellen Vorlage bereitstellen.",
    );
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(identifier)}" version="1.0"
 xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
 xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>${xml(title)}</title>
      <item identifier="ITEM" identifierref="SCO" isvisible="true">
        <title>${xml(title)}</title>
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
  return {
    "imsmanifest.xml": strToU8(manifest),
    "launch.html": strToU8(launch),
    "session.js": strToU8(session),
    "app.html": app,
  };
}
export function zipScorm(entries: Record<string, Uint8Array>) {
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, bytes]) => [
        name,
        [bytes, { mtime: new Date(2026, 10, 13, 0, 0, 0) }],
      ]),
    ),
    { level: 9 },
  );
}
