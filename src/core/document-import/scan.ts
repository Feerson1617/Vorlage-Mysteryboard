import { parsePng } from "../png";
import {
  framedRegions,
  analyzePdf,
  type PdfPage,
  type PdfItem,
  type Segment,
  type Rect,
} from "./pdf-layout";
import { ocrWords, type OcrData } from "./ocr";
import { IMPORT_LIMITS, type Card } from "./model";
export const SCAN_LIMITS = {
  bytes: 20_000_000,
  pixels: 24_000_000,
  edge: 12000,
  workingPixels: 4_000_000,
};
export function inspectScan(b: Uint8Array) {
  const fail = (): never => {
    throw Error(
      "Das Foto ist ungültig oder zu groß. Unterstützt werden vollständige PNG-, JPEG- und WebP-Bilder bis 20 MB, 24 Millionen Bildpunkte und 12000 Pixel Kantenlänge. HEIC/HEIF bitte zuerst als JPEG exportieren.",
    );
  };
  if (b.length < 24 || b.length > SCAN_LIMITS.bytes) fail();
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength),
    ascii = (p: number, n: number) =>
      String.fromCharCode(...b.subarray(p, p + n));
  let width = 0,
    height = 0,
    mime = "";
  if (b[0] === 137 && ascii(1, 3) === "PNG") {
    if (parsePng(b).some((c) => ["acTL", "fcTL", "fdAT"].includes(c.type)))
      fail();
    width = v.getUint32(16);
    height = v.getUint32(20);
    mime = "image/png";
  } else if (b[0] === 255 && b[1] === 216) {
    if (b.at(-2) !== 255 || b.at(-1) !== 217) fail();
    let p = 2;
    while (p + 4 < b.length) {
      if (b[p++] !== 255) fail();
      while (b[p] === 255) p++;
      const m = b[p++];
      if (m === 218 || m === 217) break;
      if (m === 1 || (m >= 208 && m <= 215)) continue;
      const n = v.getUint16(p);
      if (n < 2 || p + n > b.length) fail();
      if ([192, 193, 194].includes(m)) {
        if (n < 8 || width) fail();
        height = v.getUint16(p + 3);
        width = v.getUint16(p + 5);
      }
      p += n;
    }
    mime = "image/jpeg";
  } else if (
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP" &&
    v.getUint32(4, true) + 8 === b.length
  ) {
    const tag = ascii(12, 4),
      u24 = (p: number) => b[p] + (b[p + 1] << 8) + (b[p + 2] << 16);
    if (tag === "VP8X") {
      if (b[20] & 2) fail();
      width = u24(24) + 1;
      height = u24(27) + 1;
    } else if (tag === "VP8 " && b.length >= 30) {
      width = v.getUint16(26, true) & 16383;
      height = v.getUint16(28, true) & 16383;
    } else if (tag === "VP8L" && b[20] === 47) {
      const bits = v.getUint32(21, true);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
    let p = 12,
      frames = 0;
    while (p + 8 <= b.length) {
      const t = ascii(p, 4),
        n = v.getUint32(p + 4, true);
      if (p + 8 + n > b.length || t === "ANIM" || t === "ANMF") fail();
      if (t === "VP8 " || t === "VP8L") {
        frames++;
        const at = p + 8;
        let fw = 0,
          fh = 0;
        if (
          t === "VP8 " &&
          n >= 10 &&
          b[at + 3] === 157 &&
          b[at + 4] === 1 &&
          b[at + 5] === 42
        ) {
          fw = v.getUint16(at + 6, true) & 16383;
          fh = v.getUint16(at + 8, true) & 16383;
        } else if (t === "VP8L" && n >= 5 && b[at] === 47) {
          const bits = v.getUint32(at + 1, true);
          fw = (bits & 16383) + 1;
          fh = ((bits >>> 14) & 16383) + 1;
        }
        if (fw !== width || fh !== height) fail();
      }
      p += 8 + n + (n % 2);
    }
    if (p !== b.length || frames !== 1) fail();
    mime = "image/webp";
  } else fail();
  if (
    !width ||
    !height ||
    width > SCAN_LIMITS.edge ||
    height > SCAN_LIMITS.edge ||
    width * height > SCAN_LIMITS.pixels
  )
    fail();
  return { width, height, mime };
}
export type Preparation = {
  angle: number;
  contrast: number;
  mode: "color" | "gray" | "bw";
  crop?: Rect;
};
export const plainPreparation: Preparation = {
  angle: 0,
  contrast: 1,
  mode: "color",
};
export async function prepareScan(
  src: string,
  options: Preparation = plainPreparation,
) {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    const w = image.naturalWidth,
      h = image.naturalHeight;
    if (!w || !h || w * h > SCAN_LIMITS.pixels)
      throw Error("Das Foto benötigt zu viel Speicher.");
    const crop = options.crop ?? { x: 0, y: 0, width: w, height: h };
    if (
      ![
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        options.angle,
        options.contrast,
      ].every(Number.isFinite) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.width < 1 ||
      crop.height < 1 ||
      crop.x + crop.width > w + 0.5 ||
      crop.y + crop.height > h + 0.5 ||
      Math.abs(options.angle) > 360 ||
      options.contrast < 0.5 ||
      options.contrast > 2
    )
      throw Error("Ungültige Bildvorbereitung.");
    const a = (options.angle * Math.PI) / 180,
      c = Math.abs(Math.cos(a)),
      s = Math.abs(Math.sin(a)),
      rw = crop.width * c + crop.height * s,
      rh = crop.width * s + crop.height * c;
    const scale = Math.min(
      1,
      4096 / rw,
      4096 / rh,
      Math.sqrt(SCAN_LIMITS.workingPixels / (rw * rh)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(rw * scale));
    canvas.height = Math.max(1, Math.floor(rh * scale));
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(a);
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        (-crop.width * scale) / 2,
        (-crop.height * scale) / 2,
        crop.width * scale,
        crop.height * scale,
      );
      if (options.mode !== "color" || options.contrast !== 1) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const d = data.data,
            g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          for (let k = 0; k < 3; k++) {
            const value = options.mode === "color" ? d[i + k] : g;
            d[i + k] =
              options.mode === "bw"
                ? value > 150
                  ? 255
                  : 0
                : Math.max(
                    0,
                    Math.min(255, (value - 128) * options.contrast + 128),
                  );
          }
        }
        ctx.putImageData(data, 0, 0);
      }
      return {
        src: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      canvas.width = canvas.height = 0;
    }
  } catch (e) {
    throw Error(
      e instanceof Error && e.message.startsWith("Ungültige")
        ? e.message
        : "Das Foto kann nicht gelesen werden. Bitte eine vollständige PNG-, JPEG- oder WebP-Datei verwenden; HEIC/HEIF gegebenenfalls als JPEG exportieren.",
    );
  } finally {
    image.src = "";
  }
}
/** Small pure pixel pass, no heavy image library; dark long runs become line candidates. */
export function pixelSegments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const dark = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 150;
  };
  const segments: Segment[] = [],
    ink: PdfItem[] = [];
  for (const vertical of [false, true]) {
    const outer = vertical ? width : height,
      inner = vertical ? height : width,
      min = Math.max(40, inner * (vertical ? 0.04 : 0.12));
    for (let at = 0; at < outer; at++) {
      let start = -1,
        last = -1;
      for (let n = 0; n <= inner + 2; n++) {
        const on = n < inner && dark(vertical ? at : n, vertical ? n : at);
        if (on) {
          if (start < 0) start = n;
          last = n;
        }
        if (start >= 0 && !on && n - last > 2) {
          const length = last - start + 1;
          if (length >= min) {
            const line = vertical
              ? { x1: at, y1: start, x2: at, y2: last }
              : { x1: start, y1: at, x2: last, y2: at };
            // Each row can contain several separate frames. Compare against
            // all nearby strokes, not just the most recently visited column.
            // Otherwise a 3px border becomes two overlapping card proposals.
            const old = segments.find(
              (s) =>
                Math.abs(s.x1 - s.x2) < 2 === vertical &&
                Math.abs((vertical ? s.x1 : s.y1) - at) < 4 &&
                Math.abs((vertical ? s.y1 : s.x1) - start) < 5 &&
                Math.abs((vertical ? s.y2 : s.x2) - last) < 5,
            );
            if (!old) segments.push(line);
          } else if (
            !vertical &&
            length >= 2 &&
            length < 30 &&
            at % 5 === 0 &&
            ink.length < 20000
          )
            ink.push({
              x: (start + last) / 2,
              y: at,
              width: 1,
              height: 1,
              baseline: at,
              text: ".",
            });
          start = -1;
        }
      }
    }
  }
  const lines = segments.slice(0, 6000);
  const textInk = ink.filter(
    (p) =>
      !lines.some((l) =>
        Math.abs(l.x1 - l.x2) < 2
          ? Math.abs(p.x - l.x1) < 4 &&
            p.y >= Math.min(l.y1, l.y2) - 3 &&
            p.y <= Math.max(l.y1, l.y2) + 3
          : Math.abs(p.y - l.y1) < 4 &&
            p.x >= Math.min(l.x1, l.x2) - 3 &&
            p.x <= Math.max(l.x1, l.x2) + 3,
      ),
  );
  return { segments: lines, ink: textInk };
}
export async function scanFrames(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  const scale = Math.min(
    1,
    1200 / image.naturalWidth,
    1600 / image.naturalHeight,
  );
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { segments, ink } = pixelSegments(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
    return framedRegions(segments, {
      width: canvas.width,
      height: canvas.height,
      items: ink,
    }).map((b) => ({
      x: b.x / scale,
      y: b.y / scale,
      width: b.width / scale,
      height: b.height / scale,
    }));
  } finally {
    canvas.width = canvas.height = 0;
    image.src = "";
  }
}
export function ocrItems(
  data: OcrData,
  scale = 1,
  offset = { x: 0, y: 0 },
): PdfItem[] {
  return ocrWords(data)
    .filter((w) => w.text.trim())
    .map((w) => ({
      text: w.text,
      x: w.bbox.x0 * scale + offset.x,
      y: w.bbox.y0 * scale + offset.y,
      width: (w.bbox.x1 - w.bbox.x0) * scale,
      height: (w.bbox.y1 - w.bbox.y0) * scale,
      baseline: w.bbox.y1 * scale + offset.y,
    }));
}
export function ocrCard(data: OcrData, id: number): Card {
  const paragraphs =
    data.blocks
      ?.flatMap((b) =>
        b.paragraphs.map((p) =>
          p.lines
            .map((l) => l.text.trim())
            .filter(Boolean)
            .join("\n"),
        ),
      )
      .filter(Boolean) ?? [];
  const text = paragraphs.length ? paragraphs.join("\n\n") : data.text.trim();
  const lines = text.split("\n"),
    title =
      /^(?:(?:Karte|Card|Pflichtkarte|Vertiefungskarte)\s+\S+|V\d+\b)/iu.test(
        lines[0] ?? "",
      )
        ? lines.shift()!.trim()
        : "";
  const source: string[] = [],
    body: string[] = [];
  for (const line of lines) {
    if (/^\s*(Quelle|Quellen|Source)\s*:/i.test(line))
      source.push(line.replace(/^\s*(Quelle|Quellen|Source)\s*:\s*/i, ""));
    else body.push(line);
  }
  return {
    id,
    title,
    text: body.join("\n").trim(),
    group: /^(Vertiefungskarte|V\d)/i.test(title) ? "extension" : "required",
    ...(source.length ? { source: source.join("\n") } : {}),
  };
}
export function fallbackRegions(page: PdfPage) {
  return analyzePdf([page], [[]]).layout.regions.map((r) => r.bounds);
}

export function checkOcrBudget(
  pages: PdfPage[],
  pageIndex: number,
  items: PdfItem[],
) {
  if (
    items.length > 20_000 ||
    pages.reduce(
      (n, p, i) =>
        n +
        (i === pageIndex ? items : p.items).reduce(
          (sum, t) => sum + t.text.length,
          0,
        ),
      0,
    ) > IMPORT_LIMITS.textChars
  )
    throw Error("Zu viele OCR-Textbestandteile. Bitte die Aufnahme aufteilen.");
}
