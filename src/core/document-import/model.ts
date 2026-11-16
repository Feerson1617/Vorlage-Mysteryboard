import type { PdfLayout } from "./pdf-layout";
import type { Content, Draft } from "../documents";
import { newDraft, reviseDraft } from "../authoring";
import { inspectDataImage } from "../media";
export type Card = Content["cards"][number];
// Import editing only: never serialize this provenance into a Mystery document.
const splitPairs = new WeakMap<
  Card,
  {
    right: Card;
    original: Card;
    originalSnapshot: Card;
    leftSnapshot: Card;
    rightSnapshot: Card;
  }
>();
function snapshotCard(card: Card): Card {
  return {
    ...card,
    ...(card.table
      ? {
          table: {
            ...card.table,
            headers: [...card.table.headers],
            rows: card.table.rows.map((row) => [...row]),
          },
        }
      : {}),
  };
}
function sameCard(a: Card, b: Card) {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.text === b.text &&
    a.group === b.group &&
    a.source === b.source &&
    a.image === b.image &&
    a.imageAlt === b.imageAlt &&
    JSON.stringify(a.table) === JSON.stringify(b.table)
  );
}
export function splitImported(
  card: Card,
  at: number,
  id: number,
): [Card, Card] {
  if (!Number.isInteger(at) || at <= 0 || at >= card.text.length)
    throw new Error(
      "Setzt den Textcursor an die gewünschte Grenze innerhalb des Kartentexts.",
    );
  const left = { ...card, text: card.text.slice(0, at) };
  const right: Card = {
    id,
    title: "",
    text: card.text.slice(at),
    group: card.group,
    ...(card.source ? { source: card.source } : {}),
  };
  splitPairs.set(left, {
    right,
    original: card,
    originalSnapshot: snapshotCard(card),
    leftSnapshot: snapshotCard(left),
    rightSnapshot: snapshotCard(right),
  });
  return [left, right];
}
export function canRejoinImported(a: Card, b: Card): boolean {
  const pair = splitPairs.get(a);
  return (
    !!pair &&
    pair.right === b &&
    sameCard(a, pair.leftSnapshot) &&
    sameCard(b, pair.rightSnapshot) &&
    sameCard(pair.original, pair.originalSnapshot)
  );
}
export type Block = {
  kind: "heading" | "paragraph" | "list" | "image" | "table";
  text: string;
  image?: string;
  imageAlt?: string;
  table?: Card["table"];
  page?: number;
  bounds?: { x: number; y: number; width: number; height: number };
};
export type ImportResult = {
  format: "docx" | "pdf";
  name: string;
  blocks: Block[];
  cards: Card[];
  images: string[];
  warnings: string[];
  pages?: { width: number; height: number }[];
  noText?: boolean;
  pdfLayout?: PdfLayout;
  suggestedTitle?: string;
};
export const IMPORT_LIMITS = {
  fileBytes: 20_000_000,
  pages: 40,
  zipBytes: 40_000_000,
  zipEntries: 2000,
  textChars: 250_000,
  blocks: 4000,
  cards: 100,
};
export function checkImportFile(name: string, size: number) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "doc")
    throw new Error(
      "Ältere Word-Dateien (.doc) werden nicht unterstützt. Speichert das Dokument zuerst als .docx.",
    );
  if (!["docx", "pdf"].includes(ext ?? ""))
    throw new Error("Bitte eine Word-Datei (.docx) oder PDF-Datei auswählen.");
  if (!size || size > IMPORT_LIMITS.fileBytes)
    throw new Error(
      "Die Importdatei muss zwischen 1 Byte und 20 MB groß sein. Der geöffnete Entwurf bleibt erhalten.",
    );
  return ext as "docx" | "pdf";
}
export const isCardHeading = (text: string) =>
  /^(?:(?:pflichtkarte|vertiefungskarte|karte|card)\s*V?\s*\d+\b|V\d+\b|\d+\s*[.):·–-](?=\s|$))/i.test(
    text.trim(),
  );
