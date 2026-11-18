import { assertDistinctHelpNames } from "./help-authoring";
import {
  contentHash,
  canonical,
  taskDocument,
  validateContent,
  validateDocument,
  type Content,
  type Draft,
} from "./documents";
import type { CardState, Edge } from "./model";

export function authorEdges(draft: Draft): Edge[] {
  return [...draft.content.initial.edges, ...(draft.author.edges ?? [])];
}

export function moveAuthorCards(draft: Draft, board: CardState[]): Draft {
  return validateDocument({
    ...draft,
    author: { ...draft.author, board },
  }) as Draft;
}

export function setStudentStart(
  draft: Draft,
  layout: NonNullable<Content["startLayout"]>,
  board: readonly CardState[],
): Draft {
  const content = draft.content;
  const positions = new Map(board.map((card) => [card.id, card]));
  const cards =
    layout.mode === "explicit"
      ? content.initial.cards.map((old) => {
          const position = positions.get(old.id);
          return position ? { ...old, x: position.x, y: position.y } : old;
        })
      : content.initial.cards;
  if (
    canonical(layout) === canonical(content.startLayout) &&
    canonical(cards) === canonical(content.initial.cards)
  )
    return draft;
  return reviseDraft(
    draft,
    { ...content, startLayout: layout, initial: { ...content.initial, cards } },
    draft.author.board || !board.length
      ? draft.author
      : { ...draft.author, board: [...board] },
  );
}

export function updateAuthorEdge(
  draft: Draft,
  id: number,
  edge?: Edge,
  shared = false,
): Draft {
  if (
    edge &&
    shared &&
    [edge.from, edge.to].some((card) => draft.author.hiddenCards.includes(card))
  )
    throw new Error(
      "Eine Starthilfe benötigt zwei Karten, die veröffentlicht werden.",
    );
  const replace = (edges: Edge[], include: boolean) => {
    if (!edge || !include) return edges.filter((item) => item.id !== id);
    return edges.some((item) => item.id === id)
      ? edges.map((item) => (item.id === id ? edge : item))
      : [...edges, edge];
  };
  const edges = replace(draft.content.initial.edges, shared);
  const author = {
    ...draft.author,
    edges: replace(draft.author.edges ?? [], !shared),
  };
  if (canonical(edges) === canonical(draft.content.initial.edges))
    return validateDocument({ ...draft, author }) as Draft;
  return reviseDraft(draft, withStartEdges(draft.content, edges), author);
}

function withStartEdges(content: Content, edges: Edge[]): Content {
  const { startEdgesAsHints: _previous, ...rest } = content;
  return {
    ...rest,
    ...(edges.length ? { startEdgesAsHints: true as const } : {}),
    initial: { ...content.initial, edges },
  };
}

export function remapEdges(
  edges: Edge[],
  mapping: ReadonlyMap<number, number>,
): Edge[] {
  return edges
    .filter((edge) => mapping.has(edge.from) && mapping.has(edge.to))
    .map((edge) => ({
      ...edge,
      from: mapping.get(edge.from)!,
      to: mapping.get(edge.to)!,
    }));
}

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
  const selected = content.cards.filter((c) => ids.includes(c.id));
  const map = new Map(selected.map((c, i) => [c.id, i + 1]));
  const edges = remapEdges(content.initial.edges, map);
  const categories = content.help?.categories
    ?.map((c) => ({
      ...c,
      cardIds: c.cardIds.filter((id) => map.has(id)).map((id) => map.get(id)!),
    }))
    .filter((c) => c.cardIds.length);
  return {
    ...withStartEdges(content, edges),
    cards: selected.map((c) => ({ ...c, id: map.get(c.id)! })),
    initial: {
      cards: selected.map((c) => ({
        ...content.initial.cards.find((s) => s.id === c.id)!,
        id: map.get(c.id)!,
        color: 0,
      })),
      edges,
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
