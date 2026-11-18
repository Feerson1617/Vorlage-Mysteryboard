import { Parser } from "htmlparser2";
import type { ImportFinding } from "./model";

// Inspect the original OOXML before Mammoth discards layout. No relationship
// target is opened. Only counts and human-readable feature names leave here.
export function reviewWord(files: Record<string, Uint8Array>): ImportFinding[] {
  const found = new Map<string, { count: number; missing: boolean }>();
  function add(label: string, missing = false) {
    const entry = found.get(label) ?? { count: 0, missing };
    entry.count++;
    found.set(label, entry);
  }
  for (const [path, data] of Object.entries(files)) {
    if (!/^word\/.*\.(?:xml|rels)$/i.test(path)) continue;
    const headerFooter = /^word\/(?:header|footer)\d*\.xml$/i.test(path);
    let visibleHeader = false,
      tables = 0;
    const parser = new Parser(
      {
        onopentag(qualified, attrs) {
          const name = qualified.split(":").at(-1);
          if (headerFooter && ["t", "drawing", "pict", "tbl"].includes(name!))
            visibleHeader = true;
          if (
            name === "Relationship" &&
            attrs.TargetMode?.toLowerCase() === "external" &&
            /\/(?:image|chart|oleObject|diagramData)$/.test(attrs.Type ?? "")
          )
            add("Extern verknüpftes Medium", true);
          if (name === "chart") add("Word-Diagramm", true);
          if (name === "relIds") add("SmartArt", true);
          if (name === "anchor") add("Frei positioniertes Objekt");
          if (name === "txbxContent") add("Textfeld");
          if (["wgp", "grpSp", "group"].includes(name!)) add("Gruppierte Form");
          if (["wsp", "shape", "sp"].includes(name!)) add("Zeichnungsform");
          if (name === "oMath") add("Mathematische Formel");
          if (name === "vertAlign") add("Hoch- oder Tiefstellung");
          if (name === "cols" && Number(attrs["w:num"] ?? 1) > 1)
            add("Mehrspaltige Anordnung");
          if (name === "tbl" && ++tables > 1) add("Verschachtelte Tabelle");
          if (["gridSpan", "vMerge", "hMerge"].includes(name!))
            add("Verbundene Tabellenzelle");
          if (name === "footnoteReference" || name === "endnoteReference")
            add("Fuß- oder Endnote");
        },
        onclosetag(q) {
          if (q.split(":").at(-1) === "tbl") tables--;
        },
      },
      { xmlMode: true, decodeEntities: true },
    );
    parser.end(new TextDecoder().decode(data));
    if (visibleHeader) add("Inhalt in Kopf- oder Fußzeile", true);
  }
  return [...found].map(([label, { count, missing }]) => ({
    status: missing ? "missing" : "review",
    message:
      label +
      " (" +
      count +
      "). " +
      (missing
        ? "Das Original lokal als PDF exportieren und die betroffene Seite als Ausschnitt übernehmen."
        : "Position und Inhalt im Original vergleichen. Bei Abweichungen lokal als PDF exportieren."),
  }));
}
