import { QR_LIMIT } from "./codec";
import { unpackDocument } from "./documents";
export function documentQr(bytes: Uint8Array): string | null {
  if (bytes.length > 370) return null;
  const text =
    "MB3:" +
    btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
  return text.length <= QR_LIMIT ? text : null;
}
export function readDocumentQr(text: string) {
  if (/^MB[12]:/.test(text))
    throw new Error(
      "Dieser ältere QR-Code enthält keine Kartentexte. Verwendet ihn mit der ursprünglichen passenden Mystery-HTML.",
    );
  if (text.length > QR_LIMIT || !/^MB3:[A-Za-z0-9_-]+$/.test(text))
    throw new Error(
      "Kein vollständiger MysteryBoard-Code. Bitte die Originaldatei auswählen.",
    );
  const bytes = Uint8Array.from(
    atob(text.slice(4).replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  if (bytes.length < 40 || new DataView(bytes.buffer).getUint32(4) > 1_000_000)
    throw new Error(
      "Der Code ist zu groß oder beschädigt. Bitte die Originaldatei verwenden.",
    );
  return unpackDocument(bytes);
}
