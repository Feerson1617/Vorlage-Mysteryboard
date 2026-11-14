import { assertDistinctHelpNames } from "./help-authoring";
import {
  contentHash,
  taskDocument,
  validateContent,
  validateDocument,
  type Content,
  type Draft,
} from "./documents";

export function newDraft(initials: string): Draft {
  const content = validateContent(
    {
      id: `mystery-${crypto.randomUUID()}`,
      version: "1.0.0",
      title: "",
      cards: [],
      cardGroups: {
        required: { label: "Pflichtkarte", prefix: "" },
        extension: { label: "Vertiefungskarte", prefix: "V" },
      },
      startLayout: { mode: "ordered" },
    },
    true,
  );
  return validateDocument({
    format: "MysteryBoard",
    formatVersion: 3,
    kind: "draft",
    content,
    contentHash: contentHash(content),
    author: {
      initials: initials.trim(),
      status: "in-progress",
      hiddenCards: [],
    },
  }) as Draft;
}
export function reviseDraft(
  draft: Draft,
  update: Content,
  author = draft.author,
): Draft {
  const [major, minor, patch] = draft.content.version.split(".").map(Number);
  if (patch >= 999999)
    throw new Error(
      "Die Inhaltsversion kann nicht weiter erhöht werden. Bitte eine neue Mystery-ID verwenden.",
    );
  const content = validateContent(
    { ...update, version: `${major}.${minor}.${patch + 1}` },
    true,
  );
  return validateDocument({
    ...draft,
    content,
    contentHash: contentHash(content),
    author: { ...author, status: "in-progress" },
  }) as Draft;
}
// Explicitly renumber a structural edit and all internal references together.
// The caller advances the content version; already exported files stay intact.
export function retainCards(content: Content, ids: number[]): Content {
  const selected = content.cards
    .filter((c) => ids.includes(c.id))
    .sort((a, b) => a.id - b.id);
  const map = new Map(selected.map((c, i) => [c.id, i + 1]));
  const categories = content.help?.categories
    ?.map((c) => ({
      ...c,
      cardIds: c.cardIds.filter((id) => map.has(id)).map((id) => map.get(id)!),
    }))
    .filter((c) => c.cardIds.length);
  return {
    ...content,
    cards: selected.map((c) => ({ ...c, id: map.get(c.id)! })),
    initial: {
      cards: selected.map((c) => ({
        ...content.initial.cards.find((s) => s.id === c.id)!,
        id: map.get(c.id)!,
        color: 0,
      })),
      edges: [],
      categories: Array(6).fill(""),
    },
    ...(content.help
      ? {
          help: {
            ...(content.help.method ? { method: content.help.method } : {}),
            ...(categories?.length ? { categories } : {}),
          },
        }
      : {}),
  };
}
export function publishDraft(draft: Draft) {
  const checked = validateDocument(draft) as Draft;
  const content = retainCards(
    checked.content,
    checked.content.cards
      .filter((c) => !checked.author.hiddenCards.includes(c.id))
      .map((c) => c.id),
  );
  assertDistinctHelpNames(content.help?.categories);
  return taskDocument(content);
}
export function draftFromContent(content: Content, initials: string): Draft {
  return validateDocument({
    format: "MysteryBoard",
    formatVersion: 3,
    kind: "draft",
    content,
    contentHash: contentHash(content),
    author: {
      initials: initials.trim(),
      status: "in-progress",
      hiddenCards: [],
    },
  }) as Draft;
}
