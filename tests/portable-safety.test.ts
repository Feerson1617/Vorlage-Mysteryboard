import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import source from "../examples/universal/content.json";
import {
  taskDocument,
  validateContent,
  packDocument,
  encodeDocument,
  readDocument,
} from "../src/core/documents";
import { documentQr, readDocumentQr } from "../src/core/document-qr";
import { inspectImage } from "../src/core/media";
import { crc32 } from "../src/core/png";
import { parsePng, embedPayload } from "../src/core/png";
import { embedDocument } from "../src/core/documents";
import { zlibSync } from "fflate";

function chunk(type: string, bytes: Uint8Array) {
  const out = new Uint8Array(bytes.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, bytes.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(bytes, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}
function join(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
it("strukturierte Tabellen bleiben editierbare Daten und werden vollständig transportiert", () => {
  const cards = source.cards.map((c) => ({
    ...c,
    ...(c.id === 5
      ? {
          table: {
            caption: "Messreihe",
            headers: ["Zeit", "Wert"],
            rows: [
              ["Tag 1", "12"],
              ["Tag 2", "15"],
            ],
          },
        }
      : {}),
  }));
  const task = taskDocument({ ...source, cards });
  expect(readDocument(encodeDocument(task))).toEqual(task);
  cards[4].table!.rows[0].push("fremde Zelle");
  expect(() => taskDocument({ ...source, cards })).toThrow(/Tabelle/);
});
it("leere Entwürfe können keine ungültigen Hilfekategorien verbergen", () => {
  expect(() =>
    validateContent({ ...source, cards: [], title: "" }, true),
  ).toThrow(/leer/);
});
it("Dimensions- und Mengenlimits greifen vor dem Bilddecoder", () => {
  const bytes = new Uint8Array(
    readFileSync("examples/universal/diagramm-1.png"),
  );
  new DataView(bytes.buffer).setUint32(16, 40000);
  new DataView(bytes.buffer).setUint32(29, crc32(bytes.subarray(12, 29)));
  expect(() => inspectImage(bytes)).toThrow(/Bild/);
  expect(() => inspectImage(new Uint8Array(3_000_001))).toThrow();
  const raw = structuredClone(source);
  raw.cards[0].text = "x".repeat(4001);
  expect(() => taskDocument(raw)).toThrow();
});
it("neuer QR-Code ist separat, verlustfrei und bei zu großen Inhalten optional", () => {
  const task = taskDocument({
    id: "qr",
    version: "1.0.0",
    title: "Q",
    cardGroups: { p: { label: "Pflicht", prefix: "" } },
    cards: [{ id: 1, title: "A", text: "B", group: "p" }],
  });
  const qr = documentQr(packDocument(task));
  expect(qr).toBeTruthy();
  expect(readDocumentQr(qr!)).toEqual(task);
  expect(documentQr(packDocument(taskDocument(source)))).toBeNull();
  expect(() => readDocumentQr("MB1:AAAA")).toThrow(/ältere/);
  expect(() => readDocumentQr("MB3:" + "x".repeat(500))).toThrow();
});
it("Dokumenttyp und Schema erlauben keine versteckten privaten oder ausführbaren Felder", () => {
  const task = taskDocument(source);
  for (const field of [
    "solution",
    "teacherNotes",
    "team",
    "script",
    "__proto__",
  ]) {
    const manipulated = JSON.parse(JSON.stringify(task));
    Object.defineProperty(manipulated, field, {
      enumerable: true,
      value: "vertraulich",
    });
    expect(() =>
      readDocument(new TextEncoder().encode(JSON.stringify(manipulated))),
    ).toThrow();
  }
  expect(() =>
    readDocument(
      new TextEncoder().encode(
        '{"format":"MysteryBoard","formatVersion":null}',
      ),
    ),
  ).toThrow();
});

it("PNG-Blockgrenze bietet niemals eine selbst nicht wieder importierbare Sicherung an", () => {
  const original = new Uint8Array(
    readFileSync("examples/universal/diagramm-1.png"),
  );
  const chunks = parsePng(original),
    end = chunks.at(-1)!.start;
  const filler = chunk("teSt", new Uint8Array());
  const atLimit = join(
    original.subarray(0, end),
    ...Array.from({ length: 10_000 - chunks.length }, () => filler),
    original.subarray(end),
  );
  expect(parsePng(atLimit)).toHaveLength(10_000);
  expect(() => embedPayload(atLimit, new Uint8Array([1]))).toThrow(
    /Datenblöcke/,
  );
});

it("mehrere Megabytes eingebetteter Bilddaten bleiben im vollständigen PNG verlustfrei", () => {
  const template = new Uint8Array(
    readFileSync("examples/universal/diagramm-1.png"),
  );
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, 512);
  v.setUint32(4, 512);
  ihdr.set([8, 2, 0, 0, 0], 8);
  let seed = 12345;
  const cards = Array.from({ length: 4 }, (_, i) => {
    const pixels = new Uint8Array(512 * (512 * 3 + 1));
    for (let y = 0; y < 512; y++)
      for (let x = 1; x <= 512 * 3; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels[y * (512 * 3 + 1) + x] = seed >>> 24;
      }
    const bytes = join(
      template.subarray(0, 8),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlibSync(pixels)),
      chunk("IEND", new Uint8Array()),
    );
    return {
      id: i + 1,
      title: `Bild ${i + 1}`,
      text: "Deterministische Prüfdaten",
      group: "required",
      image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
    };
  });
  const task = taskDocument({ ...source, cards, help: undefined });
  const png = embedDocument(template, task);
  expect(png.length).toBeGreaterThan(3_000_000);
  expect(png.length).toBeLessThan(30_000_000);
  expect(readDocument(png)).toEqual(task);
});
