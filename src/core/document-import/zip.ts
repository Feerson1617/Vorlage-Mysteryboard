import { Unzip, UnzipInflate, strFromU8, zipSync } from "fflate";
import { IMPORT_LIMITS } from "./model";
import { crc32 } from "../png";
// Inspect directory before inflation, then count actual streaming output too.
export function boundedDocx(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (v.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }
  if (end < 0 || v.getUint16(end + 4, true) || v.getUint16(end + 6, true))
    throw new Error("Die Word-Datei ist beschädigt oder kein gültiges DOCX.");
  const count = v.getUint16(end + 10, true),
    offset = v.getUint32(end + 16, true);
  if (count > IMPORT_LIMITS.zipEntries || count === 65535)
    throw new Error("Die Word-Datei enthält zu viele Bestandteile.");
  const names = new Set<string>(),
    expected = new Map<string, { size: number; crc: number }>();
  let pos = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || v.getUint32(pos, true) !== 0x02014b50)
      throw new Error("Die Word-Datei ist beschädigt.");
    const flags = v.getUint16(pos + 8, true),
      method = v.getUint16(pos + 10, true),
      packed = v.getUint32(pos + 20, true),
      size = v.getUint32(pos + 24, true),
      n = v.getUint16(pos + 28, true),
      extra = v.getUint16(pos + 30, true),
      comment = v.getUint16(pos + 32, true);
    if (pos + 46 + n + extra + comment > end)
      throw new Error("Ungültiges Word-Archiv.");
    const name = strFromU8(bytes.subarray(pos + 46, pos + 46 + n));
    if (
      names.has(name) ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      flags & 1 ||
      ![0, 8].includes(method)
    )
      throw new Error(
        "Die Word-Datei enthält unzulässige oder verschlüsselte Bestandteile.",
      );
    if (/(?:vbaProject|embeddings\/|\.exe$|\.js$|\.html?$)/i.test(name))
      throw new Error(
        "Aktive oder eingebettete ausführbare Inhalte werden nicht importiert. Bitte eine bereinigte DOCX-Datei verwenden.",
      );
    total += size;
    if (
      total > IMPORT_LIMITS.zipBytes ||
      size > 20_000_000 ||
      (size > 1_000_000 && size > Math.max(packed, 1) * 300)
    )
      throw new Error(
        "Die entpackte Word-Datei ist zu groß oder ungewöhnlich stark komprimiert.",
      );
    names.add(name);
    expected.set(name, { size, crc: v.getUint32(pos + 16, true) });
    pos += 46 + n + extra + comment;
  }
  if (!names.has("word/document.xml") || !names.has("[Content_Types].xml"))
    throw new Error("Kein gültiges Word-DOCX-Dokument.");
  const files: Record<string, Uint8Array> = {};
  let actual = 0;
  const unzip = new Unzip((file) => {
    if (!names.has(file.name))
      throw new Error("Widersprüchliches Word-Archiv.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (err, data, final) => {
      if (err) throw new Error("Die Word-Datei konnte nicht entpackt werden.");
      size += data.length;
      actual += data.length;
      if (actual > IMPORT_LIMITS.zipBytes || size > 20_000_000) {
        file.terminate?.();
        throw new Error("Die entpackte Word-Datei ist zu groß.");
      }
      chunks.push(data);
      if (final) {
        const result = new Uint8Array(size);
        let p = 0;
        for (const c of chunks) {
          result.set(c, p);
          p += c.length;
        }
        files[file.name] = result;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let p = 0; p < bytes.length; p += 4096)
    unzip.push(bytes.subarray(p, p + 4096), p + 4096 >= bytes.length);
  if (Object.keys(files).length !== names.size)
    throw new Error("Unvollständige Word-Datei.");
  for (const [name, b] of Object.entries(files)) {
    const entry = expected.get(name)!;
    if (entry.size !== b.length || entry.crc !== crc32(b))
      throw new Error("Die Word-Datei ist beschädigt (Prüfsumme).");
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      if (b.length > 5_000_000)
        throw new Error(
          "Die Word-Datei enthält einen zu großen XML-Bestandteil. Bitte das Dokument vereinfachen.",
        );
      const text = new TextDecoder("utf-8", { fatal: true }).decode(b);
      if (/<!DOCTYPE|<!ENTITY|<w:altChunk\b/i.test(text))
        throw new Error(
          "Nicht unterstützte aktive oder externe XML-Inhalte in der Word-Datei.",
        );
    }
  }
  return { files, bytes: zipSync(files, { level: 0 }) };
}
