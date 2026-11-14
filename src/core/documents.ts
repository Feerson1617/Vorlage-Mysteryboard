import Ajv, { type ValidateFunction } from "ajv";
import { sha256 } from "@noble/hashes/sha2.js";
import { zlibSync, unzlibSync } from "fflate";
import contentSchema from "../../schemas/mystery-content.schema.json" with { type: "json" };
import documentSchema from "../../schemas/mystery-document.schema.json" with { type: "json" };
import {
  validateMystery,
  validateWork,
  type Mystery,
  type CardContent,
  type Work,
} from "./model";
import { extractPayload, embedPayload } from "./png";
import {
  inspectDataImage,
  MAX_TOTAL_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_PIXELS,
} from "./media";

export type Content = Omit<Mystery, "cards"> & {
  subtitle?: string;
  cards: (CardContent & { source?: string })[];
};
export type Draft = {
  format: "MysteryBoard";
  formatVersion: 3;
  kind: "draft";
  content: Content;
  contentHash: string;
  author: {
    initials: string;
    status: "in-progress" | "reviewed";
    hiddenCards: number[];
  };
};
export type Task = {
  format: "MysteryBoard";
  formatVersion: 3;
  kind: "task";
  content: Content;
  contentHash: string;
};
export type Student = {
  format: "MysteryBoard";
  formatVersion: 3;
  kind: "student";
  content: Content;
  contentHash: string;
  work: Work;
};
export type MysteryDocument = Draft | Task | Student;
export const MAX_DOCUMENT_BYTES = 20_000_000;
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
const ajv = new Ajv({ allErrors: false, strict: true });
const checkContent = ajv.compile(contentSchema);
const draftSchema = structuredClone(contentSchema);
delete (draftSchema as { $id?: string }).$id;
draftSchema.properties.cards.minItems = 0;
draftSchema.properties.title.minLength = 0;
const checkDraftContent = ajv.compile(draftSchema);
const checkDocument = ajv.compile(documentSchema);
function schemaError(check: ValidateFunction) {
  const error = check.errors?.[0];
  const path = error?.instancePath || "/";
  const reasons: Record<string, string> = {
    required: "Ein Pflichtfeld fehlt",
    additionalProperties: "Ein nicht unterstütztes Feld ist enthalten",
    type: "Ein Feld hat den falschen Datentyp",
    enum: "Ein Wert ist nicht zulässig",
    const: "Format oder Dokumenttyp ist nicht unterstützt",
    minLength: "Ein Textfeld ist leer oder zu kurz",
    maxLength: "Ein Textfeld ist zu lang",
    pattern: "Ein Textfeld hat ein ungültiges Format",
    minItems: "Eine Liste enthält zu wenige Einträge",
    maxItems: "Eine Liste enthält zu viele Einträge",
    uniqueItems: "Eine Liste enthält doppelte Einträge",
    minimum: "Eine Zahl ist zu klein",
    maximum: "Eine Zahl ist zu groß",
    oneOf: "Der Dokumenttyp ist nicht eindeutig gültig",
  };
  return new Error(
    `Ungültige Mystery-Datei bei ${path}: ${reasons[error?.keyword || ""] || "Die Daten entsprechen nicht dem Format"}. ${error?.params.missingProperty ? `Erforderliches Feld: ${error.params.missingProperty}.` : ""}`,
  );
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function contentHash(content: Content) {
  return Array.from(sha256(encoder.encode(canonical(content))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validateContent(value: unknown, draft = false): Content {
  const check = draft ? checkDraftContent : checkContent;
  if (!check(value)) throw schemaError(check);
  const raw = structuredClone(value) as Content;
  let mediaBytes = 0,
    pixels = 0;
  for (const c of raw.cards) {
    if (c.image) {
      const info = inspectDataImage(c.image);
      mediaBytes += info.bytes;
      pixels += info.width * info.height;
    }
    if (c.imageAlt && !c.image)
      throw new Error("Eine Bildbeschreibung benötigt ein eingebettetes Bild.");
    if (
      c.table &&
      (c.table.headers.some((h) => !h.trim()) ||
        c.table.rows.some((row) => row.length !== c.table!.headers.length))
    )
      throw new Error(
        "Die Tabelle benötigt beschriftete Spalten und in jeder Zeile genau einen Wert je Spalte.",
      );
  }
  if (mediaBytes > MAX_TOTAL_IMAGE_BYTES || pixels > MAX_TOTAL_IMAGE_PIXELS)
    throw new Error(
      "Die Bilder zusammen sind zu groß: höchstens 12 MB und 24 Millionen Bildpunkte pro Mystery.",
    );
  // Keep contiguous numeric IDs as in the established core. Structural author
  // edits renumber explicitly and advance the content version, never old work.
  const empty = draft && raw.cards.length === 0;
  if (empty && raw.help?.categories?.length)
    throw new Error(
      "Ein leerer Entwurf kann keine Karten einer Hilfekategorie zuordnen.",
    );
  const normal = validateMystery(
    empty
      ? { ...raw, cards: [{ id: 1, title: "", text: "" }], initial: undefined }
      : raw,
  ) as Content;
  if (empty) {
    normal.cards = [];
    normal.initial.cards = [];
    normal.help = raw.help;
  }
  if (!empty && !raw.title.trim())
    throw new Error("Bitte einen Mystery-Titel eingeben.");
  if (
    normal.initial.edges.length ||
    normal.initial.cards.some((c) => c.color !== 0) ||
    normal.initial.categories.some(Boolean)
  )
    throw new Error(
      "Eine Aufgabe muss ohne Schülerlösung, Farben oder Beziehungen beginnen.",
    );
  return normal;
}
export function validateDocument(value: unknown): MysteryDocument {
  if (!checkDocument(value)) throw schemaError(checkDocument);
  const doc = structuredClone(value) as MysteryDocument;
  doc.content = validateContent(doc.content, doc.kind === "draft");
  if (doc.contentHash !== contentHash(doc.content))
    throw new Error(
      "Die Inhaltsprüfsumme stimmt nicht. Die Datei ist verändert oder beschädigt.",
    );
  if (doc.kind === "student") doc.work = validateWork(doc.work, doc.content);
  if (doc.kind === "draft") {
    if (
      !doc.author.initials.trim() ||
      /[\p{Cc}\p{Cf}]/u.test(doc.author.initials)
    )
      throw new Error("Das Lehrkraftkürzel ist ungültig.");
    if (
      doc.author.hiddenCards.some(
        (id) => !doc.content.cards.some((c) => c.id === id),
      )
    )
      throw new Error(
        "Der Entwurf verweist auf unbekannte unveröffentlichte Karten.",
      );
  }
  return doc;
}
export function taskDocument(value: unknown): Task {
  const content = validateContent(value);
  return {
    format: "MysteryBoard",
    formatVersion: 3,
    kind: "task",
    content,
    contentHash: contentHash(content),
  };
}
export function studentDocument(content: Content, work: Work): Student {
  return validateDocument({
    ...taskDocument(content),
    kind: "student",
    work,
  }) as Student;
}
export function encodeDocument(doc: MysteryDocument): Uint8Array {
  const raw = encoder.encode(canonical(validateDocument(doc)));
  if (raw.length > MAX_DOCUMENT_BYTES)
    throw new Error("Die vollständige Mystery-Datei überschreitet 20 MB.");
  return raw;
}
export function packDocument(doc: MysteryDocument): Uint8Array {
  const raw = encodeDocument(doc),
    compressed = zlibSync(raw, { level: 6 });
  const out = new Uint8Array(compressed.length + 40);
  out.set([77, 66, 88, 3]); // MBX3, deliberately distinct from legacy MBS1/MBS2
  new DataView(out.buffer).setUint32(4, raw.length);
  out.set(sha256(raw), 8);
  out.set(compressed, 40);
  return out;
}
const legacyMessage =
  "Diese ältere PNG-/QR-Sicherung enthält keine Kartentexte oder Medien. Öffnet sie mit der ursprünglichen passenden Mystery-HTML. Sie ist keine vollständige Mystery-Datei für die Blanko-Vorlage.";
export function unpackDocument(bytes: Uint8Array): MysteryDocument {
  if (bytes[0] === 77 && bytes[1] === 66 && bytes[2] === 83)
    throw new Error(legacyMessage);
  if (
    bytes.length < 41 ||
    bytes.length > MAX_DOCUMENT_BYTES ||
    ![77, 66, 88, 3].every((b, i) => bytes[i] === b)
  )
    throw new Error(
      "Unbekannte oder beschädigte vollständige Mystery-Sicherung.",
    );
  const size = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(4);
  if (!size || size > MAX_DOCUMENT_BYTES)
    throw new Error("Die entpackte Mystery-Datei ist zu groß.");
  let raw: Uint8Array;
  try {
    raw = unzlibSync(bytes.subarray(40), { out: new Uint8Array(size) });
  } catch {
    throw new Error("Die komprimierte Mystery-Datei ist beschädigt.");
  }
  if (raw.length !== size || !sha256(raw).every((b, i) => b === bytes[8 + i]))
    throw new Error("Die Sicherungsprüfsumme stimmt nicht.");
  return readJson(raw);
}
function readJson(bytes: Uint8Array): MysteryDocument {
  if (bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error("Die Mystery-Datei überschreitet 20 MB.");
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    throw new Error("Die Mystery-Datei enthält kein vollständiges UTF-8-JSON.");
  }
  return validateDocument(value);
}
export function readDocument(bytes: Uint8Array): MysteryDocument {
  if (bytes.length > 30_000_000)
    throw new Error("Die Datei überschreitet 30 MB.");
  return bytes[0] === 137
    ? unpackDocument(extractPayload(bytes))
    : readJson(bytes);
}
export function embedDocument(png: Uint8Array, doc: MysteryDocument) {
  return embedPayload(png, packDocument(doc));
}
