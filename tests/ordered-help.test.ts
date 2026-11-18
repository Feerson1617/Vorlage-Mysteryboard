import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import five from "./fixtures/ordered-5.json";
import oldFive from "./fixtures/reusable-five.json";
import small from "../src/content/small.json";
import large from "../src/content/large.json";
import soil from "../src/content/boden-klasse11.json";
import { initialWork, validateMystery } from "../src/core/model";
import { orderedPositions } from "../src/core/start-layout";
import {
  DEFAULT_METHOD_HELP,
  helpForCard,
  numberTextColor,
} from "../src/core/help";
import { packWork, unpackWork } from "../src/core/codec";

describe("Rückwärtskompatible Startablage", () => {
  for (const data of [oldFive, small, large, soil])
    it(`erhält das explizite Bestandslayout ${data.id} vollständig`, () => {
      const m = validateMystery(data);
      expect(m.startLayout).toBeUndefined();
      expect(initialWork(m)).toEqual({
        schema: 1,
        mystery: data.id,
        version: data.version,
        ...data.initial,
      });
    });
  for (const count of [5, 12, 18, 60])
    it(`ordnet ${count} IDs numerisch, ohne Überdeckung und passend zum verfügbaren Format`, () => {
      const m = validateMystery(
        JSON.parse(
          readFileSync(`tests/fixtures/ordered-${count}.json`, "utf8"),
        ),
      );
      expect(m.startLayout).toEqual({ mode: "ordered" });
      const seed = initialWork(m),
        heights = new Map(seed.cards.map((c) => [c.id, 140 + (c.id % 3) * 80]));
      const before = structuredClone(seed);
      const columns = new Set<number>();
      for (const [width, height] of [
        [1024, 694],
        [768, 950],
        [600, 726],
        [320, 626],
      ]) {
        const cards = orderedPositions(
          seed.cards,
          heights,
          { width, height },
          320,
        );
        expect(cards.map((c) => c.id)).toEqual(
          Array.from({ length: count }, (_, i) => i + 1),
        );
        columns.add(cards.filter((c) => c.y === 0).length);
        for (let i = 0; i < cards.length; i++)
          for (let j = i + 1; j < cards.length; j++) {
            const a = cards[i],
              b = cards[j];
            expect(
              a.x + 300 + 320 <= b.x ||
                b.x + 300 + 320 <= a.x ||
                a.y + heights.get(a.id)! + 320 <= b.y ||
                b.y + heights.get(b.id)! + 320 <= a.y,
            ).toBe(true);
          }
      }
      expect(columns.size).toBeGreaterThan(1);
      expect(seed).toEqual(before);
      expect(seed.edges).toEqual([]);
      expect(seed.categories).toEqual(Array(6).fill(""));
      expect(seed.cards.every((c) => c.color === 0)).toBe(true);
    });
  it("akzeptiert eine ausdrücklich gewählte Spaltenzahl und weist widersprüchliche Metadaten zurück", () => {
    const m = validateMystery({
      ...five,
      startLayout: { mode: "ordered", columns: 2 },
    });
    const w = initialWork(m);
    expect(
      orderedPositions(
        w.cards,
        new Map(w.cards.map((c) => [c.id, 200])),
        { width: 1024, height: 700 },
        320,
        2,
      ).filter((c) => c.y === 0),
    ).toHaveLength(2);
    for (const startLayout of [
      { mode: "explicit" },
      { mode: "ordered", columns: 0 },
      { mode: "ordered", columns: 13 },
      { mode: "ordered", columns: 1.5 },
      { mode: "random" },
      { mode: "ordered", theme: true },
    ])
      expect(() => validateMystery({ ...five, startLayout })).toThrow(
        /Startablage/,
      );
    expect(() =>
      validateMystery({ ...small, startLayout: { mode: "ordered" } }),
    ).toThrow(/Pfeile/);
    expect(
      validateMystery({ ...oldFive, startLayout: { mode: "explicit" } })
        .initial,
    ).toEqual(oldFive.initial);
  });
});

