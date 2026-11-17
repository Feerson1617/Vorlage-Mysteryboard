import { describe, it, expect } from "vitest";
import {
  newDraft,
  reviseDraft,
  publishDraft,
  draftFromContent,
  retainCards,
} from "../src/core/authoring";
import {
  validateDocument,
  validateContent,
  encodeDocument,
  readDocument,
  contentHash,
  type Draft,
} from "../src/core/documents";
import { cardNumber } from "../src/core/model";
import { validateDesign } from "../src/core/design";
import sample from "../examples/universal/content.json";
import { readFileSync } from "node:fs";
const create = (): Draft => {
  const d = newDraft("ST");
  return reviseDraft(d, {
    ...d.content,
    title: "Unabhängige Gruppen",
    numbering: "by-group",
    cards: [
      { id: 1, title: "Karte J", text: "1912", group: "extension" },
      { id: 2, title: "Karte G", text: "1,5 °C", group: "required" },
      { id: 3, title: "Karte C", text: "2,1 mg/l", group: "extension" },
      { id: 4, title: "Karte A", text: "Öl und Grüße", group: "required" },
    ],
    initial: {
      cards: [1, 2, 3, 4].map((id, i) => ({ id, x: i * 480, y: 0, color: 0 })),
      edges: [],
      categories: Array(6).fill(""),
    },
  });
};
describe("Studio: ein Format, getrennte Nummern und sichere Veröffentlichung", () => {
  it("nummeriert Pflicht-/V-Karten ohne Originaltitel oder IDs zu überschreiben", () => {
    const d = create();
    expect(d.content.cards.map((c) => cardNumber(d.content, c.id))).toEqual([
      "V1",
      "1",
      "V2",
      "2",
    ]);
    expect(d.content.cards.map((c) => c.title)).toEqual([
      "Karte J",
      "Karte G",
      "Karte C",
      "Karte A",
    ]);
    expect(d.content.cards.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });
  it("ordnet sichtbare Nummern neu und hält Hilfereferenzen an denselben IDs", () => {
    const d = create();
    d.content.help = {
      categories: [
        { id: "c", label: "Klima", color: "#115522", cardIds: [1, 4] },
      ],
    };
    d.contentHash = contentHash(d.content);
    const next = reviseDraft(d, {
      ...d.content,
      cards: [
        d.content.cards[2],
        d.content.cards[3],
        d.content.cards[0],
        d.content.cards[1],
      ],
    });
    expect(next.content.cards.map((c) => c.id)).toEqual([3, 4, 1, 2]);
    expect(
      next.content.cards.map((c) => cardNumber(next.content, c.id)),
    ).toEqual(["V1", "1", "V2", "2"]);
    expect(next.content.help!.categories![0].cardIds).toEqual([1, 4]);
    const task = publishDraft(next);
    expect(task.content.cards.map((c) => c.title)).toEqual([
      "Karte C",
      "Karte A",
      "Karte J",
      "Karte G",
    ]);
    expect(task.content.help!.categories![0].cardIds).toEqual([3, 2]);
  });
  it("hält Autorenpositionen und versteckte Karten vollständig aus Schüleraufgaben heraus", () => {
    const d = create();
    d.author.hiddenCards = [2];
    d.author.board = [{ id: 1, x: 770, y: 360, color: 0 }];
    const restored = readDocument(encodeDocument(d)) as Draft;
    expect(restored.author.board).toEqual(d.author.board);
    const task = publishDraft(restored);
    expect("author" in task).toBe(false);
    expect(task.content.cards.some((c) => c.title === "Karte G")).toBe(false);
    expect(task.content.initial.edges).toEqual([]);
    expect(task.content.initial.cards.every((c) => c.color === 0)).toBe(true);
    expect(
      task.content.initial.cards.some((c) => c.x === 770 && c.y === 360),
    ).toBe(false);
  });
  it("verwirft widersprüchliche Autorenpositionen und lässt das Eingabeobjekt unverändert", () => {
    const d = create();
    d.author.board = [{ id: 99, x: 0, y: 0, color: 0 }];
    const before = structuredClone(d);
    expect(() => validateDocument(d)).toThrow();
    expect(d).toEqual(before);
  });
  it("bewahrt optionale Gestaltung, Quellen, Bildunterschriften und weitere Originalbilder", () => {
    const d = create();
    const src = JSON.parse(
      readFileSync(
        "examples/universal/unterricht-entwurf.mysteryboard",
        "utf8",
      ),
    ).content.cards[0].image as string;
    const next = reviseDraft(d, {
      ...d.content,
      design: {
        font: "serif",
        fontSize: 20,
        cardColor: "#faf0da",
        edgeColor: "#123456",
        edgeWidth: 4,
        edgeDash: true,
        arrowHead: "open",
      },
      cards: d.content.cards.map((c, i) =>
        i
          ? c
          : {
              ...c,
              image: src,
              imageAlt: "Original",
              imageCaption: "Achse und Einheit bleiben erhalten",
              source: "Originalquelle",
              extraImages: [
                {
                  src,
                  alt: "Legende",
                  caption: "Zweites Diagramm",
                  source: "Zweite Quelle",
                },
              ],
            },
      ),
    });
    const restored = readDocument(encodeDocument(next)) as Draft;
    expect(restored.content.design).toEqual(next.content.design);
    expect(restored.content.cards[0]).toEqual(next.content.cards[0]);
    expect(publishDraft(restored).content.cards[0].extraImages).toEqual(
      next.content.cards[0].extraImages,
    );
  });
  it("prüft CSS-Werte, zusätzliche Bilder und Größenbegrenzungen als Daten", () => {
    for (const design of [
      { background: "url(https://invalid)" },
      { fontSize: 100 },
      { direction: 9 },
      { edgeColor: "#fff" },
      { unknown: "value" },
    ])
      expect(() => validateDesign(design)).toThrow();
    const d = create();
    const bad = structuredClone(d.content);
    bad.cards[0].extraImages = [{ src: "https://example.invalid/image.png" }];
    expect(() => validateContent(bad, true)).toThrow();
  });
  it("behält die bisherige sichtbare Nummerierung und liest bestehende v3-Dateien unverändert", () => {
    const old = readDocument(
      new Uint8Array(
        readFileSync("examples/universal/unterricht-entwurf.mysteryboard"),
      ),
    ) as Draft;
    for (const c of old.content.cards)
      expect(cardNumber(old.content, c.id)).toBe(
        (old.content.cardGroups?.[c.group ?? ""]?.prefix ?? "") + c.id,
      );
    expect(readDocument(encodeDocument(old))).toEqual(old);
  });
  it("referenziert nach Entfernen geordnet dieselben verbleibenden fachlichen Karten", () => {
    const d = create();
    d.content.help = {
      categories: [
        { id: "c", label: "Begründung", color: "#123456", cardIds: [1, 3] },
      ],
    };
    const content = retainCards(d.content, [3, 4]);
    expect(content.cards.map((c) => c.title)).toEqual(["Karte C", "Karte A"]);
    expect(content.help!.categories![0].cardIds).toEqual([1]);
    expect(content.cards.map((c) => cardNumber(content, c.id))).toEqual([
      "V1",
      "1",
    ]);
  });
});

describe("Studio: Mehrfachmedien ohne Verlust", () => {
  it("behält mehrere Originalbilder in derselben erkannten Karte und beim Zusammenführen", async () => {
    const { proposeCards, mergeImported } =
      await import("../src/core/document-import/model");
    const image = JSON.parse(
      readFileSync(
        "examples/universal/unterricht-entwurf.mysteryboard",
        "utf8",
      ),
    ).content.cards[0].image as string;
    const cards = proposeCards(
      [
        { kind: "heading", text: "Karte J" },
        { kind: "paragraph", text: "Originaler Kartentext" },
        { kind: "image", text: "", image, imageAlt: "Achse 1" },
        { kind: "image", text: "", image, imageAlt: "Legende 2" },
      ],
      true,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Karte J");
    expect(cards[0].extraImages).toEqual([{ src: image, alt: "Legende 2" }]);
    const merged = mergeImported(
      { ...cards[0], extraImages: undefined },
      {
        id: 2,
        title: "Zweite Quelle",
        text: "1912",
        group: "required",
        image,
        imageAlt: "Achse 3",
      },
      true,
    );
    expect(merged.image).toBe(image);
    expect(merged.extraImages?.[0].src).toBe(image);
    expect(merged.extraImages?.[0].alt).toBe("Achse 3");
  });
  it("lässt bei zu vielen Bildern beide Eingabekarten unverändert", async () => {
    const { mergeImported } = await import("../src/core/document-import/model");
    const a = {
        id: 1,
        title: "A",
        text: "Text",
        group: "required",
        image: "data:image/png;base64,AA==",
        extraImages: [
          { src: "data:image/png;base64,AQ==" },
          { src: "data:image/png;base64,Ag==" },
          { src: "data:image/png;base64,Aw==" },
        ],
      },
      b = {
        id: 2,
        title: "B",
        text: "Mehr",
        group: "required",
        image: "data:image/png;base64,BA==",
      };
    const original = structuredClone([a, b]);
    expect(() => mergeImported(a, b, true)).toThrow("vier Bilder");
    expect([a, b]).toEqual(original);
  });
  it("behält die Studio-Gruppennummerierung beim neuen Mystery aus einem Import", async () => {
    const { takeImportedCards } =
      await import("../src/core/document-import/model");
    const d = create(),
      next = takeImportedCards(
        d,
        d.content.cards,
        "new",
        "Neues Papier-Mystery",
      );
    expect(next.content.numbering).toBe("by-group");
    expect(
      next.content.cards.map((c) => cardNumber(next.content, c.id)),
    ).toEqual(["V1", "1", "V2", "2"]);
  });
});
