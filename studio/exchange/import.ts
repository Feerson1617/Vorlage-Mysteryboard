import check from "./validate.generated.js";
import {
  canonical,
  contentHash,
  validateContent,
  validateDocument,
  encodeDocument,
  type Draft,
  type Content,
} from "../../src/core/documents";
import {
  COLLECTION_BYTES,
  encodeCollection,
  type Collection,
  type RecoveryMode,
} from "../../src/core/levels";
import { inspectDataImage, verifyImageDecode } from "../../src/core/media";
import { sha256 } from "@noble/hashes/sha2.js";
type LevelInput = {
  name?: string;
  description?: string;
  content: Omit<Content, "id" | "version" | "initial" | "cardGroups"> &
    Partial<Pick<Content, "cardGroups">>;
  author?: Partial<Draft["author"]>;
  startPositions?: Content["initial"]["cards"];
  studentHints?: Content["initial"]["edges"];
};
type Input = {
  format: "MysteryBoardAI";
  kind: "project";
  formatVersion: 1;
  project:
    | ({ kind: "single" } & LevelInput)
    | {
        kind: "collection";
        title: string;
        defaultRecovery?: RecoveryMode;
        levels: LevelInput[];
      };
};
export type ImportedProject = Draft | Collection;
export function isExchange(
  v: unknown,
): v is { format: "MysteryBoardAI"; formatVersion?: number; kind?: string } {
  return (
    !!v &&
    typeof v === "object" &&
    "format" in v &&
    v.format === "MysteryBoardAI"
  );
}
export function parseExchangeText(text: string): unknown {
  if (
    text.length > COLLECTION_BYTES ||
    new TextEncoder().encode(text).length > COLLECTION_BYTES
  )
    throw Error("Die Austauschdatei überschreitet 60 MB.");
  try {
    return JSON.parse(text);
  } catch {
    throw Error("Der Text ist kein vollständiges gültiges JSON.");
  }
}
function bounded(value: unknown, depth = 0) {
  if (typeof value !== "object" || !value) return;
  if (
    depth > 24 ||
    (Array.isArray(value)
      ? value.length > 300
      : Object.keys(value).length > 120)
  )
    throw Error(
      "Die Austauschstruktur überschreitet die unterstützten Grenzen.",
    );
  for (const child of Object.values(value)) bounded(child, depth + 1);
}
function identity(seed: string) {
  const h = Array.from(sha256(new TextEncoder().encode(seed)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-4" +
    h.slice(13, 16) +
    "-8" +
    h.slice(17, 20) +
    "-" +
    h.slice(20, 32)
  );
}
export function importExchange(v: unknown): ImportedProject {
  if (!isExchange(v))
    throw Error(
      "Bitte eine ausgefüllte MysteryBoard-KI-Austauschdatei wählen.",
    );
  if (v.formatVersion !== 1)
    throw Error(
      "Diese Version des KI-Austauschformats wird nicht unterstützt.",
    );
  if (v.kind === "template")
    throw Error(
      "Dies ist die leere KI-Blankovorlage. Bitte im KI-Chat ausfüllen und die neue Austauschdatei öffnen.",
    );
  bounded(v);
  if (!check(v)) {
    const messages = (check.errors ?? [])
      .filter((e) => e.keyword !== "if")
      .map((e) => {
        const path = e.instancePath
          .replace(
            /^\/project\/levels\/(\d+)/,
            (_, n) => "Niveau " + (Number(n) + 1),
          )
          .replace(/\/cards\/(\d+)/g, (_, n) => " / Karte " + (Number(n) + 1))
          .replaceAll("/", " · ");
        return (
          (path || "Austauschdatei") +
          " – " +
          (e.keyword === "additionalProperties"
            ? "Unbekannte Eigenschaft " + e.params.additionalProperty
            : e.keyword === "required"
              ? "Pflichtfeld fehlt: " + e.params.missingProperty
              : e.keyword === "type"
                ? "Falscher Datentyp (" + e.params.type + ")"
                : "Ungültiger Wert (" + e.keyword + ")")
        );
      });
    throw Error([...new Set(messages)].slice(0, 20).join("\n"));
  }
  const p = (v as Input).project,
    collection = p.kind === "collection",
    entries = collection ? p.levels : [p],
    errors: string[] = [];
  const id = identity("MysteryBoardAI:1:" + canonical(p)),
    defaultRecovery = collection ? (p.defaultRecovery ?? "session") : "session";
  const seen = new Set<string>();
  const levels = entries
    .map((l, i) => {
      const name = l.name ?? l.content.title,
        label = collection
          ? "Niveau " + (i + 1) + " („" + name + "“)"
          : "Einzel-Mystery";
      if (collection) {
        const key = name.trim().normalize("NFKC").toLocaleLowerCase("de");
        if (!key || seen.has(key))
          errors.push(
            label + " – bitte eine eindeutige Niveaubezeichnung verwenden.",
          );
        seen.add(key);
      }
      const lid = identity(id + "/" + i);
      try {
        for (const [j, card] of l.content.cards.entries()) {
          if (card.id !== j + 1)
            errors.push(
              label +
                " / Karte " +
                (j + 1) +
                " – IDs müssen in aufsteigender Reihenfolge bei 1 beginnen.",
            );
          for (const media of [
            card.image,
            ...(card.extraImages ?? []).map((x) => x.src),
          ])
            if (media) {
              try {
                inspectDataImage(media);
              } catch (e) {
                errors.push(
                  label +
                    " / Karte " +
                    card.id +
                    " / Bild – " +
                    (e as Error).message,
                );
              }
            }
          if ((card.imageAlt || card.imageCaption) && !card.image)
            errors.push(
              label +
                " / Karte " +
                card.id +
                " – Abbildung zur Beschreibung fehlt.",
            );
        }
        const base = {
          ...l.content,
          cards: l.content.cards.map((card) => ({
            ...card,
            group: card.group ?? "required",
          })),
          id: collection ? id + "." + lid : id,
          version: "1.0.0",
          cardGroups: l.content.cardGroups ?? {
            required: { label: "Pflichtkarte", prefix: "" },
            extension: { label: "Vertiefungskarte", prefix: "V" },
          },
          startLayout: l.content.startLayout ?? { mode: "ordered" },
          recovery: l.content.recovery ?? defaultRecovery,
        };
        if (l.startPositions && base.startLayout.mode !== "explicit")
          throw Error("startPositions benötigt startLayout.mode explicit.");
        if (base.startLayout.mode === "explicit" && !l.startPositions)
          throw Error("Bei expliziter Anordnung fehlen startPositions.");
        for (const [where, edges] of [
          ["studentHints", l.studentHints],
          ["author.edges", l.author?.edges],
        ] as const)
          for (const edge of edges ?? [])
            if (
              !l.content.cards.some((x) => x.id === edge.from) ||
              !l.content.cards.some((x) => x.id === edge.to) ||
              edge.from === edge.to
            )
              errors.push(
                label +
                  " / " +
                  where +
                  " / " +
                  edge.id +
                  " – ungültige Kartenreferenz.",
              );
        const hidden = new Set(l.author?.hiddenCards);
        if (l.studentHints?.some((e) => hidden.has(e.to) || hidden.has(e.from)))
          throw Error(
            "Öffentliche Starthilfe verweist auf eine ausgeblendete Karte.",
          );
        const hints = l.studentHints ?? [],
          cards =
            l.startPositions ??
            base.cards.map((c, i) => ({
              id: c.id,
              x: i * 480,
              y: 0,
              color: 0,
            }));
        const content = validateContent({
          ...base,
          initial: { cards, edges: hints, categories: Array(6).fill("") },
          ...(hints.length ? { startEdgesAsHints: true } : {}),
        });
        const draft = validateDocument({
          format: "MysteryBoard",
          formatVersion: 3,
          kind: "draft",
          content,
          contentHash: contentHash(content),
          author: {
            initials: "LK",
            hiddenCards: [],
            ...l.author,
            status: "in-progress",
          },
        }) as Draft;
        encodeDocument(draft);
        return {
          id: lid,
          name,
          description: l.description ?? "",
          usesDefault: l.content.recovery === undefined,
          draft,
        };
      } catch (e) {
        errors.push(label + " – " + (e as Error).message);
        return undefined;
      }
    })
    .filter((x) => x !== undefined);
  if (errors.length) throw Error([...new Set(errors)].slice(0, 24).join("\n"));
  if (!collection) return levels[0].draft;
  const result: Collection = {
    format: "MysteryBoardCollection",
    formatVersion: 1,
    id,
    title: p.title,
    active: levels[0].id,
    defaultRecovery,
    levels,
  };
  encodeCollection(result);
  return result;
}
export const importLevels = (p: ImportedProject) =>
  p.format === "MysteryBoardCollection"
    ? p.levels.map((l) => ({ name: l.name, draft: l.draft }))
    : [{ name: p.content.title, draft: p }];
export async function decodeExchangeMedia(p: ImportedProject) {
  const seen = new Set<string>();
  for (const { draft } of importLevels(p))
    for (const card of draft.content.cards)
      for (const src of [
        card.image,
        ...(card.extraImages ?? []).map((i) => i.src),
      ])
        if (src && !seen.has(src)) {
          await verifyImageDecode(src);
          seen.add(src);
        }
}
