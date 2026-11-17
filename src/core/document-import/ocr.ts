/** Optional local OCR resources. No engine/model bytes enter the single HTML. */
export type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};
export type OcrData = {
  text: string;
  confidence: number;
  blocks?: {
    paragraphs: {
      lines: { words: OcrWord[]; text: string; bbox: OcrWord["bbox"] }[];
    }[];
  }[];
};
export function ocrBase() {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="mysteryboard-ocr"]',
  );
  if (!meta) return null;
  const url = new URL(meta.content, location.href);
  const sameWebOrigin =
    ["http:", "https:"].includes(url.protocol) &&
    url.origin === location.origin;
  // Electron registers this exact standard, secure, same-app scheme. No file://
  // or arbitrary custom protocol is trusted, and web builds cannot opt into it.
  const sameStudioOrigin =
    location.protocol === "mysteryboard:" &&
    location.host === "app" &&
    url.protocol === "mysteryboard:" &&
    url.host === "app" &&
    !url.username &&
    !url.password;
  if (!sameWebOrigin && !sameStudioOrigin) return null;
  return url;
}
export class LocalOcr {
  private frame: HTMLIFrameElement;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  private id = 0;
  private closed = false;
  private ready: Promise<void>;
  private readyReject!: (error: Error) => void;
  private timeout: ReturnType<typeof setTimeout>;
  private listener!: (event: MessageEvent) => void;
  private abort: () => void;
  constructor(
    private signal: AbortSignal,
    progress: (message: string) => void,
  ) {
    const base = ocrBase();
    if (!base)
      throw Error(
        "Lokale OCR ist in dieser Einzel-HTML nicht enthalten. Bitte das vollständige OCR-Autorenpaket oder die OCR-SCORM-Version öffnen.",
      );
    signal.throwIfAborted();
    this.frame = document.createElement("iframe");
    this.frame.hidden = true;
    this.frame.title = "Lokale OCR-Verarbeitung";
    this.ready = new Promise((resolve, reject) => {
      this.readyReject = reject;
      this.listener = (e) => {
        if (
          e.source !== this.frame.contentWindow ||
          e.origin !== location.origin
        )
          return;
        if (e.data.type === "ready") {
          resolve();
          return;
        }
        if (e.data.type === "progress") {
          progress(
            e.data.status === "recognizing text"
              ? `Text erkennen: ${Math.round((e.data.progress ?? 0) * 100)} %`
              : "Deutsche OCR wird lokal vorbereitet …",
          );
          return;
        }
        const p = this.pending.get(e.data.id);
        if (!p) return;
        if (e.data.type === "error") {
          p.reject(
            Error(
              "Lokale OCR fehlgeschlagen. Lokale Programm- und deutsche Sprachdateien prüfen; gegebenenfalls kleinere Aufnahme verwenden. Der Entwurf bleibt erhalten.",
            ),
          );
          this.pending.delete(e.data.id);
        }
        if (e.data.type === "done") {
          p.resolve(e.data.data);
          this.pending.delete(e.data.id);
        }
      };
      addEventListener("message", this.listener!);
    });
    this.abort = () => this.close();
    signal.addEventListener("abort", this.abort, { once: true });
    this.timeout = setTimeout(
      () =>
        this.close(
          Error(
            "Die lokale OCR konnte innerhalb von 20 Sekunden nicht starten. Bitte die lokalen Programm- und Sprachdateien prüfen.",
          ),
        ),
      20_000,
    );
    this.frame.src = new URL("host.html", base).href;
    document.body.append(this.frame);
  }
  private send(type: string, bytes?: ArrayBuffer): Promise<any> {
    if (this.closed)
      return Promise.reject(new DOMException("OCR abgebrochen", "AbortError"));
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.frame.contentWindow!.postMessage(
        { type, id, ...(bytes ? { bytes } : {}) },
        location.origin,
        bytes ? [bytes] : [],
      );
    });
  }
  async start() {
    await this.ready;
    await this.send("start");
    clearTimeout(this.timeout);
    this.timeout = setTimeout(
      () =>
        this.close(
          Error(
            "Die OCR wurde nach drei Minuten beendet. Bitte die Aufnahme aufteilen.",
          ),
        ),
      180_000,
    );
  }
  async recognize(src: string): Promise<OcrData> {
    this.signal.throwIfAborted();
    // src is produced only by our bounded canvas, never a document URL.
    if (!/^data:image\/(?:png|jpeg);base64,/.test(src))
      throw Error("Ungültige OCR-Bilddaten.");
    const bytes = Uint8Array.from(atob(src.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    return this.send("recognize", bytes.buffer);
  }
  close(error: Error = new DOMException("OCR abgebrochen", "AbortError")) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timeout);
    this.signal.removeEventListener("abort", this.abort);
    removeEventListener("message", this.listener!);
    this.readyReject(error);
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
    this.frame.contentWindow?.postMessage({ type: "dispose" }, location.origin);
    // Removing the owner document also kills a worker still starting up.
    this.frame.remove();
  }
}
export const ocrWords = (data: OcrData) =>
  data.blocks?.flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
  ) ?? [];
