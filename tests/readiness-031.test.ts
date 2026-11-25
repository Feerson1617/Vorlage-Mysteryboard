import { afterAll, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  importExchange,
  parseExchangeText,
  parsePastedExchange,
} from "../studio/exchange/import";
import {
  collectionEntries,
  exportIssues,
  singleEntries,
} from "../studio/ui/collection-scorm";
import { checkStudioArchive } from "../studio/exchange/archive";
import { publishDraft } from "../src/core/authoring";
import { encodeDocument } from "../src/core/documents";
import { zipScorm } from "../src/core/scorm-package";
const dir = mkdtempSync(join(tmpdir(), "mystery-031-"));
execFileSync("python3", ["qa/studio/readiness-fixtures-031.py", dir]);
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const player: [string, string, string] = [
  '<body><script id="mysteryboard-launch" type="application/json">null</script></body>',
  "launch",
  "session",
];
const source = (name: string) =>
  JSON.parse(readFileSync(join(dir, name + ".mysteryboard"), "utf8"));
it("keeps unpublished material intact and reports the regular publishing failure", () => {
  for (const [name, reason] of [
    ["Versteckt", /sichtbar/],
    ["Doppelt", /gleichlautende Namen/i],
  ] as const) {
    const d = importExchange(source(name));
    if (d.format !== "MysteryBoard") throw Error();
    const before = encodeDocument(d);
    expect(exportIssues(d, ...player).join(" ")).toMatch(reason);
    expect(() => publishDraft(d)).toThrow();
    expect(encodeDocument(d)).toEqual(before);
  }
});
it.each([1, 2, 4, 12])(
  "validates all %i independently composed levels of 100 cards",
  (n) => {
    const c = importExchange(source("Niveaus-" + n));
    if (c.format !== "MysteryBoardCollection") throw Error();
    expect(c.levels.map((l) => l.draft.content.cards.length)).toEqual(
      Array(n).fill(100),
    );
    expect(exportIssues(c, ...player)).toEqual([]);
  },
);
it("checks both measured single-project sizes, the real package and its resource identity", () => {
  for (const [name, size] of [
    ["Gross", 9617958],
    ["Grenze", 19980000],
  ] as const) {
    const d = importExchange(source(name));
    if (d.format !== "MysteryBoard") throw Error();
    expect(encodeDocument(d).length).toBe(size + 68);
    const task = publishDraft(d),
      entries = singleEntries(task, ...player);
    expect(entries["task.json"].length).toBe(size);
    expect(
      JSON.parse(new TextDecoder().decode(entries["task.json"])).contentHash,
    ).toBe(task.contentHash);
    expect(entries["app.html"].length).toBeLessThan(10_000_000);
    checkStudioArchive(zipScorm(entries));
    if (name === "Gross") {
      const changed = {
        ...entries,
        "app.html": new TextEncoder().encode(
          new TextDecoder()
            .decode(entries["app.html"])
            .replace(task.contentHash, "0".repeat(64)),
        ),
      };
      expect(() => checkStudioArchive(zipScorm(changed))).toThrow(
        /passt nicht/,
      );
    }
  }
}, 120000);
it("packages mixed media with one player and size-limited local level files", () => {
  const c = importExchange(source("Gemischt"));
  if (c.format !== "MysteryBoardCollection") throw Error();
  const entries = collectionEntries(c, ...player);
  expect(
    Object.keys(entries).filter((v) => v.startsWith("level-")),
  ).toHaveLength(2);
  checkStudioArchive(zipScorm(entries));
}, 60000);
it("accepts only a single complete fenced JSON paste and keeps files strict", () => {
  const json = '{"sample":1}',
    fence = String.fromCharCode(96).repeat(3),
    block = fence + "json\r\n" + json + "\r\n" + fence;
  expect(parsePastedExchange(block)).toEqual({ sample: 1 });
  for (const bad of [
    block + " text",
    "Vorab\n" + block,
    block + "\n" + block,
    block.replace("json", "html"),
    block.slice(0, -1),
  ])
    expect(() => parsePastedExchange(bad)).toThrow();
  expect(() => parseExchangeText(block)).toThrow();
});
