import { expect, test } from "vitest";
import {
  moveAuthorCards,
  newDraft,
  publishDraft,
  retainCards,
  reviseDraft,
  setStudentStart,
  updateAuthorEdge,
} from "../src/core/authoring";
import { cardAppearance, designOf } from "../src/core/design";
import {
  encodeDocument,
  readDocument,
  validateContent,
} from "../src/core/documents";
import { COLORS } from "../src/core/model";

function authored() {
  const draft = newDraft("QA");
  return reviseDraft(draft, {
    ...draft.content,
    title: "Aufgabenstellung",
    instructions: "Beratet euch im Team.\nNotiert die Ergebnisse.",
    cards: [
      {
        id: 1,
        group: "required",
        title: "Hell",
        text: "Erste Karte",
        backgroundColor: "#fff3a8",
      },
      {
        id: 2,
        group: "extension",
        title: "Dunkel",
        text: "Zweite Karte",
        backgroundColor: "#253252",
      },
      { id: 3, group: "required", title: "Standard", text: "Dritte Karte" },
    ],
    initial: {
      ...draft.content.initial,
      cards: [1, 2, 3].map((id) => ({ id, x: id * 480, y: 0, color: 0 })),
    },
  });
}

test("author colors and instructions round-trip as content independently of learner marks", () => {
  const draft = authored();
  const task = publishDraft(draft);
  expect(readDocument(encodeDocument(draft))).toEqual(draft);
  expect(readDocument(encodeDocument(task))).toEqual(task);
  expect(task.content.instructions).toEqual(draft.content.instructions);
  const dark = task.content.cards[1];
  const design = designOf(task.content);
  expect(cardAppearance(dark, design)).toEqual({
    background: "#253252",
    text: "#ffffff",
  });
  expect(cardAppearance(dark, design, COLORS[1])).toEqual({
    background: COLORS[1],
    text: design.textColor,
  });
  expect(cardAppearance(task.content.cards[2], design).background).toBe(
    design.cardColor,
  );
  expect(() =>
    validateContent({
      ...task.content,
      cards: [{ ...dark, id: 1, backgroundColor: "url(test)" }],
    }),
  ).toThrow();
});

test("only a confirmed position snapshot changes student layout and its content version", () => {
  const draft = authored();
  const positions = draft.content.initial.cards.map((card) => ({
    ...card,
    x: 200 - card.id * 100,
    y: 2 ** card.id,
    color: 0,
  }));
  const privateEdge = {
    id: 1,
    from: 1,
    to: 2,
    direction: 1 as const,
    label: "Intern",
  };
  const internal = moveAuthorCards(
    updateAuthorEdge(draft, 1, privateEdge),
    positions,
  );
  expect(internal.content.version).toEqual(draft.content.version);
  expect(publishDraft(internal)).toEqual(publishDraft(draft));
  const saved = setStudentStart(internal, { mode: "explicit" }, positions);
  expect(saved.content.version).not.toEqual(draft.content.version);
  expect(publishDraft(saved).content.initial.cards).toEqual(positions);
  expect(publishDraft(saved).content.initial.edges).toEqual([]);
  expect(setStudentStart(saved, { mode: "explicit" }, positions)).toBe(saved);
  const moved = moveAuthorCards(saved, draft.content.initial.cards);
  expect(publishDraft(moved)).toEqual(publishDraft(saved));
  const automatic = setStudentStart(
    moved,
    { mode: "ordered" },
    moved.author.board!,
  );
  expect(automatic.author.board).toEqual(moved.author.board);
  expect(automatic.content.startLayout?.mode).toBe("ordered");
});

test("removing the last card leaves a valid editable draft and clears published relationships", () => {
  let draft = authored();
  draft = updateAuthorEdge(
    draft,
    1,
    { id: 1, from: 1, to: 2, direction: 1, label: "Weitergegeben" },
    true,
  );
  const reduced = retainCards(draft.content, [2, 3]);
  expect(reduced.cards.map((c) => [c.id, c.backgroundColor])).toEqual([
    [1, "#253252"],
    [2, undefined],
  ]);
  expect(reduced.initial.edges).toEqual([]);
  const empty = reviseDraft(draft, retainCards(draft.content, []));
  expect(readDocument(encodeDocument(empty))).toEqual(empty);
  expect(() => publishDraft(empty)).toThrow();
});
