import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { layoutCard } from "../src/core/layout";
import { graphemeBreaks, printTextBreaks } from "../src/core/print-text";
import { overviewTiles } from "../src/core/print-tiles";

beforeAll(() => {
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        measureText: (text: string) => ({ width: [...text].length * 8 }),
      }),
    }),
  });
});
afterAll(() => vi.unstubAllGlobals());

it("setzt Wort- und Absatzgrenzen ohne Änderung von Leerraum oder Unicode", () => {
  const text = "  Äußerung 12,5\u00a0µm.\r\n\r\nVermutung ΔP → Pegel.  ";
  const { words, paragraphs } = printTextBreaks(text);
  expect(words.map((end, i) => text.slice(words[i - 1] ?? 0, end))).toEqual([
    "  Äußerung ",
    "12,5\u00a0µm.\r\n\r\n",
    "Vermutung ",
    "ΔP ",
    "→ ",
    "Pegel.  ",
  ]);
  expect(paragraphs).toEqual([text.indexOf("Vermutung")]);
  const token = "ä👩‍🔬😃";
  expect(graphemeBreaks(token, 0, token.length)).toEqual([2, 7, 9]);
  expect(printTextBreaks("\n".repeat(4000)).words).toEqual([4000]);
});

it("kennzeichnet Medien auch hinter sechs Zeilen und begrenzt extreme Titel", () => {
  const title = "Wasser".repeat(15) + "ΔÖ".repeat(5);
  const card = {
    id: 1,
    title,
    text: "Der lokale Wasserabfluss steigt. ".repeat(30),
    image: "data:image/png;base64,AQID",
    extraImages: [{ src: "data:image/png;base64,AQID" }],
    table: { headers: ["Pegel"], rows: [["15 cm"]] },
  };
  const view = layoutCard(card, "1", undefined, "preview");
  expect(card.title.length).toBe(100);
  expect(view.title).toHaveLength(3);
  expect(view.title.at(-1)).toMatch(/…$/);
  expect(view.titleExcerpt).toBe(true);
  expect(view.text).toHaveLength(6);
  expect(view.text.join(" ")).not.toContain("Tabelle");
  expect(view.media).toEqual(["Tabelle", "Bild", "Weitere Bilder"]);
  expect(view.mediaY).toBeGreaterThan(view.imageY + view.imageHeight);
  expect(view.excerptY).toBeGreaterThan(view.mediaY);
  expect(layoutCard(card).title.join("")).toBe(title);
});

it("ordnet auch weit verstreute Karten vollständigen, besetzten Ausschnitten zu", () => {
  const cards = [
    { id: 1, x: -95000, y: -300, width: 340, height: 340 },
    { id: 2, x: 0, y: 300, width: 340, height: 410 },
    { id: 3, x: 12, y: 350, width: 340, height: 310 },
    { id: 4, x: 95000, y: 4000, width: 340, height: 260 },
  ];
  const tiles = overviewTiles(
    cards,
    { x: -95000, y: -300, width: 191000, height: 4800 },
    1400,
    750,
  );
  expect(tiles).toHaveLength(3);
  for (const card of cards) {
    const tile = tiles.find((entry) => entry.cards.includes(card.id))!;
    expect(tile.x).toBeLessThanOrEqual(card.x);
    expect(tile.y).toBeLessThanOrEqual(card.y);
    expect(tile.x + tile.width).toBeGreaterThanOrEqual(card.x + card.width);
    expect(tile.y + tile.height).toBeGreaterThanOrEqual(card.y + card.height);
  }
});
