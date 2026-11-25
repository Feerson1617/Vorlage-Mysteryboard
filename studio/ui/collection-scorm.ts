import { publishDraft } from "../../src/core/authoring";
import { encodeDocument } from "../../src/core/documents";
import {
  validateCollection,
  COLLECTION_BYTES,
  type Collection,
} from "../../src/core/levels";
import { scormEntries, zipScorm } from "../../src/core/scorm-package";
import type { Catalogue } from "../player/recovery";
export function collectionScorm(
  c: Collection,
  template: string,
  launch: string,
  session: string,
) {
  validateCollection(c);
  const catalogue: Catalogue = { id: c.id, title: c.title, levels: [] };
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const l of c.levels) {
    const task = publishDraft(l.draft),
      data = encodeDocument(task);
    if ((total += data.length) > COLLECTION_BYTES)
      throw Error("Die Aufgaben überschreiten zusammen 60 MB.");
    files["level-" + l.id + ".json"] = data;
    catalogue.levels.push({
      id: l.id,
      name: l.name,
      description: l.description,
      hash: task.contentHash,
      version: task.content.version,
      mode: task.content.recovery ?? "off",
    });
  }
  const json = JSON.stringify(catalogue).replaceAll("<", "\\u003c");
  const end = template.lastIndexOf("</body>");
  if (end < 0) throw Error("Der geprüfte Schülerplayer fehlt.");
  const html =
    template.slice(0, end) +
    '<script id="mysteryboard-levels" type="application/json">' +
    json +
    "</script>" +
    template.slice(end);
  const entries = scormEntries(
    new TextEncoder().encode(html),
    launch,
    session,
    "MysteryBoard-" + c.id,
    c.title,
  );
  const manifest = new TextDecoder().decode(entries["imsmanifest.xml"]).replace(
    "</resource>",
    Object.keys(files)
      .map((name) => '<file href="' + name + '"/>')
      .join("") + "</resource>",
  );
  entries["imsmanifest.xml"] = new TextEncoder().encode(manifest);
  return new File(
    [new Uint8Array(zipScorm({ ...entries, ...files }))],
    "MysteryBoard-Niveaus-SCORM-1.2.zip",
    { type: "application/zip" },
  );
}
