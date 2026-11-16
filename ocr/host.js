/* Isolated, disposable owner document for exactly one Tesseract worker.
 * No uploaded bytes are fetched or persisted. No CDN defaults or IDB cache. */
let worker;
let running = false;
const reply = (data) => parent.postMessage(data, location.origin);
addEventListener("message", async (e) => {
  if (e.source !== parent || e.origin !== location.origin) return;
  if (e.data.type === "dispose") {
    worker?.terminate();
    worker = null;
    return;
  }
  if (running) return;
  running = true;
  const { id, type } = e.data;
  try {
    if (type === "start") {
      worker = await Tesseract.createWorker("deu", 1, {
        workerPath: new URL("worker.min.js", location.href).href,
        workerBlobURL: false,
        corePath: new URL("tesseract-core-lstm.wasm.js", location.href).href,
        langPath: new URL(".", location.href).href,
        cacheMethod: "none",
        gzip: true,
        logger: (p) =>
          reply({
            type: "progress",
            id,
            status: p.status,
            progress: p.progress,
          }),
        errorHandler: (message) =>
          reply({ type: "error", id, message: String(message) }),
      });
      await worker.setParameters({ preserve_interword_spaces: "1" });
      reply({ type: "done", id });
    } else if (type === "recognize" && worker) {
      const { data } = await worker.recognize(
        new Uint8Array(e.data.bytes),
        {},
        { text: true, blocks: true },
      );
      reply({ type: "done", id, data });
    }
  } catch (error) {
    reply({ type: "error", id, message: String(error) });
  } finally {
    running = false;
  }
});
addEventListener("pagehide", () => {
  worker?.terminate();
  worker = null;
});
reply({ type: "ready" });
