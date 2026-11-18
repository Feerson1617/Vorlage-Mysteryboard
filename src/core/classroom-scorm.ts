import type { Task } from "./documents";
import { launchJSON, LAUNCH_ID } from "./launch-document";
import ScormWorker from "./classroom-scorm.worker?worker&inline";

let shell: { head: string; script: string; notices: string } | null = null;
// Capture only the trusted, original production bundle, before rendering any
// user content. Never export the live application DOM, previous launch data,
// preview state, forms or author notes. No nested HTML template in the bundle.
export function captureRuntimeShell() {
  const scripts = [
    ...document.querySelectorAll<HTMLScriptElement>('script[type="module"]'),
  ];
  if (
    !__UNIVERSAL__ ||
    __INITIAL_DOCUMENT__ ||
    scripts.length !== 1 ||
    scripts[0].src
  )
    return;
  shell = {
    head: [...document.head.children]
      .filter(
        (e) =>
          e.tagName === "STYLE" ||
          (e.tagName === "META" &&
            e.getAttribute("name") !== "mysteryboard-ocr") ||
          (e.tagName === "LINK" &&
            e.getAttribute("rel") === "icon" &&
            e.getAttribute("href") === "data:,"),
      )
      .map((e) => e.outerHTML)
      .join("\n"),
    script: scripts[0].outerHTML,
    notices: [
      ...document.childNodes,
      ...document.documentElement.childNodes,
      ...document.body.childNodes,
    ]
      .filter((n) => n.nodeType === Node.COMMENT_NODE)
      .map((n) => `<!--${n.textContent}-->`)
      .join("\n"),
  };
}
export function classroomHTML(task: Task) {
  if (!shell)
    throw new Error(
      "Bitte den SCORM-Export in der vollständigen, unveränderten Universal-HTML verwenden.",
    );
  return `<!doctype html>\n<html lang="de"><head>${shell.head}<title>MysteryBoard</title></head><body><div id="root"></div><script id="${LAUNCH_ID}" type="application/json">${launchJSON(task, true)}</script>${shell.script}</body></html>\n${shell.notices}`;
}
export async function classroomScorm(task: Task, signal: AbortSignal) {
  signal.throwIfAborted();
  const html = classroomHTML(task);
  const zip = await new Promise<Uint8Array>((resolve, reject) => {
    const worker = new ScormWorker();
    const finish = (error?: unknown, bytes?: Uint8Array) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      error ? reject(error) : resolve(bytes!);
    };
    const abort = () => finish(signal.reason);
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Der SCORM-Export wurde nach 30 Sekunden beendet. Bitte die Dateigröße verringern.",
          ),
        ),
      30000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) =>
      finish(e.data.error ? new Error(e.data.error) : undefined, e.data.zip);
    worker.onerror = () =>
      finish(new Error("Das SCORM-Paket konnte nicht erstellt werden."));
    worker.postMessage({
      html,
      id: `MysteryBoard-${task.content.id}-${task.content.version}`,
      title: task.content.title,
    });
  });
  signal.throwIfAborted();
  const title =
    task.content.title
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "Mystery";
  return new File(
    [zip as BlobPart],
    `MysteryBoard-${title}-v${task.content.version}-SCORM-1.2.zip`,
    { type: "application/zip" },
  );
}
