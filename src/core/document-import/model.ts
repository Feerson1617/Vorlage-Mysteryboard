import type { Content, Draft } from "../documents";
import { newDraft, reviseDraft } from "../authoring";
import { inspectDataImage } from "../media";
export type Card = Content["cards"][number];
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
      ? { ...a.table, rows: [...a.table.rows, ...b.table.rows] }
      : (a.table ?? b.table);
  return {
    ...a,
    text: [a.text, b.title, b.text].filter(Boolean).join("\n\n"),
    ...(a.source || b.source
      ? { source: [a.source, b.source].filter(Boolean).join("\n") }
      : {}),
    ...(a.image || b.image
      ? { image: a.image ?? b.image, imageAlt: a.imageAlt ?? b.imageAlt }
      : {}),
    ...(table ? { table } : {}),
  };
}
export function validateImportMedia(images: string[]) {
  for (const image of images) inspectDataImage(image);
}
