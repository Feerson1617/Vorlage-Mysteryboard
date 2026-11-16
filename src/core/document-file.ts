import DocumentWorker from "./document-worker?worker&inline";
import type { MysteryDocument } from "./documents";
import { verifyImageDecode } from "./media";

// One file reader for the student and teacher entry points. Validation and
// potentially expensive decoding finish before the caller replaces any state.
export async function readDocumentFile(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  if (file.size > 30_000_000)
    throw new Error(
      "Die Datei ist größer als 30 MB. Der geöffnete Stand bleibt erhalten.",
    );
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const doc = await new Promise<MysteryDocument>((resolve, reject) => {
    const worker = new DocumentWorker();
    const finish = (error?: unknown, document?: MysteryDocument) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      error ? reject(error) : resolve(document!);
    };
    const abort = () => finish(signal.reason);
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Die Importprüfung wurde nach 15 Sekunden abgebrochen. Bitte die Datei prüfen.",
          ),
        ),
      15000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event) =>
      finish(
        event.data.error ? new Error(event.data.error) : undefined,
        event.data.document,
      );
    worker.onerror = () =>
      finish(new Error("Die Importprüfung konnte nicht ausgeführt werden."));
    worker.postMessage(bytes, [bytes]);
  });
  for (const card of doc.content.cards) {
    signal.throwIfAborted();
    if (card.image) await verifyImageDecode(card.image);
  }
  signal.throwIfAborted();
  return doc;
}
