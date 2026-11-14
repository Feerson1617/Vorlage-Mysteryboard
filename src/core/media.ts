import { parsePng } from "./png";

export const MAX_IMAGE_BYTES = 3_000_000;
export const MAX_IMAGE_PIXELS = 4_000_000;
export const MAX_TOTAL_IMAGE_BYTES = 12_000_000;
export const MAX_TOTAL_IMAGE_PIXELS = 24_000_000;
const fail = (): never => {
  throw new Error(
    "Ungültiges Bild. Erlaubt sind vollständige PNG-, JPEG- oder WebP-Dateien bis 3 MB, 4096 Pixel Kantenlänge und 4 Millionen Bildpunkte.",
  );
};

// Check dimensions before allowing a browser image decoder to allocate pixels.
export function inspectImage(bytes: Uint8Array, expected?: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0,
    mime = "";
  const ascii = (start: number, count: number) =>
    String.fromCharCode(...bytes.subarray(start, start + count));
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, 3) === "PNG") {
    const chunks = parsePng(bytes);
    if (chunks.some((c) => ["acTL", "fcTL", "fdAT"].includes(c.type)))
      return fail();
    width = view.getUint32(16);
    height = view.getUint32(20);
    mime = "image/png";
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return fail();
    let pos = 2;
    while (pos + 4 < bytes.length) {
      if (bytes[pos++] !== 255) return fail();
      while (bytes[pos] === 255) pos++;
      const marker = bytes[pos++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(pos);
      if (length < 2 || pos + length > bytes.length) return fail();
      if ([192, 193, 194].includes(marker)) {
        if (length < 8 || width || height) return fail();
        height = view.getUint16(pos + 3);
        width = view.getUint16(pos + 5);
      }
      pos += length;
    }
  } else if (
    bytes.length >= 30 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    if (view.getUint32(4, true) + 8 !== bytes.length) return fail();
    mime = "image/webp";
    const u24 = (p: number) =>
      bytes[p] + (bytes[p + 1] << 8) + (bytes[p + 2] << 16);
    const type = ascii(12, 4);
    if (type === "VP8X") {
      if (bytes[20] & 2) return fail(); // animated files have a different memory profile
      width = u24(24) + 1;
      height = u24(27) + 1;
    } else if (type === "VP8 ") {
      if (bytes[23] !== 157 || bytes[24] !== 1 || bytes[25] !== 42)
        return fail();
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    } else if (type === "VP8L" && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
    let pos = 12,
      frames = 0;
    while (pos + 8 <= bytes.length) {
      const tag = ascii(pos, 4),
        size = view.getUint32(pos + 4, true),
        data = pos + 8;
      if (data + size > bytes.length || tag === "ANIM" || tag === "ANMF")
        return fail();
      if (tag === "VP8 " || tag === "VP8L") {
        frames++;
        let frameWidth = 0,
          frameHeight = 0;
        if (
          tag === "VP8 " &&
          size >= 10 &&
          bytes[data + 3] === 157 &&
          bytes[data + 4] === 1 &&
          bytes[data + 5] === 42
        ) {
          frameWidth = view.getUint16(data + 6, true) & 16383;
          frameHeight = view.getUint16(data + 8, true) & 16383;
        } else if (tag === "VP8L" && size >= 5 && bytes[data] === 47) {
          const bits = view.getUint32(data + 1, true);
          frameWidth = (bits & 16383) + 1;
          frameHeight = ((bits >>> 14) & 16383) + 1;
        }
        if (frameWidth !== width || frameHeight !== height) return fail();
      }
      pos = data + size + (size % 2);
    }
    if (frames !== 1 || pos !== bytes.length) return fail();
  }
  if (
    !mime ||
    (expected && mime !== expected) ||
    !width ||
    !height ||
    width > 4096 ||
    height > 4096 ||
    width * height > MAX_IMAGE_PIXELS
  )
    return fail();
  return { mime, width, height, bytes: bytes.length };
}
export function inspectDataImage(data: string) {
  if (data.length > 4_000_100) return fail();
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      data,
    );
  if (!match || match[2].length % 4) return fail();
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    return fail();
  }
  return inspectImage(bytes, match[1]);
}
export async function verifyImageDecode(src: string): Promise<void> {
  const info = inspectDataImage(src);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        finish(new Error("Das Bild konnte nicht rechtzeitig gelesen werden.")),
      8000,
    );
    function finish(error?: Error) {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      image.src = "";
      error ? reject(error) : resolve();
    }
    image.onload = () =>
      finish(
        !(
          (image.naturalWidth === info.width &&
            image.naturalHeight === info.height) ||
          (image.naturalWidth === info.height &&
            image.naturalHeight === info.width)
        )
          ? new Error("Das Bild meldet widersprüchliche Abmessungen.")
          : undefined,
      );
    image.onerror = () =>
      finish(
        new Error(
          "Die Bilddatei ist beschädigt und konnte nicht vollständig gelesen werden.",
        ),
      );
    image.src = src;
  });
}
export async function imageFromFile(file: File) {
  if (file.size > MAX_IMAGE_BYTES) return fail();
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf")
    throw new Error(
      "PDF-Seiten bitte zunächst lokal als PNG, JPEG oder WebP exportieren. Ein direkter PDF-Import ist hier nicht verfügbar.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const src = `data:${info.mime};base64,${btoa(binary)}`;
  await verifyImageDecode(src);
  return src;
}
