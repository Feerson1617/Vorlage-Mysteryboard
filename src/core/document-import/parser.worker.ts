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
import { boundedDocx } from "./zip";
import {
  IMPORT_LIMITS,
  proposeCards,
  isCardHeading,
  type Block,
  type ImportResult,
} from "./model";
import {
  analyzePdf,
  paintedSegments,
  pdfItems,
  regionBlocks,
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
  if (result.messages.length)
    warnings.push(
      "Einige Word-Formatierungen oder Verweise konnten nicht vollständig dargestellt werden. Bitte das Original vergleichen.",
    );
  const blocks = htmlBlocks(result.value, images);
  checkBlocks(blocks);
  return {
    format: "docx",
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
async function readPdf(bytes: Uint8Array, name: string): Promise<ImportResult> {
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
    maxImageSize: 4_000_000,
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
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    scope.postMessage({
      type: "progress",
      message: `PDF-Seite ${pageNo} von ${pdf.numPages} wird gelesen …`,
    });
    const page = await pdf.getPage(pageNo),
      view = page.getViewport({ scale: 1 });
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
    let chars = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const item of chunk.value.items) {
        if (typeof item.str !== "string" || !item.str.trim()) continue;
        chars += item.str.length;
        if (chars > IMPORT_LIMITS.textChars) {
          await reader.cancel();
          throw new Error("Die PDF-Seite enthält zu viel Text.");
        }
        items.push(item);
        if (items.length > 20_000)
          throw new Error(
            "Die PDF-Seite enthält zu viele Textbestandteile. Bitte das Dokument vereinfachen.",
          );
      }
    }
    geometryPages.push({
      width: view.width,
      height: view.height,
      items: pdfItems(items, view.transform),
    });
    // Read vector geometry once, never rasterize pages for card detection.
    vectors.push(paintedSegments(await page.getOperatorList(), view.transform));
    page.cleanup();
  }
  const { layout: pdfLayout, cards } = analyzePdf(geometryPages, vectors);
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
    name,
    blocks,
    cards,
    images: [],
    pages,
    pdfLayout,
    ...(question ? { suggestedTitle: question } : {}),
    noText: !geometryPages.some((p) => p.items.length),
    warnings: [
      ...(pdfLayout.uncertainPages.length
        ? [
            "Auf dieser PDF-Seite könnten mehrere Mystery-Karten stehen. Bitte überprüfe die Aufteilung.",
          ]
        : []),
      "PDF-Reihenfolge und Kartengrenzen sind Vorschläge. Mehrspaltige, gedrehte oder seitenübergreifende Inhalte bitte am Original prüfen.",
      "PDF-Bilder und Tabellen werden nicht fachlich zugeordnet. Gewünschte Grafiken als Seitenausschnitt übernehmen; Tabellen bei Bedarf manuell bearbeiten.",
    ],
  };
}
async function renderPage(pageNo: number) {
  if (!pdf) throw new Error("Bitte zuerst ein PDF auswählen.");
  if (typeof OffscreenCanvas === "undefined")
    throw new Error(
      "Die lokale PDF-Bildvorschau benötigt einen neueren Browser. Der Entwurf bleibt erhalten.",
    );
  const page = await pdf.getPage(pageNo),
    original = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2,
    1400 / original.width,
    Math.sqrt(2_000_000 / (original.width * original.height)),
  );
  const viewport = page.getViewport({ scale }),
    canvas = new OffscreenCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
  await page.render({
    canvas,
    canvasContext: canvas.getContext("2d"),
    viewport,
    annotationMode: 0,
  }).promise;
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
    if (request.type === "parse") {
      if (pdf) {
        await pdf.destroy();
        pdf = null;
      }
      const result =
        request.format === "docx"
          ? await docx(new Uint8Array(request.bytes), request.name)
          : await readPdf(new Uint8Array(request.bytes), request.name);
      scope.postMessage({ type: "parsed", id: request.id, result });
    } else if (request.type === "render") {
      scope.postMessage({
        type: "rendered",
        id: request.id,
        page: request.page,
        image: await renderPage(request.page),
      });
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      id: request.id,
      message:
        error instanceof Error &&
        /^(?:Die |Das |Dieses |Bitte |Kein |Nicht |Mehr |Aktive |Unvollständige|Ungültig)/.test(
          error.message,
        )
          ? error.message
          : "Die Datei konnte nicht gelesen werden. Bitte überprüfen, ob es sich um eine gültige, unverschlüsselte Word- oder PDF-Datei handelt. Der geöffnete Entwurf bleibt erhalten.",
    });
  }
};
scope.postMessage({ type: "ready" });
