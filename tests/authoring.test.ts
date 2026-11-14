import { expect, it } from "vitest";
import source from "../examples/universal/content.json";
import {
  draftFromContent,
  newDraft,
  publishDraft,
  retainCards,
  reviseDraft,
} from "../src/core/authoring";
import {
  encodeDocument,
  readDocument,
  studentDocument,
  taskDocument,
  validateDocument,
} from "../src/core/documents";
import { initialWork, withTeam } from "../src/core/model";
it("Lehrkraftkürzel bleibt vom Team getrennt, auch im leeren Entwurf", () => {
  const d = newDraft("AB");
  expect(d.content.cards).toHaveLength(0);
  expect(readDocument(encodeDocument(d))).toEqual(d);
  expect(() => newDraft("  ")).toThrow();
  expect(() => publishDraft(d)).toThrow();
});
it("beliebige veröffentlichte Aufgabe wird ohne Informationsverlust wieder bearbeitbar", () => {
  const task = taskDocument(source),
    d = draftFromContent(task.content, "XY");
  expect(d.content).toEqual(task.content);
  expect(publishDraft(d)).toEqual(task);
  const edited = reviseDraft(d, { ...d.content, title: "Neuer Titel" });
  expect(edited.content.version).not.toBe(task.content.version);
  expect(edited.content.help).toEqual(task.content.help);
  expect(edited.content.cards).toEqual(task.content.cards);
});
it("Löschen/Zurückhalten nummeriert IDs und Hilfereferenzen gemeinsam, ohne alte Arbeit zu ändern", () => {
  const first = taskDocument(source),
    old = studentDocument(
      first.content,
      withTeam(initialWork(first.content), "Alt"),
    );
  const d = draftFromContent(first.content, "AB");
  const revised = reviseDraft(
    d,
    retainCards(
      d.content,
      d.content.cards.filter((c) => c.id !== 2).map((c) => c.id),
    ),
  );
  expect(revised.content.cards.map((c) => c.id)).toEqual(
    Array.from({ length: 11 }, (_, i) => i + 1),
  );
  expect(revised.content.help!.categories![1].cardIds).toEqual([4, 7]);
  const hidden = validateDocument({
    ...revised,
    author: { ...revised.author, hiddenCards: [11] },
  });
  if (hidden.kind !== "draft") throw new Error();
  const task = publishDraft(hidden);
  expect(task.content.cards).toHaveLength(10);
  expect(task).not.toHaveProperty("author");
  expect(task).not.toHaveProperty("work");
  expect(task.content.initial.edges).toEqual([]);
  expect(task.content.initial.cards.every((c) => c.color === 0)).toBe(true);
  expect(readDocument(encodeDocument(old))).toEqual(old);
  expect(() => studentDocument(task.content, old.work)).toThrow();
});
