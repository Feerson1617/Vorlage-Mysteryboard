import { describe, it, expect } from "vitest";
import {
  analyzePdf,
  changeRegions,
  framedRegions,
  headingRegions,
  paintedSegments,
  pdfItems,
  regionCard,
  textBlocks,
  type PdfPage,
  type PdfItem,
  type Segment,
} from "../src/core/document-import/pdf-layout";
const item = (
  text: string,
  x: number,
  y: number,
  width = 100,
  height = 12,
): PdfItem => ({ text, x, y, width, height, baseline: y + height });
const page = (items: PdfItem[]): PdfPage => ({
  width: 600,
  height: 840,
  items,
});
const line = (x1: number, y1: number, x2: number, y2: number): Segment => ({
  x1,
  y1,
  x2,
  y2,
});
function grid(cols: number, rows: number): Segment[] {
  return [
    ...Array.from({ length: cols + 1 }, (_, x) =>
      line(40 + x * 160, 80, 40 + x * 160, 80 + rows * 120),
    ),
    ...Array.from({ length: rows + 1 }, (_, y) =>
      line(40, 80 + y * 120, 40 + cols * 160, 80 + y * 120),
    ),
  ];
}
describe("Räumliche PDF-Karten vor jeder Textverknüpfung", () => {
  it("interpretiert einen Zahlenanfang innerhalb einer Rahmenkarte nicht als neue Überschrift", () => {
    const result = analyzePdf(
      [
        page([
          item("Erster Absatz.", 50, 90),
          item("Absatz in Feld", 50, 130),
          item("2: ein Messwert.", 50, 146),
        ]),
      ],
      [grid(1, 1)],
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].title).toBe("");
    expect(result.cards[0].text).toBe(
      "Erster Absatz.\n\nAbsatz in Feld 2: ein Messwert.",
    );
  });
  it("erhält den bisherigen Spaltenfluss explizit beschrifteter Rahmenkarten ohne Labels zu sortieren", () => {
    const p = page([
      item("Karte 1", 50, 90),
      item("Text eins.", 50, 110),
      item("Karte 3", 210, 90),
      item("Text drei.", 210, 110),
      item("Karte 2", 50, 210),
      item("Text zwei.", 50, 230),
      item("Karte 4", 210, 210),
      item("Text vier.", 210, 230),
    ]);
    expect(analyzePdf([p], [grid(2, 2)]).cards.map((c) => c.title)).toEqual([
      "Karte 1",
      "Karte 2",
      "Karte 3",
      "Karte 4",
    ]);
  });
  it("hält Zellabsätze zusammen, schließt leere Zellen aus und erhält Dokumentabschnitte", () => {
    const p = page([
      item("Unterrichtsblatt", 40, 20),
      item("Welche Beobachtung passt?", 40, 45, 260),
      item("Erster Absatz.", 50, 90),
      item("Zweiter Absatz.", 50, 130),
      item("Andere Zelle.", 210, 90),
      item("Arbeitsauftrag: vergleichen.", 40, 350, 250),
    ]);
    const result = analyzePdf([p], [grid(3, 2)]);
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].text).toBe("Erster Absatz.\n\nZweiter Absatz.");
    expect(result.cards[1].text).toBe("Andere Zelle.");
    expect(result.layout.sections.map((b) => b.text).join(" ")).toContain(
      "Arbeitsauftrag: vergleichen.",
    );
    expect(result.cards.map((c) => c.text).join(" ")).not.toContain(
      "Unterrichtsblatt",
    );
  });
  it("erkennt geteilte, doppelte und leicht unterbrochene gemeinsame Zellrahmen", () => {
    const segments = grid(3, 5).flatMap((s) =>
      Math.abs(s.y1 - s.y2) < 1
        ? [
            line(s.x1, s.y1, (s.x1 + s.x2) / 2 - 1, s.y1),
            line((s.x1 + s.x2) / 2 + 1, s.y1, s.x2, s.y2),
          ]
        : [s, s],
    );
    const p = page(
      Array.from({ length: 15 }, (_, i) =>
        item(
          `Zelle ${i + 1}`,
          50 + (i % 3) * 160,
          90 + Math.floor(i / 3) * 120,
        ),
      ),
    );
    expect(framedRegions(segments, p)).toHaveLength(15);
  });
  it("ignoriert reine Beschneidungspfade und erkennt dünne gefüllte Rahmenstreifen", () => {
    const path = new Float32Array([
      0, 40, 80, 1, 200, 80, 1, 200, 81, 1, 40, 81, 4,
    ]);
    expect(
      paintedSegments(
        { fnArray: [91], argsArray: [[28, [path], [40, 80, 200, 81]]] },
        [1, 0, 0, 1, 0, 0],
      ),
    ).toEqual([]);
    expect(
      paintedSegments(
        { fnArray: [91], argsArray: [[23, [path], [40, 80, 200, 81]]] },
        [1, 0, 0, 1, 0, 0],
      ),
    ).toEqual([line(40, 80.5, 200, 80.5)]);
  });
  it("wendet PDF-Transformationsstapel an und begrenzt Vektoraufwand", () => {
    const path = new Float32Array([0, 0, 0, 1, 100, 0]);
    const ops = {
      fnArray: [10, 12, 91, 11, 91],
      argsArray: [
        null,
        [2, 0, 0, 2, 20, 30],
        [20, [path], [0, 0, 100, 0]],
        null,
        [20, [path], [0, 0, 100, 0]],
      ],
    };
    expect(paintedSegments(ops, [1, 0, 0, -1, 0, 800])).toEqual([
      line(20, 770, 220, 770),
      line(0, 800, 100, 800),
    ]);
    expect(
      paintedSegments(
        { fnArray: Array(100_001).fill(91), argsArray: [] },
        [1, 0, 0, 1, 0, 0],
      ),
    ).toEqual([]);
  });
  it("hält zwei Buchstabenkarten pro Zeile getrennt und erhält visuelle Reihenfolge", () => {
    const order = [
      "J",
      "G",
      "C",
      "D",
      "E",
      "F",
      "B",
      "H",
      "I",
      "A",
      "K",
      "L",
      "P",
      "N",
      "O",
      "M",
    ];
    const p = page(
      order.flatMap((label, i) => [
        item(
          `Karte ${label}`,
          140 + (i % 2) * 280,
          50 + Math.floor(i / 2) * 85,
          42,
        ),
        item(
          `Originaltext ${label} ä 3,50 g.`,
          60 + (i % 2) * 280,
          70 + Math.floor(i / 2) * 85,
          200,
        ),
      ]),
    );
    const result = analyzePdf([p], [[]]);
    expect(result.cards.map((c) => c.title)).toEqual(
      order.map((c) => `Karte ${c}`),
    );
    expect(result.cards.map((c) => c.text)).toEqual(
      order.map((c) => `Originaltext ${c} ä 3,50 g.`),
    );
  });
  it("sucht die Spaltengrenze im Textzwischenraum, nicht durch die linke Kartenhälfte", () => {
    const p = page([
      item("Karte 1: Material", 40, 40, 130),
      item("Karte 2: Material", 320, 40, 130),
      item("Links vollständig bis zum Rand", 40, 60, 250),
      item("Rechts vollständig", 320, 60, 230),
    ]);
    const regions = headingRegions(p);
    expect(regions).toHaveLength(2);
    expect(regions[0].x + regions[0].width).toBeGreaterThan(290);
    expect(analyzePdf([p], [[]]).cards.map((c) => c.text)).toEqual([
      "Links vollständig bis zum Rand",
      "Rechts vollständig",
    ]);
  });
  it("bewahrt eine Fortsetzung ohne neue Überschrift über zwei Seiten und kennzeichnet Unsicherheit", () => {
    const result = analyzePdf(
      [
        page([item("Karte 1", 50, 40), item("Erster Teil: 12,5 °C.", 50, 60)]),
        page([item("Fortsetzung: 3,50 g.", 50, 40)]),
      ],
      [[], []],
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].text).toBe(
      "Erster Teil: 12,5 °C.\n\nFortsetzung: 3,50 g.",
    );
    expect(result.layout.uncertainPages).toEqual([2]);
  });
  it("ordnet führenden Fortsetzungstext auf einer Folgeseite vor der nächsten Karte der bisherigen Karte zu", () => {
    const result = analyzePdf(
      [
        page([item("Karte 1", 50, 40), item("Erster Teil.", 50, 60)]),
        page([
          item("Fortsetzung: 3,50 g.", 50, 40),
          item("Vertiefungskarte 2", 50, 100),
          item("Neue Beobachtung.", 50, 120),
        ]),
      ],
      [[], []],
    );
    expect(result.cards.map((c) => c.title)).toEqual([
      "Karte 1",
      "Vertiefungskarte 2",
    ]);
    expect(result.cards[0].text).toBe("Erster Teil.\n\nFortsetzung: 3,50 g.");
    expect(result.cards[1].text).toBe("Neue Beobachtung.");
    expect(result.layout.uncertainPages).toEqual([2]);
  });
  it("erhält eine unsichere Fortsetzung über mehr als zwei Seiten", () => {
    const result = analyzePdf(
      [
        page([item("Karte 1", 50, 40), item("Anfang.", 50, 60)]),
        page([item("Mitte.", 50, 40)]),
        page([item("Ende.", 50, 40)]),
      ],
      [[], [], []],
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].text).toBe("Anfang.\n\nMitte.\n\nEnde.");
  });
  it("kennzeichnet räumliche Vorschläge ohne Rahmen oder Überschrift ausdrücklich als unsicher", () => {
    const result = analyzePdf(
      [
        page([
          item("Oben links.", 40, 40),
          item("Oben rechts.", 340, 40),
          item("Weiter links.", 40, 57),
          item("Weiter rechts.", 340, 57),
        ]),
      ],
      [[]],
    );
    expect(result.cards).toHaveLength(2);
    expect(result.layout.uncertainPages).toEqual([1]);
    expect(result.cards[0].text).toBe("Oben links. Weiter links.");
    expect(result.cards[1].text).toBe("Oben rechts. Weiter rechts.");
  });
  it("übernimmt jeden Textbestandteil genau einmal und liest manuelle Grenzen neu", () => {
    const result = analyzePdf(
        [page([item("Teil A.", 50, 90), item("Teil B.", 50, 150)])],
        [grid(1, 1)],
      ),
      r = result.layout.regions[0];
    const next = changeRegions(result.layout, [
      { ...r, bounds: { ...r.bounds, height: 55 } },
      {
        ...r,
        id: 2,
        cardId: 2,
        bounds: { ...r.bounds, y: 135, height: 65 },
        strategy: "manual",
      },
    ]);
    expect(regionCard(next, 1).text).toBe("Teil A.");
    expect(regionCard(next, 2).text).toBe("Teil B.");
    expect(next.sections).toEqual([]);
    expect(() =>
      changeRegions(next, [...next.regions, { ...r, id: 3, cardId: 3 }]),
    ).toThrow("doppelt");
    expect(() =>
      changeRegions(next, [
        { ...r, bounds: { x: -1, y: 0, width: 40, height: 40 } },
      ]),
    ).toThrow("gültigen");
  });
  it("behält Satzzeichen, hochgestellte Zeichen, Einheiten und echte Absatzabstände", () => {
    const blocks = textBlocks(
      [
        item("CO", 40, 40, 17),
        item("2", 57, 36, 4, 8),
        item(" 3,50 g; Öl.", 61, 40, 70),
        item("Zweiter Absatz!", 40, 85, 110),
      ],
      1,
    );
    expect(blocks.map((b) => b.text)).toEqual([
      "CO2 3,50 g; Öl.",
      "Zweiter Absatz!",
    ]);
  });
  it("verarbeitet eine Seite ohne Textebene ohne erfundene Karten", () => {
    expect(analyzePdf([page([])], [grid(3, 5)]).cards).toEqual([]);
  });
  it("normalisiert Textpositionen im gedrehten Viewport und entfernt identische Doppelzeichnungen", () => {
    const raw = {
      str: "Ä",
      width: 10,
      height: 12,
      transform: [12, 0, 0, 12, 40, 750],
    };
    const a = pdfItems([raw, raw], [1, 0, 0, -1, 0, 840]);
    expect(a).toHaveLength(1);
    expect(a[0].x).toBe(40);
    expect(a[0].y).toBe(78);
  });
});
