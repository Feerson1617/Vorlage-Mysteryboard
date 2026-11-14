import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import source from "../examples/universal/content.json";
import { initialWork, withTeam } from "../src/core/model";
import { embedWork } from "../src/core/png";
import {
  canonical,
  contentHash,
  encodeDocument,
  embedDocument,
  packDocument,
  readDocument,
  studentDocument,
  taskDocument,
  unpackDocument,
  validateContent,
  validateDocument,
} from "../src/core/documents";
import { inspectDataImage } from "../src/core/media";
const png = new Uint8Array(readFileSync("examples/universal/diagramm-1.png"));
describe("Vollständige Mystery-Dateien, Phase 1", () => {
  it.each([5, 12, 18, 60])(
    "trägt %i Karten mit vielen Bildern verlustfrei durch Projekt und PNG",
    (n) => {
      const raw = structuredClone(source);
      raw.cards = Array.from({ length: n }, (_, i) => ({
        ...source.cards[n === 60 ? 0 : i % 3],
        id: i + 1,
        group: i % 2 ? "extension" : "required",
      }));
      delete (raw as { help?: unknown }).help;
      const task = taskDocument(raw);
      const work = withTeam(initialWork(task.content), "Prüfgruppe");
      work.cards[0].x = -432.25;
      work.cards[0].color = 3;
      work.categories[3] = "Eigene Kategorie";
      work.edges = [
        {
          id: 1,
          from: 1,
          to: 2,
          direction: 2,
          label: "Zusammenhang " + "x".repeat(480),
        },
      ];
      for (const doc of [task, studentDocument(task.content, work)]) {
        expect(readDocument(encodeDocument(doc))).toEqual(doc);
        expect(unpackDocument(packDocument(doc))).toEqual(doc);
        expect(readDocument(embedDocument(png, doc))).toEqual(doc);
      }
    },
  );
  it("unterscheidet Entwurf, Aufgabe, Schülerstand und Legacy eindeutig", () => {
    const task = taskDocument(source);
    const draft = validateDocument({
      ...task,
      kind: "draft",
      author: { initials: "AB", status: "in-progress", hiddenCards: [12] },
    });
    expect(readDocument(encodeDocument(draft))).toEqual(draft);
    expect(() =>
      validateDocument({ ...task, work: initialWork(task.content) }),
    ).toThrow();
    expect(() =>
      validateDocument({ ...task, author: { initials: "AB" } }),
    ).toThrow();
    expect(() =>
      readDocument(embedWork(png, initialWork(task.content))),
    ).toThrow(/ältere.*Kartentexte/);
  });
  it("weist Manipulation, unbekannte Formatversion und falsche Work-Identität zurück", () => {
    const task = taskDocument(source),
      changed = structuredClone(task);
    changed.content.cards[0].text = "Ausgetauscht";
    expect(() => validateDocument(changed)).toThrow(/prüfsumme/i);
    expect(() => validateDocument({ ...task, formatVersion: 4 })).toThrow();
    expect(() =>
      studentDocument(task.content, {
        ...initialWork(task.content),
        version: "2.0.0",
      }),
    ).toThrow(/Version/);
    const packed = packDocument(task);
    packed[10] ^= 1;
    expect(() => unpackDocument(packed)).toThrow(/prüfsumme/i);
    new DataView(packed.buffer).setUint32(4, 1_000_000_000);
    expect(() => unpackDocument(packed)).toThrow(/groß/);
  });
  it("weist externe/aktive/fehlende/beschädigte Medien und falsche Gruppen/Hilfen zurück", () => {
    for (const image of [
      "https://example.org/x.png",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,YWJjZA==",
    ]) {
      const raw = structuredClone(source);
      raw.cards[0].image = image;
      expect(() => taskDocument(raw)).toThrow();
    }
    const raw = structuredClone(source);
    raw.cards[0].group = "unbekannt";
    expect(() => taskDocument(raw)).toThrow();
    raw.cards[0].group = "required";
    raw.help.categories[0].cardIds = [999];
    expect(() => taskDocument(raw)).toThrow(/Orientierungshilfe/);
    const missing = structuredClone(source);
    delete (missing.cards[0] as { image?: string }).image;
    expect(() => taskDocument(missing)).toThrow(/Bildbeschreibung/);
  });
  it("erlaubt leere Entwürfe, aber keine leeren Schüleraufgaben oder Musterlösungen", () => {
    const raw = { ...source, cards: [], title: "", help: undefined };
    const c = validateContent(raw, true);
    expect(c.cards).toEqual([]);
    expect(() => taskDocument(raw)).toThrow();
    const c2 = validateContent(source);
    c2.initial.edges = [
      { id: 1, from: 1, to: 2, direction: 1, label: "Lösung" },
    ];
    expect(() => taskDocument(c2)).toThrow();
  });
  it("prüft echte PNG/JPEG/WebP-Dimensionen und begrenzt Medien unabhängig von QR", () => {
    expect(
      source.cards.slice(0, 3).map((c) => inspectDataImage(c.image!).mime),
    ).toEqual(["image/png", "image/jpeg", "image/webp"]);
    const raw = structuredClone(source);
    raw.cards = Array.from({ length: 100 }, (_, i) => ({
      ...source.cards[2],
      id: i + 1,
    }));
    delete (raw as { help?: unknown }).help;
    expect(() => taskDocument(raw)).toThrow(/24 Millionen/);
  });
  it("kanonisiert Schlüsselreihenfolgen und erhält Text als Text", () => {
    const task = taskDocument(source);
    task.content.cards[0].text =
      '<img src="https://example.org/a" onerror="alert(1)">';
    task.contentHash = contentHash(task.content);
    expect(readDocument(encodeDocument(task)).content.cards[0].text).toContain(
      "onerror",
    );
    expect(canonical({ z: 1, a: 2 })).toBe(canonical({ a: 2, z: 1 }));
  });
});
