import {
  canonical,
  contentHash,
  encodeDocument,
  readDocument,
  validateDocument,
  MAX_DOCUMENT_BYTES,
  type Draft,
  type MysteryDocument,
} from "./documents";
import { newDraft, reviseDraft } from "./authoring";
export type RecoveryMode = "off" | "session" | "extended";
export const MAX_LEVELS = 12;
export const COLLECTION_BYTES = 60_000_000;
export interface Level {
  id: string;
  name: string;
  description: string;
  usesDefault?: boolean;
  draft: Draft;
}
export interface Collection {
  format: "MysteryBoardCollection";
  formatVersion: 1;
  id: string;
  title: string;
  active: string;
  defaultRecovery?: RecoveryMode;
  levels: Level[];
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function newStudioDraft(initials: string): Draft {
  const draft = newDraft(initials);
  const content = { ...draft.content, recovery: "session" as const };
  return { ...draft, content, contentHash: contentHash(content) };
}
export function levelFrom(
  draft: Draft,
  collectionId: string,
  name: string,
): Level {
  const id = crypto.randomUUID();
  return {
    id,
    name,
    description: "",
    draft: reviseDraft(structuredClone(draft), {
      ...draft.content,
      id: collectionId + "." + id,
    }),
  };
}
export function collectionFrom(draft: Draft): Collection {
  const id = crypto.randomUUID(),
    first = levelFrom(draft, id, "Basis");
  return {
    format: "MysteryBoardCollection",
    formatVersion: 1,
    id,
    title: draft.content.title || "Mein Mystery",
    active: first.id,
    defaultRecovery:
      draft.content.recovery === "extended"
        ? "session"
        : (draft.content.recovery ?? "off"),
    levels: [{ ...first, usesDefault: draft.content.recovery !== "extended" }],
  };
}
export function validateCollection(c: Collection): Collection {
  if (
    !c ||
    c.format !== "MysteryBoardCollection" ||
    c.formatVersion !== 1 ||
    !uuid.test(c.id) ||
    (c.defaultRecovery !== undefined &&
      !["off", "session", "extended"].includes(c.defaultRecovery)) ||
    typeof c.title !== "string" ||
    !c.title.trim() ||
    c.title.length > 100 ||
    !Array.isArray(c.levels) ||
    !c.levels.length ||
    c.levels.length > MAX_LEVELS
  )
    throw Error(
      "Ungültige Sammlung. Erlaubt sind 1 bis 12 Niveaus mit einem Projekttitel.",
    );
  const ids = new Set<string>();
  for (const level of c.levels) {
    if (
      !level ||
      !uuid.test(level.id) ||
      ids.has(level.id) ||
      (level.usesDefault !== undefined &&
        typeof level.usesDefault !== "boolean") ||
      typeof level.name !== "string" ||
      !level.name.trim() ||
      level.name.length > 60 ||
      typeof level.description !== "string" ||
      level.description.length > 300 ||
      level.draft?.kind !== "draft" ||
      level.draft.content.id !== c.id + "." + level.id
    )
      throw Error("Ungültige Niveauzuordnung oder Bezeichnung.");
    ids.add(level.id);
    validateDocument(level.draft);
  }
  if (!ids.has(c.active)) throw Error("Das bearbeitete Niveau fehlt.");
  return c;
}
export function encodeCollection(c: Collection) {
  const bytes = new TextEncoder().encode(canonical(validateCollection(c)));
  if (bytes.length > COLLECTION_BYTES)
    throw Error("Die vollständige Sammlung überschreitet 60 MB.");
  return bytes;
}
export function readProject(bytes: Uint8Array): Collection | MysteryDocument {
  if (bytes.length > COLLECTION_BYTES)
    throw Error("Die Projektdatei überschreitet 60 MB.");
  if (bytes[0] !== 137) {
    const json = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (json?.format === "MysteryBoardCollection")
      return validateCollection(json);
    if (bytes.length > MAX_DOCUMENT_BYTES)
      throw Error("Das einzelne Mystery überschreitet 20 MB.");
    return validateDocument(json);
  }
  return readDocument(bytes);
}
export function bindLevel(c: Collection, draft: Draft): Draft {
  const identity = c.id + "." + c.active;
  return draft.content.id === identity
    ? draft
    : reviseDraft(draft, { ...draft.content, id: identity });
}
export function withLevel(c: Collection, draft: Draft): Collection {
  draft = bindLevel(c, draft);
  return {
    ...c,
    levels: c.levels.map((level) =>
      level.id === c.active
        ? {
            ...level,
            draft,
            ...(level.usesDefault &&
            (draft.content.recovery ?? "off") !== c.defaultRecovery
              ? { usesDefault: false }
              : {}),
          }
        : level,
    ),
  };
}
export function projectBytes(c: Collection | null, draft: Draft) {
  return c ? encodeCollection(withLevel(c, draft)) : encodeDocument(draft);
}

export function setCollectionRecovery(
  c: Collection,
  mode: RecoveryMode,
  all: boolean,
): Collection {
  return {
    ...c,
    defaultRecovery: mode,
    levels: c.levels.map((l) => {
      if (!all && !l.usesDefault) return l;
      return {
        ...l,
        usesDefault: true,
        draft:
          (l.draft.content.recovery ?? "off") === mode
            ? l.draft
            : reviseDraft(l.draft, { ...l.draft.content, recovery: mode }),
      };
    }),
  };
}
