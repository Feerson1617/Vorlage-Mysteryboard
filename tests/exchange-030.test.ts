import { expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { importExchange, parseExchangeText } from "../studio/exchange/import";
import { templateText } from "../studio/exchange/template";
import { publishDraft } from "../src/core/authoring";
import { contentHash, validateDocument } from "../src/core/documents";
import { validateCollection } from "../src/core/levels";

const directory = mkdtempSync(join(tmpdir(), "studio-exchange-"));
const fixtures = (() => {
  try {
    execFileSync("python3", ["qa/studio/exchange-fixtures-030.py", directory]);
    return ["Einzel", "Niveaus"].map((n) =>
      JSON.parse(
        readFileSync(
          join(directory, "KI-" + n + "-Austausch.mysteryboard"),
          "utf8",
        ),
      ),
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
})();
const [single, collection] = fixtures;
it("validates external content and recalculates stable IDs and regular hashes", () => {
  const draft = importExchange(single);
  if (draft.format !== "MysteryBoard") throw Error("single");
  expect(importExchange(parseExchangeText(JSON.stringify(single)))).toEqual(
    draft,
  );
  expect(draft.contentHash).toBe(contentHash(draft.content));
  expect(validateDocument(draft)).toEqual(draft);
  expect(draft.content.cards[2].studentEditable).toBe(true);
  expect(draft.content.help?.categories).toBeUndefined();
  expect(draft.author.status).toBe("in-progress");
  const result = importExchange(collection);
  if (result.format !== "MysteryBoardCollection") throw Error("collection");
  expect(validateCollection(result)).toEqual(result);
  expect(result.levels.map((l) => l.usesDefault)).toEqual([
    false,
    true,
    true,
    false,
  ]);
  expect(result.levels.map((l) => l.draft.content.recovery)).toEqual([
    "off",
    "session",
    "session",
    "extended",
  ]);
  for (const [i, l] of result.levels.entries()) {
    expect(l.draft.content.cards).toEqual(
      collection.project.levels[i].content.cards,
    );
    expect(l.draft.content.help).toEqual(
      collection.project.levels[i].content.help,
    );
    const task = publishDraft(l.draft);
    if (i >= 2) {
      expect(l.draft.author.edges?.[0].label).toBe("Privatbefund-QA");
      expect(JSON.stringify(task)).not.toContain("Privatbefund-QA");
      expect(task.content.initial.edges[0].label).toBe("Messung zuordnen");
    }
  }
});
it("gives external assistants usable examples and refuses the blank", () => {
  const blank = JSON.parse(templateText());
  expect(blank.studioVersion).toBe("0.3.2");
  expect(() => importExchange(blank)).toThrow(/leere KI/);
  for (const sample of blank.beispieleNurZurOrientierung)
    expect(() => importExchange(sample)).not.toThrow();
  expect(() => importExchange(blank.ausfuellgeruest)).toThrow();
  expect(() => parseExchangeText("{")).toThrow(/JSON/);
});
const invalid: Record<string, (v: any) => void> = {
  future: (v: any) => v.formatVersion++,
  wrongKind: (v: any) => (v.kind = "student"),
  unknown: (v: any) => (v.project.levels[1].content.cards[0].remote = "bad"),
  missing: (v: any) => delete v.project.levels[0].content.title,
  duplicate: (v: any) => (v.project.levels[1].name = " ENTDECKEN "),
  wrongRef: (v: any) => (v.project.levels[2].studentHints[0].to = 99),
  overlap: (v: any) => (v.project.levels[2].author.edges[0].from = 1),
  hidden: (v: any) => (v.project.levels[2].author.hiddenCards = [1]),
  remote: (v: any) =>
    (v.project.levels[2].content.cards[0].image =
      "https://example.invalid/media"),
  malformedMedia: (v: any) =>
    (v.project.levels[2].content.cards[0].image = "data:image/png;base64,AAAA"),
  missingImage: (v: any) => delete v.project.levels[2].content.cards[0].image,
  category: (v: any) =>
    (v.project.levels[2].content.help.categories[0].cardIds = [99]),
  table: (v: any) =>
    (v.project.levels[0].content.cards[1].table.rows = [["A"]]),
  position: (v: any) => (v.project.levels[0].startPositions = []),
};
for (const [name, change] of Object.entries(invalid)) {
  it("rejects " + name, () => {
    const v = structuredClone(collection);
    change(v);
    if (name === "overlap") v.project.levels[2].author.edges[0].to = 2;
    expect(() => importExchange(v)).toThrow();
  });
}
