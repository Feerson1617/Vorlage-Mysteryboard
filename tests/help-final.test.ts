import { it, expect } from "vitest";
import source from "../examples/universal/content.json";
import {
  ambiguousHelpNames,
  assertDistinctHelpNames,
} from "../src/core/help-authoring";
import {
  taskDocument,
  readDocument,
  encodeDocument,
} from "../src/core/documents";
import { draftFromContent, publishDraft } from "../src/core/authoring";
it.each([
  ["Ursachen", " Ursachen "],
  ["Ursachen", "ursachen"],
  ["Einfluss und Wirkung", "Einfluss  und Wirkung"],
  ["Ökologie", "ÖKOLOGIE"],
])("weist gleichlautende Namen %s / %s beim Publizieren zurück", (...names) => {
  const doc = taskDocument(source);
  doc.content
    .help!.categories!.slice(0, 2)
    .forEach((g, i) => (g.label = names[i]));
  const legacy = taskDocument(doc.content);
  expect(readDocument(encodeDocument(legacy))).toEqual(legacy);
  expect(ambiguousHelpNames(legacy.content.help!.categories!)).toHaveLength(2);
  expect(() => publishDraft(draftFromContent(legacy.content, "AB"))).toThrow(
    /gleichlautende/,
  );
});
it("verändert bei der Namensprüfung keine Inhalte, Farben oder Zuordnungen", () => {
  const doc = taskDocument(source),
    before = structuredClone(doc);
  assertDistinctHelpNames(doc.content.help!.categories);
  expect(doc).toEqual(before);
  expect(ambiguousHelpNames([])).toEqual([]);
});
