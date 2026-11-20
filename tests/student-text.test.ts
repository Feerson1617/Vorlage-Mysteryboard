import { describe, expect, it } from "vitest";
import { packWork, toQr, unpackWork } from "../src/core/codec";
import {
  packDocument,
  studentDocument,
  taskDocument,
  unpackDocument,
  validateDocument,
  type Content,
} from "../src/core/documents";
import { newDraft, publishDraft, reviseDraft } from "../src/core/authoring";
import { emptyHistory, historyReducer } from "../src/core/history";
import { initialWork, validateWork, withTeam } from "../src/core/model";
import { withStudentCards, withStudentText } from "../src/core/student-text";

function fixture(count = 5, editable = (id: number) => id < 3) {
  const draft = newDraft("QA");
  const content: Content = {
    ...draft.content,
    title: "Textkarten",
    cards: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: "Karte " + (i + 1),
      text: i ? "Vorbelegter Text" : "",
      source: "Unveränderte Quelle",
      group: "required",
      ...(editable(i + 1) ? ({ studentEditable: true } as const) : {}),
    })),
    initial: {
      ...draft.content.initial,
      cards: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        x: i * 350,
        y: 0,
        color: 0,
      })),
    },
  };
  return reviseDraft(draft, content);
}

describe("Textfreigabe und Schülerarbeitsstand", () => {
  it("versioniert die Freigabe im Projekt und in der veröffentlichten Aufgabe", () => {
    const locked = fixture(5, () => false);
    const editable = reviseDraft(locked, {
      ...locked.content,
      cards: locked.content.cards.map((c) =>
        c.id === 1 ? { ...c, studentEditable: true } : c,
      ),
    });
    const reopened = validateDocument(JSON.parse(JSON.stringify(editable)));
    expect(reopened.content.cards[0].studentEditable).toBe(true);
    expect(publishDraft(editable).contentHash).not.toBe(
      publishDraft(locked).contentHash,
    );
    expect(editable.content.version).not.toBe(locked.content.version);
    const old = withTeam(initialWork(locked.content), "Team");
    expect(
      unpackDocument(packDocument(studentDocument(locked.content, old))),
    ).toMatchObject({ work: old });
    expect(() => validateWork(old, editable.content)).toThrow(
      /Mystery-Version/,
    );
    expect(() =>
      withStudentText(old, locked.content.cards[0], { title: "neu", text: "" }),
    ).toThrow(/zulässig/);
  });

  it("bewahrt Quelle, Aufgabe und Geometrie und legt einen History-Eintrag je Bearbeitung an", () => {
    const content = publishDraft(fixture()).content;
    const original = content.cards[0];
    const work = withTeam(initialWork(content), "ÄÖ");
    const text = { title: "Überschrift", text: "Beobachtung\n\nCO₂, 12,5 μg³" };
    const next = withStudentText(work, original, text);
    expect(next).toMatchObject({
      schema: 3,
      cards: work.cards,
      edges: work.edges,
      textEdits: [{ id: 1, ...text }],
    });
    expect(withStudentCards(content, next.textEdits).cards[0]).toEqual({
      ...original,
      ...text,
    });
    expect(content.cards[0].text).toBe("");
    expect(withTeam(next, "Umbenannt").schema).toBe(3);
    expect(withTeam(next, "").textEdits).toEqual(next.textEdits);
    const base = historyReducer(emptyHistory, { type: "load", work });
    const edited = historyReducer(base, { type: "edit", work: next });
    const undone = historyReducer(edited, { type: "undo" });
    expect(undone.present).toEqual(work);
    expect(historyReducer(undone, { type: "redo" }).present).toEqual(next);
    expect(withStudentText(next, original, original)).toEqual(work);
    expect(unpackWork(packWork(next), content)).toEqual(next);
    expect(toQr(packWork(next))).toBeNull();
  });

  it("weist Änderungen an gesperrten Karten, Doppelungen und eingeschleuste Quellen ab", () => {
    const task = publishDraft(fixture());
    const work = withTeam(initialWork(task.content), "Team");
    const edit = { id: 1, title: "A", text: "" };
    for (const textEdits of [
      [{ ...edit, id: 3 }],
      [edit, edit],
      [{ ...edit, id: 99 }],
      [{ ...edit, source: "falsch" }],
      [{ ...edit, title: "x".repeat(101) }],
      [{ ...edit, text: "x".repeat(4001) }],
    ]) {
      expect(() =>
        validateWork({ ...work, schema: 3, textEdits }, task.content),
      ).toThrow();
      expect(() =>
        validateDocument({
          ...task,
          kind: "student",
          work: { ...work, schema: 3, textEdits },
        }),
      ).toThrow();
    }
    expect(() =>
      validateWork({ ...work, textEdits: [edit] }, task.content),
    ).toThrow();
    expect(() => validateWork({ ...work, schema: 3 }, task.content)).toThrow();
    expect(() =>
      taskDocument({
        ...task.content,
        cards: [{ ...task.content.cards[0], studentEditable: "ja" }],
      }),
    ).toThrow();
  });

  it.each([5, 12, 20, 60, 100])(
    "speichert alle Textänderungen bei %i Karten ohne Änderung der Aufgabe",
    (count) => {
      const task = publishDraft(fixture(count, () => true));
      const work = task.content.cards.reduce(
        (saved, card) =>
          withStudentText(saved, card, {
            title: "Schülerkarte " + card.id,
            text: "ÄΩ漢₂".repeat(1000),
          }),
        withTeam(initialWork(task.content), "Team"),
      );
      const doc = unpackDocument(
        packDocument(studentDocument(task.content, work)),
      );
      expect(doc).toEqual({ ...task, kind: "student", work });
      expect(unpackWork(packWork(work), task.content)).toEqual(work);
    },
  );
});
