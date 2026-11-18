import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import soil from "../src/content/boden-klasse11.json";
import rc1 from "./fixtures/release/rc1-initial.json";
import { initialWork, validateMystery } from "../src/core/model";
import { restorePng } from "../src/core/png";

describe("RC2-Anordnung und Kompatibilität", () => {
  const mystery = validateMystery(soil);
  it("mischt Pflicht- und V-Karten in jeder Reihe und Spalte ohne Vorlösungen", () => {
    const extension = new Set(
      mystery.cards.filter((c) => c.group === "extension").map((c) => c.id),
    );
    for (let row = 0; row < 3; row++) {
      const cards = mystery.initial.cards.filter((c) => c.y === row * 500);
      expect(cards).toHaveLength(6);
      expect(cards.filter((c) => extension.has(c.id))).toHaveLength(2);
    }
    for (let column = 0; column < 6; column++) {
      const cards = mystery.initial.cards.filter((c) => c.x === column * 480);
      expect(cards).toHaveLength(3);
      expect(cards.filter((c) => extension.has(c.id))).toHaveLength(1);
    }
    expect(mystery.initial.edges).toEqual([]);
    expect(mystery.initial.categories).toEqual(Array(6).fill(""));
    expect(mystery.initial.cards.every((c) => c.color === 0)).toBe(true);
  });
  it("importiert eine echte RC1-PNG mit alten Positionen statt der neuen Startanordnung", () => {
    const saved = restorePng(
      readFileSync("tests/fixtures/release/rc1-original.png"),
      mystery,
    );
    expect(saved.team).toBe("RC1 – Prüfgruppe ÄÖÜ");
    expect(saved.cards).toEqual(
      rc1.cards.map((c) => ({ ...c, color: c.id === 13 ? 2 : c.color })),
    );
    expect(saved.cards).not.toEqual(initialWork(mystery).cards);
    expect(saved.edges).toEqual([]);
    expect(saved.categories).toEqual(rc1.categories);
  });
});
