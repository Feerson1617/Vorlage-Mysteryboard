import { beforeAll, afterAll, expect, it, vi } from "vitest";
import {
  layoutCard,
  makeLayouts,
  overlappingTextCards,
} from "../src/core/layout";
import type { CardContent, Mystery, Work } from "../src/core/model";

beforeAll(() => {
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        measureText: (value: string) => ({
          width: Array.from(value).length * 8,
        }),
      }),
    }),
  });
});
afterAll(() => vi.unstubAllGlobals());

const base = { id: 1, title: "Kartenüberschrift", text: "" };

it("behält alle Titelzeilen und kennzeichnet erst Text jenseits von sechs Zeilen", () => {
  const title =
    "Beobachtungen und begründete Schlussfolgerungen zur Veränderung des Landschaftsbildes";
  const sixLines = Array.from({ length: 6 }, (_, i) => `Absatz ${i + 1}`);
  const preview = (text: string) =>
    layoutCard({ ...base, title, text }, "V1", undefined, "preview");
  expect(preview("").text).toEqual([]);
  expect(preview("Kurz").excerpt).toBe(false);
  expect(preview(sixLines.join("\n")).excerpt).toBe(false);
  const content = {
    ...base,
    title,
    text: [...sixLines, "Siebte Zeile"].join("\n"),
  };
  const compact = preview(content.text);
  expect(compact.text).toEqual(sixLines);
  expect(compact.excerpt).toBe(true);
  expect(compact.title.join(" ")).toBe(title);
  expect(layoutCard(content).text).toEqual([...sixLines, "Siebte Zeile"]);
});

it("bezieht sich bei Überlagerungen auf dieselben äußeren Maße wie die Pinnwand", () => {
  const long = {
    ...base,
    text: "Lange eigene Erklärung. ".repeat(170),
    studentEditable: true,
  } as const;
  const next = { ...base, id: 2 };
  const cards = [
    { id: 1, x: 0, y: 0, color: 0 },
    { id: 2, x: 0, y: 350, color: 0 },
  ];
  const seed = { cards, edges: [], categories: Array(6).fill("") };
  const mystery: Mystery = {
    id: "qa",
    title: "Übersicht",
    version: "1.0.0",
    cards: [long, next],
    initial: seed,
  };
  const work: Work = {
    ...seed,
    schema: 3,
    mystery: mystery.id,
    version: mystery.version,
    textEdits: [long],
  };
  expect(overlappingTextCards(work, makeLayouts(mystery))).toEqual([1, 2]);
  const compact = makeLayouts(mystery, "preview");
  expect(overlappingTextCards(work, compact)).toEqual([]);
  const moved = { ...work, cards: [cards[0], { ...cards[1], y: 100 }] };
  expect(overlappingTextCards(moved, compact)).toEqual([1, 2]);
  expect(work.cards).toEqual(cards);
});

it.each(["before-text", "after-text"] as const)(
  "lässt das Bild im Layout %s samt Legende stehen",
  (imagePosition) => {
    const card: CardContent = {
      ...base,
      text: "Langer Text zu einer Messreihe. ".repeat(100),
      image: "data:image/png;base64,AQID",
      imageCaption: "Messwerte und Einheiten",
      imagePosition,
      studentEditable: true,
    };
    const before = layoutCard(card);
    const view = layoutCard(card, "1", undefined, "preview");
    expect(view.excerpt).toBe(true);
    expect(view.imageHeight).toBe(before.imageHeight);
    expect(view.imageWidth).toBe(before.imageWidth);
    expect(
      view.imageY + view.imageHeight + 16 * view.caption.length,
    ).toBeLessThan(view.height);
    expect(view.caption).toEqual(before.caption);
    expect(view.height).toBeLessThan(before.height);
  },
);
