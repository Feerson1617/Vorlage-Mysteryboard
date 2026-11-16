import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  inspectScan,
  pixelSegments,
  ocrItems,
  ocrCard,
  SCAN_LIMITS,
  checkOcrBudget,
} from "../src/core/document-import/scan";
import { framedRegions } from "../src/core/document-import/pdf-layout";
import { checkImportFile } from "../src/core/document-import/model";
import type { OcrData } from "../src/core/document-import/ocr";
test("Fotoformat und Auflösungsgrenzen werden vor dem Decoder geprüft", () => {
  expect(checkImportFile("Foto.JPG", 100)).toBe("image");
  expect(checkImportFile("Scan.webp", 100)).toBe("image");
  expect(() => checkImportFile("IMG.HEIC", 100)).toThrow(/HEIC/);
  expect(
    inspectScan(readFileSync("tests/fixtures/ocr/Machbarkeit.png")),
  ).toMatchObject({ width: 1500, height: 1800, mime: "image/png" });
  expect(
    inspectScan(readFileSync("tests/fixtures/ocr/Gerades-Foto.jpg")).mime,
  ).toBe("image/jpeg");
  for (const bytes of [
    new Uint8Array(100),
    new Uint8Array(SCAN_LIMITS.bytes + 1),
    readFileSync("tests/fixtures/ocr/Machbarkeit.png").subarray(0, 100),
  ])
    expect(() => inspectScan(bytes)).toThrow();
});
test("Pixelrahmen werden räumlich erkannt, leere Felder erzeugen keine Karte", () => {
  const w = 600,
    h = 500,
    data = new Uint8ClampedArray(w * h * 4).fill(255);
  const dot = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
  };
  for (const x of [20, 300, 580])
    for (let y = 20; y <= 480; y++) for (let t = 0; t < 3; t++) dot(x + t, y);
  for (const y of [20, 250, 480])
    for (let x = 20; x <= 580; x++) for (let t = 0; t < 3; t++) dot(x, y + t);
  for (const [x, y] of [
    [50, 50],
    [330, 50],
    [50, 280],
  ])
    for (let row = 0; row < 20; row++)
      for (let k = 0; k < 12; k++) dot(x + k, y + row);
  const result = pixelSegments(data, w, h);
  expect(
    framedRegions(result.segments, { width: w, height: h, items: result.ink }),
  ).toHaveLength(3);
});
test("OCR-Zwischenwerte erhalten Zahlen, Quellen, Absätze und Wortpositionen unverändert", () => {
  const data: OcrData = {
    confidence: 84,
    text: "Karte J\n\n1912: 1,5 °C\n\n2,1 mg/l\nQuelle: Müller.",
    blocks: [
      {
        paragraphs: [
          {
            lines: [
              {
                text: "Karte J",
                bbox: { x0: 4, y0: 5, x1: 80, y1: 25 },
                words: [
                  {
                    text: "Karte",
                    confidence: 60,
                    bbox: { x0: 4, y0: 5, x1: 60, y1: 25 },
                  },
                ],
              },
            ],
          },
          {
            lines: [
              {
                text: "1912: 1,5 °C",
                bbox: { x0: 4, y0: 40, x1: 150, y1: 60 },
                words: [],
              },
            ],
          },
          {
            lines: [
              {
                text: "2,1 mg/l",
                bbox: { x0: 4, y0: 80, x1: 150, y1: 100 },
                words: [],
              },
              {
                text: "Quelle: Müller.",
                bbox: { x0: 4, y0: 110, x1: 160, y1: 130 },
                words: [],
              },
            ],
          },
        ],
      },
    ],
  };
  expect(ocrCard(data, 17)).toEqual({
    id: 17,
    title: "Karte J",
    text: "1912: 1,5 °C\n\n2,1 mg/l",
    source: "Müller.",
    group: "required",
  });
  expect(ocrItems(data, 0.5, { x: 100, y: 200 })[0]).toMatchObject({
    text: "Karte",
    x: 102,
    y: 202.5,
    width: 28,
    height: 10,
  });
});

test("OCR-Budget gilt über alle Seiten; Fehler verändern keine vorhandenen Texte", () => {
  const item = {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      baseline: 10,
      text: "a".repeat(150000),
    },
    pages = [
      { width: 100, height: 100, items: [item] },
      { width: 100, height: 100, items: [] },
    ];
  expect(() =>
    checkOcrBudget(pages, 1, [{ ...item, text: "b".repeat(100001) }]),
  ).toThrow(/aufteilen/);
  expect(pages[1].items).toEqual([]);
  expect(pages[0].items[0]).toBe(item);
  expect(() =>
    checkOcrBudget(pages, 1, [{ ...item, text: "b".repeat(100000) }]),
  ).not.toThrow();
});

test("Drei Pixel breite getrennte Rahmen erzeugen genau vier überschneidungsfreie Bereiche", () => {
  const w = 600,
    h = 500,
    data = new Uint8ClampedArray(w * h * 4).fill(255),
    dot = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    };
  for (const x of [20, 310])
    for (const y of [20, 260]) {
      for (let t = 0; t < 3; t++) {
        for (let xx = x; xx <= x + 260; xx++) {
          dot(xx, y + t);
          dot(xx, y + 210 + t);
        }
        for (let yy = y; yy <= y + 210; yy++) {
          dot(x + t, yy);
          dot(x + 260 + t, yy);
        }
      }
      for (let yy = y + 25; yy < y + 45; yy++)
        for (let xx = x + 25; xx < x + 37; xx++) dot(xx, yy);
    }
  const p = pixelSegments(data, w, h),
    regions = framedRegions(p.segments, { width: w, height: h, items: p.ink });
  expect(regions).toHaveLength(4);
  for (let i = 0; i < regions.length; i++)
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i],
        b = regions[j];
      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      ).toBe(true);
    }
});
