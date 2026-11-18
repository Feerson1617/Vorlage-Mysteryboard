import mammoth from "mammoth";
import { parseDocument } from "htmlparser2";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.min.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
import assetsZip from "virtual:document-import-assets";
import { unzipSync } from "fflate";
import {
  inspectImage,
  MAX_TOTAL_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_PIXELS,
} from "../media";
import { reviewWord } from "./docx-review";
import { boundedDocx } from "./zip";
import {
  IMPORT_LIMITS,
  proposeCards,
  isCardHeading,
  type Block,
  type ImportResult,
  type ImportFinding,
} from "./model";
import {
  analyzePdf,
  paintedSegments,
  pdfItems,
  regionBlocks,
  regionCard,
  type PdfPage,
  type Segment,
} from "./pdf-layout";
const scope = globalThis as any;
scope.pdfjsWorker = { WorkerMessageHandler };
// Parser assets never use a URL supplied by the document or the network.
const assets = unzipSync(
  Uint8Array.from(atob(assetsZip), (c) => c.charCodeAt(0)),
);
class LocalBinaryData {
  async fetch({ filename }: { filename: string }) {
    const data = assets[filename];
    if (!data) throw new Error("Nicht unterstützte lokale PDF-Ressource.");
    return data.slice();
  }
}
class LocalCanvas {
  create(w: number, h: number) {
    if (w * h > 4_000_000 || w < 1 || h < 1)
      throw new Error("Die PDF-Grafik ist zu groß.");
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(o: any, w: number, h: number) {
    if (w * h > 4_000_000) throw new Error("Die PDF-Grafik ist zu groß.");
    o.canvas.width = w;
    o.canvas.height = h;
  }
  destroy(o: any) {
    if (o.canvas) o.canvas.width = o.canvas.height = 0;
    o.canvas = o.context = null;
  }
  getNoAlphaContext(c: OffscreenCanvas) {
    return c.getContext("2d", { alpha: false });
  }
}
class LocalFilters {
  addFilter() {
    return "none";
  }
  addHCMFilter() {
    return "none";
  }
  addAlphaFilter() {
    return "none";
  }
  addLuminosityFilter() {
    return "none";
  }
  addKnockoutFilter() {
    return "none";
  }
  addHighlightHCMFilter() {
    return "none";
  }
  destroy() {}
}
let pdf: any = null;
let rendering: { cancel: () => void } | null = null;
const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 16384)
    s += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(s);
};
async function imageData(bytes: Uint8Array, mime?: string) {
  const info = inspectImage(bytes, mime);
  const image = await createImageBitmap(
    new Blob([bytes as BlobPart], { type: info.mime }),
  );
  if (image.width * image.height > 4_000_000) {
    image.close();
    throw new Error("Das Bild ist zu groß.");
  }
  image.close();
  return `data:${info.mime};base64,${b64(bytes)}`;
}
type H = {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  data?: string;
  children?: H[];
};
function text(node: H): string {
  if (["script", "style", "iframe", "object", "svg"].includes(node.name ?? ""))
    return "";
  if (node.type === "text") return node.data ?? "";
  if (node.name === "br") return "\n";
  return (
    (node.children ?? []).map(text).join("") +
    (node.name === "p" || node.name === "li" ? "\n" : "")
  );
}
function htmlBlocks(html: string, images: string[]): Block[] {
  const root = parseDocument(html) as unknown as H,
    result: Block[] = [];
  const walk = (node: H) => {
    if (
      ["script", "style", "iframe", "object", "svg"].includes(node.name ?? "")
    )
      return;
    if (node.name === "table") {
      const rows: H[] = [];
      const tr = (n: H) => {
        if (n.name === "tr") rows.push(n);
        else (n.children ?? []).forEach(tr);
      };
      tr(node);
      const values = rows.map((r) =>
        (r.children ?? [])
          .filter((c) => c.name === "td" || c.name === "th")
          .map((c) => text(c).trim()),
      );
      const hasHeader = rows[0]?.children?.some((c) => c.name === "th");
      const merged = rows.some((r) =>
        r.children?.some(
          (c) =>
            Number(c.attribs?.colspan ?? 1) > 1 ||
            Number(c.attribs?.rowspan ?? 1) > 1,
        ),
      );
      if (
        !merged &&
        values.length &&
        values.length <= (hasHeader ? 21 : 20) &&
        values[0].length <= 6 &&
        values.every((r) => r.length === values[0].length) &&
        values.flat().every((v) => v.length <= 120) &&
        values[0].every((v) => v.length <= 80)
      )
        result.push({
          kind: "table",
          text: "",
          table: {
            headers: hasHeader ? values[0] : values[0].map(() => ""),
            rows: hasHeader ? values.slice(1) : values,
          },
        });
      else
        result.push({
          kind: "paragraph",
          text: values.map((r) => r.join("\t")).join("\n"),
        });
      return;
    }
    if (node.name === "img") {
      const image = node.attribs?.src;
      if (image && images.includes(image))
        result.push({
          kind: "image",
          text: "",
          image,
          ...(node.attribs?.alt ? { imageAlt: node.attribs.alt } : {}),
        });
      return;
    }
    if (node.name && /^(h[1-6]|p|li)$/.test(node.name)) {
      const value = text(node).trim();
      if (value)
        result.push({
          kind: node.name.startsWith("h")
            ? "heading"
            : isCardHeading(value)
              ? "heading"
              : node.name === "li"
                ? "list"
                : "paragraph",
          text: value,
        });
      const media = (n: H) => {
        if (n.name === "img") walk(n);
        else (n.children ?? []).forEach(media);
      };
      (node.children ?? []).forEach(media);
      return;
    }
    (node.children ?? []).forEach(walk);
  };
  walk(root);
  return result;
}
async function docx(bytes: Uint8Array, name: string): Promise<ImportResult> {
  let imageBytes = 0,
    imagePixels = 0;
  let mediaLimitError: Error | undefined;
  const bounded = boundedDocx(bytes),
    findings = reviewWord(bounded.files),
    images: string[] = [],
    warnings = [
      "Die Gliederung ist ein Vorschlag. Alle Grenzen, Pflicht-/V-Angaben, Quellen und Medien bitte mit dem Original prüfen.",
      "Word-Ansicht: Absätze, Listen und Tabellen; Seitenumbrüche und komplexe Word-Objekte können abweichen.",
      "Tabellen ohne erkennbare Kopfzeile benötigen vor der Übernahme eigene Spaltenüberschriften. Verbundene oder zu große Tabellen bleiben zunächst als Text erhalten.",
    ];
  const result = await mammoth.convertToHtml(
    { arrayBuffer: bounded.bytes.buffer as ArrayBuffer },
    {
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          if (mediaLimitError) throw mediaLimitError;
          const bytes = new Uint8Array(await image.readAsArrayBuffer());
          const dimensions = inspectImage(bytes, image.contentType);
          imageBytes += bytes.length;
          imagePixels += dimensions.width * dimensions.height;
          if (
            imageBytes > MAX_TOTAL_IMAGE_BYTES ||
            imagePixels > MAX_TOTAL_IMAGE_PIXELS
          ) {
            mediaLimitError = new Error(
              "Die Bilder im Word-Dokument überschreiten insgesamt 12 MB oder 24 Millionen Bildpunkte. Bitte das Dokument aufteilen oder die Bilder vorher verkleinern.",
            );
            throw mediaLimitError;
          }
          const src = await imageData(bytes, image.contentType);
          images.push(src);
          return { src };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith("Die Bilder im Word-Dokument")
          )
            throw error;
          findings.push({
            status: "missing",
            message:
              "Ein Word-Bild fehlt. Als PNG/JPEG/WebP einsetzen oder das Dokument lokal als PDF exportieren.",
          });
          warnings.push(
            "Ein Bild konnte nicht übernommen werden (erlaubt: PNG/JPEG/WebP bis 3 MB). Bitte das Original prüfen und das Bild bei Bedarf ersetzen.",
          );
          return { src: "" };
        }
      }),
    },
  );
  // Mammoth turns image-converter errors into warnings. A document-wide limit
  // must still reject the whole import, rather than silently dropping an image.
  if (mediaLimitError) throw mediaLimitError;
  if (result.messages.length) {
    findings.push({
      status: "review",
      message:
        "Word meldet abweichende Formatierungen oder Verweise. Original vergleichen, bei Abweichungen lokal als PDF exportieren.",
    });
    warnings.push(
      "Einige Word-Formatierungen oder Verweise konnten nicht vollständig dargestellt werden. Bitte das Original vergleichen.",
    );
  }
  const blocks = htmlBlocks(result.value, images);
  if (images.some((image) => !blocks.some((b) => b.image === image)))
    findings.push({
      status: "missing",
      message:
        "Ein eingebettetes Bild ist keiner Karte zugeordnet. Original als PDF exportieren und den Ausschnitt übernehmen.",
    });
  checkBlocks(blocks);
  return {
    format: "docx",
    findings,
    name,
    blocks,
    cards: proposeCards(blocks),
    images,
    warnings,
  };
}
function checkBlocks(blocks: Block[]) {
  if (
    blocks.length > IMPORT_LIMITS.blocks ||
    blocks.reduce((n, b) => n + b.text.length, 0) > IMPORT_LIMITS.textChars
  )
    throw new Error(
      "Das Dokument enthält zu viel Text. Bitte vor dem Import aufteilen.",
    );
}
async function readPdf(
  bytes: Uint8Array,
  name: string,
  studio: boolean,
): Promise<ImportResult> {
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    disableWorkerRendering: true,
    disableRange: true,
    disableAutoFetch: true,
    stopAtErrors: true,
    maxImageSize: 24_000_000,
    canvasMaxAreaInBytes: 16_000_000,
    BinaryDataFactory: LocalBinaryData,
    CanvasFactory: LocalCanvas,
    FilterFactory: LocalFilters,
    verbosity: 0,
  } as any);
  pdf = await task.promise;
  if (pdf.numPages > IMPORT_LIMITS.pages)
    throw new Error(
      "Das PDF hat mehr als 40 Seiten. Bitte vor dem Import aufteilen.",
    );
  const actions = await pdf.getJSActions();
  if (
    actions &&
    (actions instanceof Map ? actions.size : Object.keys(actions).length)
  )
    throw new Error(
      "Dieses PDF enthält aktive Skript-Aktionen und wird nicht importiert. Bitte ein PDF ohne aktive Inhalte verwenden.",
    );
  const pages: { width: number; height: number }[] = [],
    geometryPages: PdfPage[] = [],
    vectors: Segment[][] = [];
  let totalCharacters = 0;
  const omitted: ImportFinding[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    scope.postMessage({
      type: "progress",
      message: `PDF-Seite ${pageNo} von ${pdf.numPages} wird gelesen …`,
    });
    const page = await pdf.getPage(pageNo),
      view = page.getViewport({ scale: 1 });
    if (
      ![view.width, view.height].every(
        (n) => Number.isFinite(n) && n > 0 && n <= 14400,
      )
    )
      throw Error(
        "Die Seitengröße ist nicht sicher verarbeitbar. Bitte lokal auf A4 oder A3 als PDF exportieren.",
      );
    const pageActions = await page.getJSActions();
    if (
      pageActions &&
      (pageActions instanceof Map
        ? pageActions.size
        : Object.keys(pageActions).length)
    )
      throw new Error(
        "Dieses PDF enthält aktive Skript-Aktionen und wird nicht importiert. Bitte ein PDF ohne aktive Inhalte verwenden.",
      );
    pages.push({ width: view.width, height: view.height });
    const reader = page
      .streamTextContent({ includeMarkedContent: false })
      .getReader();
    const items: any[] = [];
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const item of chunk.value.items) {
        if (typeof item.str !== "string" || !item.str.trim()) continue;
        totalCharacters += item.str.length;
        if (totalCharacters > IMPORT_LIMITS.textChars) {
          await reader.cancel();
          throw Error(
            "Das Dokument enthält zu viel Text. Bitte lokal aufteilen.",
          );
        }
        items.push(item);
        if (items.length > 20_000)
          throw new Error(
            "Die PDF-Seite enthält zu viele Textbestandteile. Bitte das Dokument vereinfachen.",
          );
      }
    }
    const graphics: NonNullable<PdfPage["graphics"]> = [];
    const reasons = new Set<string>();
    const ops = await page.getOperatorList();
    vectors.push(paintedSegments(ops, view.transform, graphics, reasons));
    if (view.rotation)
      reasons.add(
        "Gedrehte Seite. Lesereihenfolge und Grenzen am Original vergleichen.",
      );
    const annotations = await page.getAnnotations({ intent: "display" });
    if (annotations.some((a: { subtype?: string }) => a.subtype !== "Link"))
      omitted.push({
        status: "missing",
        page: pageNo,
        message:
          "Anmerkungen oder Formularfelder werden im Kartenbild ausgelassen. Das ausgefüllte Original mit sichtbaren Anmerkungen lokal in ein flaches PDF drucken.",
      });
    geometryPages.push({
      reviewReasons: [...reasons],
      width: view.width,
      height: view.height,
      items: pdfItems(items, view.transform),
      graphics,
    });

    page.cleanup();
  }
  const { layout: pdfLayout, cards } = analyzePdf(geometryPages, vectors);
  const findings: ImportFinding[] = geometryPages.flatMap((p, i) =>
    (p.reviewReasons ?? []).map((message) => ({
      status: "review" as const,
      page: i + 1,
      message,
    })),
  );
  findings.push(...omitted);
  const renderedRegions = new Set<number>();
  let imageBytes = 0,
    imagePixels = 0;
  for (const region of pdfLayout.regions.filter((entry) => entry.graphic)) {
    const card = cards.find((entry) => entry.id === region.cardId)!;
    const imageTitle = `Bildkarte von Seite ${region.page}`;
    const hasText = Boolean(card.title || card.text || card.source);
    // The existing Universal editor retains its editable text/table workflow.
    if (hasText && !studio) {
      delete region.graphic;
      delete region.mediaBounds;
      delete region.wholeCardImage;
      continue;
    }
    if (!hasText) card.title = imageTitle;
    try {
      scope.postMessage({
        type: "progress",
        message: `Bildbereich auf Seite ${region.page} wird übernommen …`,
      });
      const images: string[] = [];
      let bytes = 0,
        pixels = 0;
      for (const bounds of region.mediaBounds ?? [region.bounds]) {
        if (imageBytes + bytes >= MAX_TOTAL_IMAGE_BYTES)
          throw Error("Bildbudget");
        const image = await renderPage(region.page, false, bounds, true);
        const info = inspectImage(
          Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0)),
        );
        bytes += info.bytes;
        pixels += info.width * info.height;
        if (
          imageBytes + bytes > MAX_TOTAL_IMAGE_BYTES ||
          imagePixels + pixels > MAX_TOTAL_IMAGE_PIXELS
        )
          throw Error("Bildbudget");
        images.push(image);
      }
      const existing = card.image
        ? [card.image, ...(card.extraImages ?? []).map((img) => img.src)]
        : [];
      if (existing.length + images.length > 4) throw Error("Zu viele Grafiken");
      imageBytes += bytes;
      imagePixels += pixels;
      if (region.wholeCardImage && hasText) {
        // The rendered original already contains all text, labels and sources.
        // Keep the raw text in the original comparison only.
        renderedRegions.add(region.id);
        findings.push({
          status: "review",
          page: region.page,
          message: `Karte ${card.id} enthält das vollständige Originalbild einschließlich Beschriftungen. Bitte die Lesbarkeit prüfen.`,
        });
      }
      images.unshift(...existing);
      card.image = images[0];
      card.imageAlt = imageTitle;
      if (images.length > 1)
        card.extraImages = images.slice(1).map((src) => ({ src }));
    } catch {
      findings.push({
        status: "missing",
        ...(card.image ? {} : { missingCard: card.id }),
        page: region.page,
        message: `Bild von Karte ${card.id} konnte nicht übernommen werden. Einen kleineren Originalausschnitt wählen oder die Datei lokal aufteilen.`,
      });
      if (!pdfLayout.uncertainPages.includes(region.page))
        pdfLayout.uncertainPages.push(region.page);
    }
  }
  // Rebuild only semantic portions not already present in a whole-frame crop.
  // A card continuing on another page retains the other page's transcription.
  const transcription = {
    ...pdfLayout,
    regions: pdfLayout.regions.filter((r) => !renderedRegions.has(r.id)),
  };
  for (const region of pdfLayout.regions.filter((r) =>
    renderedRegions.has(r.id),
  )) {
    const card = cards.find((c) => c.id === region.cardId)!;
    const remaining = regionCard(transcription, card.id);
    card.title =
      remaining.title ||
      (remaining.text || remaining.source
        ? ""
        : `Bildkarte von Seite ${region.page}`);
    card.text = remaining.text;
    if (remaining.source) card.source = remaining.source;
    else delete card.source;
  }
  const blocks = [
    ...pdfLayout.regions.flatMap((r) => regionBlocks(pdfLayout, r)),
    ...pdfLayout.sections,
  ];
  checkBlocks(blocks);
  const question = pdfLayout.sections.find(
    (b) => b.text.includes("?") && b.text.length <= 300,
  )?.text;
  return {
    format: "pdf",
    findings,
    name,
    blocks,
    cards,
    images: [],
    pages,
    pdfLayout,
    ...(question ? { suggestedTitle: question } : {}),
    noText: !geometryPages.some((p) => p.items.length),
    warnings: [
      ...findings.filter((f) => f.status === "missing").map((f) => f.message),
      ...(pdfLayout.unassignedGraphics?.length
        ? [
            "Grafiken ohne eindeutige Kartenzuordnung wurden zur Kontrolle markiert. Bei Bedarf einen Bereich als Bildkarte ergänzen.",
          ]
        : []),
      ...(pdfLayout.uncertainPages.length
        ? [
            "Auf dieser PDF-Seite könnten mehrere Mystery-Karten stehen. Bitte überprüfe die Aufteilung.",
          ]
        : []),
      "PDF-Reihenfolge und Kartengrenzen sind Vorschläge. Mehrspaltige, gedrehte oder seitenübergreifende Inhalte bitte am Original prüfen.",
      "Grafiken in Textkarten und Tabellen bitte am Original prüfen. Weitere Grafiken können als Seitenausschnitt übernommen werden.",
    ],
  };
}
async function renderPage(
  pageNo: number,
  ocr = false,
  bounds?: { x: number; y: number; width: number; height: number },
  artwork = false,
) {
  if (!pdf) throw new Error("Bitte zuerst ein PDF auswählen.");
  if (typeof OffscreenCanvas === "undefined")
    throw new Error(
      "Die lokale PDF-Bildvorschau benötigt einen neueren Browser. Der Entwurf bleibt erhalten.",
    );
  const page = await pdf.getPage(pageNo),
    original = page.getViewport({ scale: 1 });
  if (
    bounds &&
    (![bounds.x, bounds.y, bounds.width, bounds.height].every(
      Number.isFinite,
    ) ||
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.width < 1 ||
      bounds.height < 1 ||
      bounds.x + bounds.width > original.width + 0.5 ||
      bounds.y + bounds.height > original.height + 0.5)
  )
    throw Error("Ungültiger PDF-OCR-Bereich.");
  const scale = bounds
    ? Math.min(
        4,
        4096 / bounds.width,
        4096 / bounds.height,
        Math.sqrt(
          (artwork ? 1_650_000 : 3_900_000) / (bounds.width * bounds.height),
        ),
      )
    : Math.min(
        ocr ? 3 : 2,
        (ocr ? 2000 : 1400) / original.width,
        Math.sqrt(
          (ocr ? 3_900_000 : 2_000_000) / (original.width * original.height),
        ),
      );
  const viewport = page.getViewport({ scale }),
    canvas = new OffscreenCanvas(
      Math.ceil((bounds?.width ?? original.width) * scale),
      Math.ceil((bounds?.height ?? original.height) * scale),
    );
  const task = page.render({
    canvas,
    canvasContext: canvas.getContext("2d"),
    viewport,
    annotationMode: 0,
    ...(bounds
      ? { transform: [1, 0, 0, 1, -bounds.x * scale, -bounds.y * scale] }
      : {}),
  });
  rendering = task;
  try {
    await task.promise;
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  } finally {
    rendering = null;
  }
  let blob = await canvas.convertToBlob({ type: "image/png" });
  if (blob.size > 3_000_000)
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  const result = new Uint8Array(await blob.arrayBuffer());
  inspectImage(result, blob.type);
  canvas.width = canvas.height = 0;
  return `data:${blob.type};base64,` + b64(result);
}
scope.onmessage = async (event: MessageEvent) => {
  const request = event.data;
  try {
    if (request.type === "cancel-render") {
      rendering?.cancel();
      return;
    }
    if (request.type === "parse") {
      if (pdf) {
        await pdf.destroy();
        pdf = null;
      }
      const result =
        request.format === "docx"
          ? await docx(new Uint8Array(request.bytes), request.name)
          : await readPdf(
              new Uint8Array(request.bytes),
              request.name,
              request.studio === true,
            );
      scope.postMessage({ type: "parsed", id: request.id, result });
    } else if (request.type === "render-region") {
      scope.postMessage({
        type: "rendered-region",
        id: request.id,
        image: await renderPage(
          request.page,
          true,
          request.bounds,
          request.artwork === true,
        ),
      });
    } else if (request.type === "render") {
      scope.postMessage({
        type: "rendered",
        id: request.id,
        page: request.page,
        image: await renderPage(request.page, request.ocr === true),
      });
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      id: request.id,
      message:
        error instanceof Error && error.name === "PasswordException"
          ? "Dieses PDF ist passwortgeschützt. Eine berechtigt geöffnete Kopie lokal ohne Passwort als PDF exportieren."
          : error instanceof Error &&
              /Image exceeded maximum/.test(error.message)
            ? "Die Grafik überschreitet die zulässige Größe. Bitte lokal verkleinern und das PDF erneut exportieren."
            : error instanceof Error &&
                /^(?:Die |Das |Dieses |Bitte |Kein |Nicht |Mehr |Aktive |Unvollständige|Ungültig)/.test(
                  error.message,
                )
              ? error.message +
                (request.type === "parse" &&
                !/bitte|exportier|speicher|verwenden/i.test(error.message)
                  ? " Bitte das Original lokal öffnen und als neue, kleinere PDF- oder DOCX-Datei exportieren."
                  : "")
              : "Die Datei konnte nicht gelesen werden. Bitte überprüfen, ob es sich um eine gültige, unverschlüsselte Word- oder PDF-Datei handelt. Das Original lokal öffnen und erneut als DOCX oder flaches PDF exportieren. Der geöffnete Entwurf bleibt erhalten.",
    });
  }
};
scope.postMessage({ type: "ready" });