describe("Freiwillige, rein visuelle Lernhilfe", () => {
  it("verwendet explizite unterschiedlich große Zuordnungen und lässt unmarkierte Karten frei", () => {
    const m = validateMystery(five);
    expect(m.help?.categories?.map((c) => c.cardIds.length)).toEqual([2, 1, 1]);
    expect(helpForCard(m, 4, true)?.id).toBe("a");
    expect(helpForCard(m, 3, true)).toBeUndefined();
    expect(helpForCard(m, 4, false)).toBeUndefined();
    expect(DEFAULT_METHOD_HELP).toContain("Beobachtung");
    expect(validateMystery(oldFive).help).toBeUndefined();
  });
  it("weist ungültige Farben, IDs, Kategorien und Zuordnungen zurück", () => {
    const original = structuredClone(five);
    const bad = [
      (m: typeof five) => {
        m.help.categories[0].color = "url(https://example.org)";
      },
      (m: typeof five) => {
        m.help.categories[0].color = "#abc";
      },
      (m: typeof five) => {
        m.help.categories[0].cardIds = [99];
      },
      (m: typeof five) => {
        m.help.categories[0].cardIds = [1, 1];
      },
      (m: typeof five) => {
        m.help.categories[1].cardIds = [1];
      },
      (m: typeof five) => {
        m.help.categories[1].id = "a";
      },
      (m: typeof five) => {
        m.help.categories[1].id = "__proto__";
      },
      (m: typeof five) => {
        m.help.categories[1].label = " ";
      },
      (m: typeof five) => {
        m.help.categories[1].label = m.help.categories[0].label;
      },
      (m: typeof five) => {
        m.help.categories[1].color = m.help.categories[0].color;
      },
      (m: typeof five) => {
        m.help.categories[1].cardIds = [];
      },
      (m: typeof five) => {
        m.help.categories = [];
      },
      (m: typeof five) => {
        m.help.method = "x".repeat(501);
      },
    ];
    for (const mutate of bad) {
      const m = structuredClone(original);
      mutate(m);
      expect(() => validateMystery(m)).toThrow(/Hilfe|Orientierung|methodisch/);
    }
    expect(() =>
      validateMystery({ ...five, help: { solution: "1→2" } }),
    ).toThrow(/Hilfetext/);
    expect(() =>
      validateMystery({
        ...five,
        help: { categories: Array(7).fill(five.help.categories[0]) },
      }),
    ).toThrow(/Hilfekategorien/);
    expect(five).toEqual(original);
  });
  it("wählt Schwarz oder Weiß mit mindestens 4,5:1 Kontrast", () => {
    for (const color of [
      "#2166ac",
      "#f5a623",
      "#287c43",
      "#000000",
      "#ffffff",
      "#777777",
      "#008888",
      "#ff0000",
      "#0000ff",
    ]) {
      const luminance = (hex: string) =>
        [1, 3, 5]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(color),
        b = luminance(numberTextColor(color));
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("ändert weder Work noch PNG-/QR-Binärformat durch Hinzufügen oder Abrufen von Hilfe", () => {
    const m = validateMystery(five),
      work = initialWork(m),
      before = packWork(work);
    for (const id of work.cards.map((c) => c.id)) helpForCard(m, id, true);
    const noHelp = validateMystery({ ...five, help: undefined });
    expect(packWork(work)).toEqual(before);
    expect(unpackWork(before, noHelp)).toEqual(work);
    expect(Object.keys(work).sort()).toEqual([
      "cards",
      "categories",
      "edges",
      "mystery",
      "schema",
      "version",
    ]);
  });
});

it("bewahrt die RC2-Unterrichtsartefakte unverändert", () => {
  const hashes: Record<string, string> = {
    "artifacts/MysteryBoard-Boden-Klasse11.html":
      "21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f",
    "artifacts/MysteryBoard-Boden-Klasse11-RC2.html":
      "21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f",
    "artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip":
      "42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0",
  };
  for (const [path, expected] of Object.entries(hashes))
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(
      expected,
    );
});