export function proposeCards(blocks: Block[]): Card[] {
  const cards: Card[] = [];
  let current: Card | undefined;
  const fresh = () =>
    (current = {
      id: cards.length + 1,
      title: "",
      text: "",
      group: "required",
    });
  const finish = () => {
    if (
      current &&
      (current.title || current.text || current.image || current.table)
    )
      cards.push(current);
    current = undefined;
  };
  for (const block of blocks) {
    if (block.kind === "heading") {
      finish();
      fresh();
      current!.title = block.text;
      current!.group =
        /^(?:Vertiefungskarte(?=\s|\d|[:·–-]|$)|V\s*\d+\b)/i.test(
          block.text.trim(),
        )
          ? "extension"
          : "required";
      continue;
    }
    if (!current) fresh();
    if (block.kind === "image" && block.image) {
      if (current!.image) {
        finish();
        fresh();
      }
      current!.image = block.image;
      if (block.imageAlt) current!.imageAlt = block.imageAlt;
      continue;
    }
    if (block.kind === "table" && block.table) {
      if (current!.table) {
        finish();
        fresh();
      }
      current!.table = block.table;
      continue;
    }
    if (/^\s*(?:Quelle|Quellen|Source)\s*:/i.test(block.text))
      current!.source = [
        current!.source,
        block.text.replace(/^\s*(?:Quelle|Quellen|Source)\s*:\s*/i, ""),
      ]
        .filter(Boolean)
        .join("\n");
    else if (block.text)
      current!.text = [current!.text, block.text].filter(Boolean).join("\n\n");
  }
  finish();
  if (cards.length > IMPORT_LIMITS.cards)
    throw new Error(
      "Mehr als 100 Kartenbereiche erkannt. Bitte das Dokument vorher aufteilen.",
    );
  return cards;
}
export function takeImportedCards(
  draft: Draft,
  cards: Card[],
  mode: "append" | "new",
  title: string,
): Draft {
  if (!cards.length)
    throw new Error("Wählt mindestens eine Karte zur Übernahme aus.");
  const base = mode === "new" ? newDraft(draft.author.initials) : draft;
  const start = base.content.cards.length;
  if ((mode === "new" || !base.content.title) && title.length > 100)
    throw new Error("Der Mystery-Titel darf höchstens 100 Zeichen enthalten.");
  if (start + cards.length > 100)
    throw new Error(
      "Zusammen sind höchstens 100 Karten möglich. Wählt weniger Karten oder erstellt ein neues Mystery.",
    );
  for (const [i, c] of cards.entries()) {
    if (c.title.length > 100)
      throw new Error(
        `Karte ${i + 1}: Die Überschrift darf höchstens 100 Zeichen enthalten.`,
      );
    if (c.text.length > 4000)
      throw new Error(
        `Karte ${i + 1}: Der Text hat mehr als 4000 Zeichen. Bitte die Karte teilen oder bewusst kürzen.`,
      );
    if ((c.source?.length ?? 0) > 1000)
      throw new Error(
        `Karte ${i + 1}: Die Quellenangabe darf höchstens 1000 Zeichen enthalten.`,
      );
  }
  for (const [i, c] of cards.entries())
    if (c.table?.headers.some((h) => !h.trim()))
      throw new Error(
        `Karte ${i + 1}: Bitte alle Spaltenüberschriften der Tabelle eintragen.`,
      );
  const nextCards = [
    ...base.content.cards,
    ...cards.map((c, i) => ({ ...c, id: start + i + 1 })),
  ];
  const content: Content = {
    ...base.content,
    title: mode === "new" || !base.content.title ? title : base.content.title,
    cardGroups: draft.content.cardGroups,
    cards: nextCards,
    initial: {
      ...base.content.initial,
      cards: nextCards.map(
        (c, i) =>
          base.content.initial.cards.find((s) => s.id === c.id) ?? {
            id: c.id,
            x: i * 480,
            y: 0,
            color: 0,
          },
      ),
    },
  };
  return reviseDraft(base, content);
}
export function mergeImported(a: Card, b: Card): Card {
  if (canRejoinImported(a, b)) return splitPairs.get(a)!.original;
  if (a.image && b.image && a.image !== b.image)
    throw new Error(
      "Beide Karten enthalten ein Bild. Ordnet eines der Bilder zunächst einer anderen Karte zu. Es wird kein Bild verworfen.",
    );
  if (
    a.table &&
    b.table &&
    JSON.stringify(a.table.headers) !== JSON.stringify(b.table.headers)
  )
    throw new Error(
      "Die Tabellen haben unterschiedliche Spalten. Bitte zuerst im Tabelleneditor anpassen.",
    );
  const table =
    a.table && b.table
      ? {
          ...a.table,
          ...(a.table.caption || b.table.caption
            ? {
                caption: [
                  ...new Set(
                    [a.table.caption, b.table.caption].filter(Boolean),
                  ),
                ].join(" · "),
              }
            : {}),
          rows: [...a.table.rows, ...b.table.rows],
        }
      : (a.table ?? b.table);
  const imageAlt = [...new Set([a.imageAlt, b.imageAlt].filter(Boolean))].join(
    "\n",
  );
  if (imageAlt.length > 300)
    throw new Error(
      "Die gemeinsamen Bildbeschreibungen sind länger als 300 Zeichen. Bitte zuerst bewusst bearbeiten; es wird nichts verworfen.",
    );
  if ((table?.caption?.length ?? 0) > 200)
    throw new Error(
      "Die gemeinsamen Tabellentitel sind länger als 200 Zeichen. Bitte zuerst bewusst bearbeiten; es wird nichts verworfen.",
    );
  return {
    ...a,
    text: [a.text, b.title, b.text].filter(Boolean).join("\n\n"),
    ...(a.source || b.source
      ? {
          source: [...new Set([a.source, b.source].filter(Boolean))].join("\n"),
        }
      : {}),
    ...(a.image || b.image
      ? { image: a.image ?? b.image, ...(imageAlt ? { imageAlt } : {}) }
      : {}),
    ...(table ? { table } : {}),
  };
}
export function validateImportMedia(images: string[]) {
  for (const image of images) inspectDataImage(image);
}
