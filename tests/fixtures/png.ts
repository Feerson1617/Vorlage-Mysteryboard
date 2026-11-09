import { zlibSync } from "fflate";
import { crc32 } from "../../src/core/png";
export function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(data.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}
export function validPng(width = 1, height = 1, color = [255, 255, 255]) {
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const pixels = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels.set([...color, 255], y * (width * 4 + 1) + 1 + x * 4);
  return Uint8Array.from([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...pngChunk("IHDR", header),
    ...pngChunk("IDAT", zlibSync(pixels)),
    ...pngChunk("IEND", new Uint8Array()),
  ]);
}
// Legal ancillary chunk; image data and every CRC remain valid.
export function paddedPng(size: number) {
  const base = validPng(),
    extra = pngChunk("teSt", new Uint8Array(size - base.length - 12));
  const out = new Uint8Array(size);
  out.set(base.subarray(0, -12));
  out.set(extra, base.length - 12);
  out.set(base.subarray(-12), size - 12);
  return out;
}
