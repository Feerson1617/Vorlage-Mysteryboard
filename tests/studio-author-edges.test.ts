import { describe, expect, it } from "vitest";
import {
  draftFromContent,
  moveAuthorCards,
  publishDraft,
  remapEdges,
  retainCards,
  reviseDraft,
  updateAuthorEdge,
} from "../src/core/authoring";
import {
  encodeDocument,
  readDocument,
  studentDocument,
  validateDocument,
} from "../src/core/documents";
import { initialWork } from "../src/core/model";
import type { Edge } from "../src/core/model";
import example from "../examples/universal/unterricht-entwurf.mysteryboard?raw";
import type { Draft } from "../src/core/documents";

const original = () => readDocument(new TextEncoder().encode(example)) as Draft;
const privateEdge: Edge = {
  id: 80,
  from: 1,
  to: 2,
  direction: 2,
  label: "Interne Planung",
};
const sharedEdge: Edge = {
  id: 24,
  from: 2,
  to: 3,
  direction: 1,
  label: "Beobachtung",
};

describe("Studio project board and sharing", () => {
  it("retains the exact old task identity after private moves and edits", () => {
    const draft = original(),
      task = publishDraft(draft);
    const work = initialWork(task.content);
    const oldStudentBytes = encodeDocument(studentDocument(task.content, work));
    const moved = moveAuthorCards(
      draft,
      draft.content.initial.cards.map((card) =>
        card.id === 1 ? { ...card, x: 100.25, y: -35.12 } : card,
      ),
    );
    const next = updateAuthorEdge(moved, privateEdge.id, privateEdge);
    const restored = readDocument(encodeDocument(next));
    expect(restored).toEqual(next);
    expect(next.content.version).toBe(draft.content.version);
    expect(next.contentHash).toBe(draft.contentHash);
    expect(publishDraft(next)).toEqual(task);
    expect(readDocument(oldStudentBytes)).toEqual(
      studentDocument(task.content, work),
    );
  });

  it("publishes only explicit help, preserves it when reopening and erases it when demoted", () => {
    let draft = updateAuthorEdge(original(), privateEdge.id, privateEdge);
    draft = updateAuthorEdge(draft, sharedEdge.id, sharedEdge, true);
    const task = publishDraft(draft);
    expect(task.content.version).not.toBe(original().content.version);
    expect(task.content.initial.edges).toEqual([sharedEdge]);
    expect(JSON.stringify(task)).not.toContain(privateEdge.label);
    expect(initialWork(task.content).edges).toEqual([sharedEdge]);
    expect(draftFromContent(task.content, "QA").content.initial.edges).toEqual([
      sharedEdge,
    ]);
    const demoted = updateAuthorEdge(draft, sharedEdge.id, sharedEdge);
    expect(demoted.content.version).not.toBe(draft.content.version);
    expect(publishDraft(demoted).content.initial.edges).toEqual([]);
    expect(demoted.author.edges).toContainEqual(sharedEdge);
  });

  it("filters hidden endpoints on publication and remaps remaining edges on deletion", () => {
    const draft = updateAuthorEdge(
      updateAuthorEdge(original(), privateEdge.id, privateEdge),
      sharedEdge.id,
      sharedEdge,
      true,
    );
    const hidden = reviseDraft(draft, draft.content, {
      ...draft.author,
      hiddenCards: [1],
    });
    expect(publishDraft(hidden).content.initial.edges).toEqual([
      { ...sharedEdge, from: 1, to: 2 },
    ]);
    const hiddenEndpoint = reviseDraft(draft, draft.content, {
      ...draft.author,
      hiddenCards: [2],
    });
    expect(publishDraft(hiddenEndpoint).content.initial.edges).toEqual([]);
    expect(() =>
      updateAuthorEdge(hidden, privateEdge.id, privateEdge, true),
    ).toThrow(/zwei Karten/);
    const ids = draft.content.cards.slice(1).map((card) => card.id);
    expect(retainCards(draft.content, ids).initial.edges).toEqual([
      { ...sharedEdge, from: 1, to: 2 },
    ]);
    expect(
      remapEdges(draft.author.edges!, new Map(ids.map((id, i) => [id, i + 1]))),
    ).toEqual([]);
  });

  it("rejects unknown endpoints and duplicate unordered pairs, including across stores", () => {
    const draft = updateAuthorEdge(original(), sharedEdge.id, sharedEdge, true);
    expect(() =>
      updateAuthorEdge(draft, privateEdge.id, {
        ...privateEdge,
        from: 3,
        to: 2,
      }),
    ).toThrow();
    expect(() =>
      validateDocument({
        ...draft,
        author: { ...draft.author, edges: [{ ...privateEdge, from: 999 }] },
      }),
    ).toThrow();
  });
});
