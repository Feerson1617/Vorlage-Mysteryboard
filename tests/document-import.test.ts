import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { newDraft } from "../src/core/authoring";
import { readDocument, canonical, type Draft } from "../src/core/documents";
import {
  checkImportFile,
  proposeCards,
  takeImportedCards,
  mergeImported,
  isCardHeading,
} from "../src/core/document-import/model";
import { boundedDocx } from "../src/core/document-import/zip";
const base = readDocument(
  readFileSync("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
) as Draft;
test("Importgrenzen und ältere Word-Dateien werden vor dem Parser geprüft", () => {
  expect(checkImportFile("A.DOCX", 20_000_000)).toBe("docx");
  expect(() => checkImportFile("alt.doc", 100)).toThrow(/ältere/i);
  expect(() => checkImportFile("a.pdf", 20_000_001)).toThrow(/20 MB/);
  expect(() => checkImportFile("a.html", 10)).toThrow(/docx/);
});
test("Echte DOCX-Pakete werden vollständig und mit CRC geprüft", () => {
  const a = readFileSync(
    "tests/fixtures/document-import/A-Word-12-Karten.docx",
  );
  const result = boundedDocx(a);
  expect(result.files["word/document.xml"]).toBeDefined();
  const bad = a.slice();
  const position = bad.indexOf(Buffer.from("PK\x01\x02", "binary"));
  bad[position + 16] ^= 1;
  expect(() => boundedDocx(bad)).toThrow(/Prüfsumme/);
});
test("Kompressionsbomben, aktive Inhalte, Verzeichniswechsel und widersprüchliche Archive werden abgefangen", () => {
  for (const n of [
    "F-Word-komprimiert.docx",
    "F-Word-aktive-Inhalte.docx",
    "F-Defekt.docx",
  ])
    expect(() =>
      boundedDocx(readFileSync("tests/fixtures/document-import/" + n)),
    ).toThrow();
  const zip = zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8("<w/>"),
    "../escape.xml": strToU8("x"),
  });
  expect(() => boundedDocx(zip)).toThrow(/unzulässig/);
});
test("Strukturvorschläge erfinden keine Titel aus bloßer Schriftgröße oder Zahlen", () => {
  for (const value of [
    "08:00 12,5",
    "12:00 17,0",
    "16:00 18,5",
    "1.50 g",
    "3,50 g",
  ])
    expect(isCardHeading(value)).toBe(false);
  for (const value of [
    "1. Beobachtung",
    "2: Messung",
    "Karte 3: Werte",
    "V4: Grenze",
  ])
    expect(isCardHeading(value)).toBe(true);
  const cards = proposeCards([
    { kind: "paragraph", text: "Großer Text ohne semantische Überschrift" },
    { kind: "heading", text: "Karte 7: Messwert" },
    { kind: "paragraph", text: "12,5 °C; 0,25 L." },
    { kind: "heading", text: "Vertiefungskarte 2: Grenzen" },
    { kind: "paragraph", text: "Quelle: Originalquelle" },
  ]);
  expect(cards.map((c) => c.title)).toEqual([
    "",
    "Karte 7: Messwert",
    "Vertiefungskarte 2: Grenzen",
  ]);
  expect(cards[1].text).toBe("12,5 °C; 0,25 L.");
  expect(cards[2].group).toBe("extension");
  expect(cards[2].source).toBe("Originalquelle");
});
test("Hinzufügen ist atomar, erhält Hilfen und Medien und nutzt bestehende Versionierung", () => {
  const before = canonical(base);
  const next = takeImportedCards(
    base,
    [
      {
        id: 99,
        title: "Neue Karte",
        text: "Unveränderter Importtext",
        group: "required",
      },
    ],
    "append",
    "ignored",
  );
  expect(next.content.id).toBe(base.content.id);
  expect(next.content.version).not.toBe(base.content.version);
  expect(next.content.cards.at(-1)?.id).toBe(13);
  expect(next.content.help).toEqual(base.content.help);
  expect(next.content.cards.slice(0, 12)).toEqual(base.content.cards);
  expect(canonical(base)).toBe(before);
});
test("Neues Mystery erhält eigene Identität; ungültige Übernahme verändert den alten Entwurf nie", () => {
  const before = canonical(base),
    next = takeImportedCards(
      base,
      [{ id: 9, title: "Titel", text: "Text", group: "extension" }],
      "new",
      "Neues Mystery",
    );
  expect(next.content.id).not.toBe(base.content.id);
  expect(next.content.cards[0].id).toBe(1);
  expect(next.content.help).toBeUndefined();
  expect(next.author.hiddenCards).toEqual([]);
  expect(() =>
    takeImportedCards(
      base,
      [{ id: 1, title: "x", text: "x".repeat(4001), group: "required" }],
      "append",
      "",
    ),
  ).toThrow(/teilen/);
  expect(canonical(base)).toBe(before);
});
test("Leere Auswahl und 100-Karten-Grenze bleiben überprüft", () => {
  expect(() => takeImportedCards(newDraft("DI"), [], "append", "")).toThrow(
    /mindestens/,
  );
  expect(() =>
    takeImportedCards(
      base,
      Array.from({ length: 89 }, (_, id) => ({
        id,
        title: "",
        text: "x",
        group: "required",
      })),
      "append",
      "",
    ),
  ).toThrow(/100/);
});
test("Zusammenfügen erhält Text, Quellen und passende Tabellen ohne stilles Verwerfen anderer Medien", () => {
  const a = {
    id: 1,
    title: "A",
    text: "Text A",
    group: "required",
    source: "Quelle A",
    table: { headers: ["Wert"], rows: [["1,5"]] },
  };
  const b = {
    id: 2,
    title: "B",
    text: "Text B",
    group: "extension",
    source: "Quelle B",
    table: { headers: ["Wert"], rows: [["2,5"]] },
  };
  const next = mergeImported(a, b);
  expect(next.text).toBe("Text A\n\nB\n\nText B");
  expect(next.table?.rows).toEqual([["1,5"], ["2,5"]]);
  expect(next.source).toBe("Quelle A\nQuelle B");
  expect(() =>
    mergeImported({ ...a, image: "first" }, { ...b, image: "second" }),
  ).toThrow(/kein Bild verworfen/);
});

test("Fachbegriffe werden nicht als Vertiefungskennzeichnung interpretiert", () => {
  const c = proposeCards([
    { kind: "heading", text: "Vertiefung des Meeresbodens" },
    { kind: "paragraph", text: "Originaltext" },
  ]);
  expect(c[0].group).toBe("required");
});
