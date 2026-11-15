import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  splitImported,
  mergeImported,
  canRejoinImported,
  type Card,
} from "../src/core/document-import/model";
const image =
  "data:image/png;base64," +
  readFileSync("tests/fixtures/document-import/bild-1.png").toString("base64");
const base: Card = {
  id: 1,
  title: "Original",
  text: "Material 1",
  group: "required",
  source: "Eigene technische Vorlage B1.",
};
const cases: [string, Card, number][] = [
  ["Wortzwischenraum", base, 8],
  ["mitten im Wort", base, 7],
  ["vor Absatz", { ...base, text: "Material 1\n\nZweiter Absatz." }, 10],
  ["im Absatzumbruch", { ...base, text: "Material 1\n\nZweiter Absatz." }, 11],
  ["nach Absatz", { ...base, text: "Material 1\n\nZweiter Absatz." }, 12],
  [
    "Bild und Bildbeschreibung",
    { ...base, image, imageAlt: "Originaldiagramm" },
    7,
  ],
  [
    "Tabelle mit Titel, Einheiten und Messwerten",
    {
      ...base,
      table: { caption: "Messung", headers: ["Masse (g)"], rows: [["3,50"]] },
    },
    7,
  ],
  [
    "V-Karte und mehrzeilige Quelle",
    { ...base, group: "extension", source: "Quelle A\n\nQuelle B\n" },
    7,
  ],
];
test.each(cases)(
  "Unmittelbarer Split/Merge erhält exakt alle Daten: %s",
  (_, original, at) => {
    const [left, right] = splitImported(original, at, 2);
    expect(left.text + right.text).toBe(original.text);
    expect(left.source).toBe(original.source);
    expect(right.source).toBe(original.source);
    expect(canRejoinImported(left, right)).toBe(true);
    expect(mergeImported(left, right)).toBe(original);
    expect(mergeImported(left, right)).toEqual(original);
  },
);
test("Unterschiedliche eigenständige Karten erhalten beide Überschriften, Quellen und Tabelleninformationen", () => {
  const a = {
    ...base,
    image,
    imageAlt: "Ansicht A",
    table: { caption: "Messung A", headers: ["Wert (g)"], rows: [["3,50"]] },
  };
  const b = {
    ...base,
    id: 2,
    title: "Zweite Karte",
    text: "Anderer Text",
    group: "extension",
    source: "Andere Quelle",
    image,
    imageAlt: "Ansicht B",
    table: { caption: "Messung B", headers: ["Wert (g)"], rows: [["4,25"]] },
  };
  expect(canRejoinImported(a, b)).toBe(false);
  const merged = mergeImported(a, b);
  expect(merged.title).toBe(a.title);
  expect(merged.text).toBe("Material 1\n\nZweite Karte\n\nAnderer Text");
  expect(merged.source).toBe("Eigene technische Vorlage B1.\nAndere Quelle");
  expect(merged.imageAlt).toBe("Ansicht A\nAnsicht B");
  expect(merged.table).toEqual({
    caption: "Messung A · Messung B",
    headers: ["Wert (g)"],
    rows: [["3,50"], ["4,25"]],
  });
  expect(mergeImported(a, { ...b, source: a.source }).source).toBe(a.source);
});
test("Verschachtelte Teilungen können ohne Änderung exakt zurückgesetzt werden", () => {
  const [left, right] = splitImported(base, 7, 2);
  const [innerLeft, innerRight] = splitImported(left, 3, 3);
  const rejoinedLeft = mergeImported(innerLeft, innerRight);
  expect(canRejoinImported(rejoinedLeft, right)).toBe(true);
  expect(mergeImported(rejoinedLeft, right)).toBe(base);
});
test("Änderungen an Teilstücken werden niemals durch eine alte Originalkopie überschrieben", () => {
  const card = { ...base, table: { headers: ["Wert"], rows: [["1,5"]] } };
  const [a, b] = splitImported(card, 7, 2);
  const edited = {
    ...b,
    text: "bewusst geändert",
    source: "Zusätzliche Quelle",
  };
  expect(canRejoinImported(a, edited)).toBe(false);
  expect(mergeImported(a, edited).text).toContain("bewusst geändert");
  expect(mergeImported(a, edited).source).toContain("Zusätzliche Quelle");
  a.table!.rows[0][0] = "9,5";
  expect(canRejoinImported(a, b)).toBe(false);
  expect(mergeImported(a, b).table?.rows[0][0]).toBe("9,5");
});
test("Eigenständige Karten mit identischen Texten werden nicht fälschlich als Teilstücke erkannt", () => {
  const a = { ...base, text: "Materia" },
    b = { ...base, id: 2, title: "", text: "l 1" };
  expect(canRejoinImported(a, b)).toBe(false);
  expect(mergeImported(a, b).text).toBe("Materia\n\nl 1");
  expect(mergeImported(a, b).source).toBe(base.source);
});
test("Nicht vereinbare Medien/Tabellen und überlange Beschreibungen werden ohne Datenverlust abgewiesen", () => {
  expect(() =>
    mergeImported(
      { ...base, image: "first" },
      { ...base, id: 2, image: "second" },
    ),
  ).toThrow(/kein Bild verworfen/);
  expect(() =>
    mergeImported(
      { ...base, table: { headers: ["A"], rows: [["1"]] } },
      { ...base, table: { headers: ["B"], rows: [["2"]] } },
    ),
  ).toThrow(/unterschiedliche Spalten/);
  expect(() =>
    mergeImported(
      { ...base, image, imageAlt: "A".repeat(200) },
      { ...base, image, imageAlt: "B".repeat(200) },
    ),
  ).toThrow(/nichts verworfen/);
});
