import { zlibSync, unzlibSync } from "fflate";
import { sha256 } from "@noble/hashes/sha2.js";
import { validateWork, validTeamName, type Mystery, type Work } from "./model";
export const QR_LIMIT = 500; // ASCII bytes including prefix; EC M, at most version 17.
const MAX_RAW = 1_000_000,
  MAX_PACKED = 500_000,
  MAX_WITH_TEXT = 4_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function packWork(work: Work): Uint8Array {
  if (
    (work.schema !== 1 && work.schema !== 2 && work.schema !== 3) ||
    (work.schema === 1 && work.team !== undefined) ||
    (work.schema === 2 && !validTeamName(work.team)) ||
    (work.schema === 3
      ? !work.textEdits?.length ||
        (work.team !== undefined && !validTeamName(work.team))
      : work.textEdits !== undefined)
  )
    throw new Error(
      "Der Arbeitsstand enthält einen ungültigen Teamnamen oder ein unpassendes Speicherformat.",
    );
  const compact = [
    work.schema,
    work.mystery,
    work.version,
    work.cards.map((c) => [c.id, c.x, c.y, c.color]),
    work.edges.map((e) => [e.id, e.from, e.to, e.direction, e.label]),
    work.categories,
    ...(work.schema === 1 ? [] : [work.team ?? null]),
    ...(work.schema === 3 ? [work.textEdits] : []),
  ];
  const raw = encoder.encode(JSON.stringify(compact));
  if (raw.length > (work.schema === 3 ? MAX_WITH_TEXT : MAX_RAW))
    throw new Error("Dieser Arbeitsstand ist zu groß.");
  const compressed = zlibSync(raw, { level: 9 });
  const result = new Uint8Array(40 + compressed.length);
  // Format 1 remains byte-identical for unnamed legacy work. Older readers
  // reject format 2 instead of silently losing a saved team name.
  result.set([77, 66, 83, work.schema]);
  new DataView(result.buffer).setUint32(4, raw.length);
  result.set(sha256(raw), 8);
  result.set(compressed, 40);
  return result;
}
export function unpackWork(bytes: Uint8Array, mystery: Mystery): Work {
  try {
    const schema = bytes[3];
    if (
      bytes.length < 41 ||
      bytes.length > (schema === 3 ? MAX_WITH_TEXT : MAX_PACKED) ||
      bytes[0] !== 77 ||
      bytes[1] !== 66 ||
      bytes[2] !== 83 ||
      (schema !== 1 && schema !== 2 && schema !== 3)
    )
      throw new Error();
    const size = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(4);
    if (size < 1 || size > (schema === 3 ? MAX_WITH_TEXT : MAX_RAW))
      throw new Error();
    // Fixed output buffer bounds decompression memory, even for malicious compressed data.
    const raw = unzlibSync(bytes.subarray(40), { out: new Uint8Array(size) });
    const hash = sha256(raw);
    if (raw.length !== size || !hash.every((b, i) => b === bytes[i + 8]))
      throw new Error();
    const c: unknown = JSON.parse(decoder.decode(raw));
    if (
      !Array.isArray(c) ||
      c[0] !== schema ||
      c.length !== 5 + schema ||
      !Array.isArray(c[3]) ||
      !Array.isArray(c[4]) ||
      !c[3].every((x: unknown) => Array.isArray(x) && x.length === 4) ||
      !c[4].every((x: unknown) => Array.isArray(x) && x.length === 5)
    )
      throw new Error();
    return validateWork(
      {
        schema: c[0],
        mystery: c[1],
        version: c[2],
        cards: c[3].map((x: unknown[]) => ({
          id: x[0],
          x: x[1],
          y: x[2],
          color: x[3],
        })),
        edges: c[4].map((x: unknown[]) => ({
          id: x[0],
          from: x[1],
          to: x[2],
          direction: x[3],
          label: x[4],
        })),
        categories: c[5],
        ...(schema > 1 && c[6] !== null ? { team: c[6] } : {}),
        ...(schema === 3 ? { textEdits: c[7] } : {}),
      },
      mystery,
    );
  } catch (e) {
    if (
      e instanceof Error &&
      /Mystery|Speicherformat|Arbeitsstand/.test(e.message)
    )
      throw e;
    throw new Error("Die Sicherung ist beschädigt oder unvollständig.");
  }
}
export function toQr(bytes: Uint8Array): string | null {
  // MB3: belongs to the self-contained document codec. MBS3 is PNG-only.
  if (bytes[3] === 3) return null;
  if (bytes[3] !== 1 && bytes[3] !== 2)
    throw new Error("Dieses Speicherformat wird nicht unterstützt.");
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const text =
    `MB${bytes[3]}:` +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return text.length <= QR_LIMIT ? text : null;
}
export function fromQr(text: string, mystery: Mystery): Work {
  if (text.length > QR_LIMIT || !/^MB[12]:[A-Za-z0-9_-]+$/.test(text))
    throw new Error(
      "Dieser Code ist keine vollständige MysteryBoard-Sicherung.",
    );
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(
      atob(text.slice(4).replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
  } catch {
    throw new Error("Der Code ist beschädigt oder unvollständig.");
  }
  if (bytes[3] !== Number(text[2]))
    throw new Error("Der Code enthält ein widersprüchliches Speicherformat.");
  return unpackWork(bytes, mystery);
}
