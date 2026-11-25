import { unzipSync } from "fflate";
import { COLLECTION_BYTES } from "../../src/core/levels";
import { MAX_DOCUMENT_BYTES } from "../../src/core/documents";
import {
  readCatalogue,
  readResource,
  resourceName,
  singleResource,
} from "../player/resources";

const core = ["app.html", "imsmanifest.xml", "launch.html", "session.js"];
export function checkStudioArchive(data: Uint8Array) {
  let total = 0,
    tasks = 0;
  const seen = new Set<string>();
  if (data.length > 70_000_000) throw Error("SCORM-Paket zu groß.");
  const entries = unzipSync(data, {
    filter(f) {
      const resource =
        f.name === singleResource || /^level-[a-f0-9-]{36}\.json$/.test(f.name);
      total += f.originalSize;
      if (seen.has(f.name) || (!resource && !core.includes(f.name)))
        throw Error("Ungültiger SCORM-Eintrag.");
      seen.add(f.name);
      if (
        total > 70_000_000 ||
        (resource
          ? (tasks += f.originalSize) > COLLECTION_BYTES ||
            f.originalSize > MAX_DOCUMENT_BYTES
          : f.originalSize >= 10_000_000)
      )
        throw Error("SCORM-Inhalte sind zu groß.");
      return true;
    },
  });
  if (core.some((n) => !entries[n]?.length))
    throw Error("Unvollständiges Schüler-SCORM.");
  const names = Object.keys(entries)
    .filter((n) => !core.includes(n))
    .sort();
  const decode = new TextDecoder("utf-8", { fatal: true });
  const index =
    /<script id="mysteryboard-levels" type="application\/json">([^<]*)<\/script>/g;
  const matches = [...decode.decode(entries["app.html"]).matchAll(index)];
  const manifest = decode.decode(entries["imsmanifest.xml"]);
  const declared = [...manifest.matchAll(/<file href="([^"]+)"\s*\/>/g)]
    .map((m) => m[1])
    .sort();
  if (
    declared.join("|") !==
    [...names, ...core.filter((n) => n !== "imsmanifest.xml")].sort().join("|")
  )
    throw Error("Die SCORM-Dateiliste stimmt nicht mit dem Manifest überein.");
  if (!names.length && !matches.length) return;
  if (matches.length !== 1) throw Error("Ungültiges Aufgabenverzeichnis.");
  const c = readCatalogue(matches[0][1]);
  if (
    names.join("|") !==
    c.levels
      .map((l) => resourceName(c, l))
      .sort()
      .join("|")
  )
    throw Error("Aufgabenressourcen fehlen oder sind falsch zugeordnet.");
  for (const l of c.levels) readResource(entries[resourceName(c, l)], c, l);
}
