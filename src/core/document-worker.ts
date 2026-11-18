import { readDocument } from "./documents";
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ document: readDocument(new Uint8Array(event.data)) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Die Datei konnte nicht gelesen werden.",
    });
  }
};
