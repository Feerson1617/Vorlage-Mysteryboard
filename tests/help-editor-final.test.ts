import { describe, expect, test } from "vitest";
import { assignHelpCards, matchesHelpCard } from "../src/core/help-authoring";
import { readDocument } from "../src/core/documents";
import { readFileSync } from "node:fs";
const content = readDocument(
  readFileSync("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
).content;
describe("Gezielte Kartenwahl ohne automatische fachliche Zuordnung", () => {
  test("Suche nach exakter Nummer, Titel, V-Nummer und leerem Begriff", () => {
    const filter = (q: string) =>
      content.cards
        .filter((c) => matchesHelpCard(content, c, q))
        .map((c) => c.id);
    expect(filter("1")).toEqual([1]);
    expect(filter("  INFORMATION 12  ")).toEqual([12]);
    expect(filter("v12")).toEqual([12]);
    expect(filter("unbekannt")).toEqual([]);
    expect(filter(" ")).toHaveLength(12);
  });
  test("Mehrfachwechsel entfernt alte Zuordnung, erhält unsichtbare Karten und verhindert Duplikate", () => {
    const old = structuredClone(content.help!.categories!);
    const next = assignHelpCards(old, [1, 2, 2, 5], "group3");
    expect(next.map((g) => g.cardIds)).toEqual([[3], [], [4, 1, 2, 5]]);
    expect(old).toEqual(content.help!.categories);
    expect(assignHelpCards(next, [1], "").map((g) => g.cardIds)).toEqual([
      [3],
      [],
      [4, 2, 5],
    ]);
    expect(assignHelpCards(next, [1], "entfernte-gruppe")).toBe(next);
  });
});
