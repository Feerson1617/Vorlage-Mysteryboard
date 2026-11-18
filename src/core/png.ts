import { packWork, unpackWork } from "./codec";
import type { Mystery, Work } from "./model";
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_CHUNKS = 10_000;
const CHUNK = "mySt"; // private, ancillary, safe-to-copy PNG chunk
export const MAX_PNG_BYTES = 30_000_000;
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}
export function parsePng(bytes: Uint8Array) {
  const bad = () => {
    throw new Error("Das Bild ist keine vollständige, unveränderte PNG-Datei.");
  };
  if (
    bytes.length < 45 ||
    bytes.length > MAX_PNG_BYTES ||
    !SIGNATURE.every((b, i) => bytes[i] === b)
  )
    return bad();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    parts: { type: string; start: number; end: number; data: Uint8Array }[] =
      [];
  let pos = 8,
    ended = false,
    hasData = false;
  while (pos < bytes.length) {
    if (parts.length >= MAX_PNG_CHUNKS) return bad();
    if (pos + 12 > bytes.length) return bad();
    const len = view.getUint32(pos),
      end = pos + 12 + len;
    if (end > bytes.length) return bad();
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (
      !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) ||
      crc32(bytes.subarray(pos + 4, end - 4)) !== view.getUint32(end - 4)
    )
      return bad();
    if (parts.length === 0 && (type !== "IHDR" || len !== 13)) return bad();
    if (type === "IHDR" && parts.length > 0) return bad();
    if (type === "IDAT") hasData = true;
    parts.push({
      type,
      start: pos,
      end,
      data: bytes.subarray(pos + 8, end - 4),
    });
    pos = end;
    if (type === "IEND") {
      if (len !== 0 || pos !== bytes.length || !hasData) return bad();
      ended = true;
      break;
    }
  }
  if (!ended) return bad();
  return parts;
}
export function embedWork(png: Uint8Array, work: Work): Uint8Array {
  return embedPayload(png, packWork(work));
}
export function embedPayload(png: Uint8Array, payload: Uint8Array): Uint8Array {
  const parts = parsePng(png).filter((p) => p.type !== CHUNK);
  if (parts.length + 1 > MAX_PNG_CHUNKS)
    throw new Error(
      "Das Bild enthält zu viele Datenblöcke für eine vollständige Sicherung.",
    );
  const extra = chunk(CHUNK, payload);
  // A replacement removes the old block before counting the new one. Reject
  // before allocation so every offered result obeys the importer's own limit.
  const finalSize =
    8 + parts.reduce((s, p) => s + p.end - p.start, 0) + extra.length;
  if (finalSize > MAX_PNG_BYTES) {
    throw new Error(
      "Das Sicherungsbild ist einschließlich Arbeitsstand größer als 30 MB.",
    );
  }
  const out = new Uint8Array(finalSize);
  out.set(SIGNATURE);
  let offset = 8;
  for (const p of parts) {
    if (p.type === "IEND") {
      out.set(extra, offset);
      offset += extra.length;
    }
    out.set(png.subarray(p.start, p.end), offset);
    offset += p.end - p.start;
  }
  return out;
}
export function restorePng(png: Uint8Array, mystery: Mystery): Work {
  return unpackWork(extractPayload(png), mystery);
}
export function extractPayload(png: Uint8Array): Uint8Array {
  const parts = parsePng(png).filter((p) => p.type === CHUNK);
  if (parts.length === 0)
    throw new Error(
      "Dieses Bild enthält keinen Arbeitsstand. Wähle die ursprüngliche Sicherungsdatei. Ein Bildschirmfoto reicht nicht aus; einen sichtbaren Code kannst du mit der Kamera scannen.",
    );
  if (parts.length !== 1)
    throw new Error("Das Bild enthält widersprüchliche Sicherungsdaten.");
  return parts[0].data;
}
