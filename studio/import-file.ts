import { unzipSync } from "fflate";
import { readProject, COLLECTION_BYTES } from "../src/core/levels";
import { parsePng } from "../src/core/png";
import { isExchange, parseExchangeText } from "./exchange/import";

export function identifyFile(bytes: Uint8Array) {
  if (bytes.length > COLLECTION_BYTES)
    throw Error("Die Datei überschreitet 60 MB.");
  if (bytes[0] === 137) {
    if (bytes.length > 30_000_000) throw Error("Die PNG überschreitet 30 MB.");
    if (!parsePng(bytes).some((chunk) => chunk.type === "mySt"))
      return { type: "material", extension: "png" } as const;
  } else {
    const signature = String.fromCharCode(...bytes.subarray(0, 12));
    if (signature.startsWith("%PDF-"))
      return { type: "material", extension: "pdf" } as const;
    if (signature.startsWith("PK")) {
      const parts = new Set<string>();
      unzipSync(bytes, {
        filter(entry) {
          parts.add(entry.name);
          return false;
        },
      });
      if (!parts.has("word/document.xml") || !parts.has("[Content_Types].xml"))
        throw Error("Dieses Archiv enthält kein Word-Dokument.");
      return { type: "material", extension: "docx" } as const;
    }
    if (bytes[0] === 255 || signature.startsWith("RIFF")) {
      if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        return { type: "material", extension: "jpg" } as const;
      if (signature.startsWith("RIFF") && signature.endsWith("WEBP"))
        return { type: "material", extension: "webp" } as const;
    }
    const value = parseExchangeText(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (isExchange(value)) return { type: "exchange", value } as const;
  }
  const project = readProject(bytes);
  if (project.format === "MysteryBoard" && project.kind === "student")
    throw Error("Schülerarbeitsstände bitte im Schülerplayer fortsetzen.");
  return { type: "project", project } as const;
}
