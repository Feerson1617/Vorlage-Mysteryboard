// Chromium measurements only. No inference about physical iPads or total RAM.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(process.argv[2] || ".."),
  output = join(root, "browserpruefung", "ergebnisse", "benchmark");
await mkdir(output, { recursive: true });
const source = {
  baseline: await readFile(join(root, "referenz/Universal-35019c3.html")),
  current: await readFile(join(root, "MysteryBoard-Universal.html")),
};
const server = createServer((q, r) => {
  r.setHeader("Content-Type", "text/html");
  r.end(q.url.startsWith("/baseline") ? source.baseline : source.current);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const report = {
  browser: browser.version(),
  scope:
    "Chromium headless on cloud Linux; V8 heaps only, not total/native/GPU RAM and not a real iPad test",
  runs: { baseline: [], current: [] },
  importPhase: {},
  bytes: { baseline: source.baseline.length, current: source.current.length },
};
async function workerMetric() {
  const browserCdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await browserCdp.send("Target.getTargets");
    const worker = targetInfos.find((t) => t.type === "worker");
    if (worker) {
      const { sessionId } = await browserCdp.send("Target.attachToTarget", {
        targetId: worker.targetId,
        flatten: false,
      });
      let id = 0;
      const request = async (method, params = {}) => {
        const command = ++id;
        const p = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            browserCdp.off("Target.receivedMessageFromTarget", listener);
            reject(new Error("worker metric timeout"));
          }, 5000);
          const listener = (event) => {
            if (event.sessionId !== sessionId) return;
            const message = JSON.parse(event.message);
            if (message.id === command) {
              clearTimeout(timer);
              browserCdp.off("Target.receivedMessageFromTarget", listener);
              resolve(message.result);
            }
          };
          browserCdp.on("Target.receivedMessageFromTarget", listener);
        });
        await browserCdp.send("Target.sendMessageToTarget", {
          sessionId,
          message: JSON.stringify({ id: command, method, params }),
        });
        return p;
      };
      await request("HeapProfiler.collectGarbage");
      const value = await request("Runtime.getHeapUsage");
      await browserCdp.send("Target.detachFromTarget", { sessionId });
      return { workerV8: value };
    }
  } catch (error) {
    return { workerMetricUnavailable: error.message };
  }
  return { workerMetricUnavailable: "no worker target" };
}
try {
  for (let i = 0; i < 5; i++)
    for (const variant of ["baseline", "current"]) {
      const context = await browser.newContext(),
        page = await context.newPage(),
        cdp = await context.newCDPSession(page);
      const start = Date.now();
      await page.goto(origin + "/" + variant + "?run=" + i);
      await page
        .getByRole("button", { name: "Mystery bearbeiten", exact: true })
        .waitFor();
      const ready = Date.now() - start;
      await context.setOffline(true);
      await cdp.send("HeapProfiler.collectGarbage");
      const heap = await cdp.send("Runtime.getHeapUsage");
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0];
        return {
          domContentLoadedMs: n.domContentLoadedEventEnd,
          loadMs: n.loadEventEnd,
        };
      });
      report.runs[variant].push({
        readyMs: ready,
        ...nav,
        mainV8UsedBytes: heap.usedSize,
        mainV8: heap,
        workers: page.workers().length,
      });
      await context.close();
    }
  const context = await browser.newContext(),
    page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  await page.goto(origin + "/current?import");
  await context.setOffline(true);
  const b = (n) => page.getByRole("button", { name: n, exact: true });
  await b("Eigenes Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
  await b("Lehrkräftemodus öffnen").click();
  await b("Dokument importieren").click();
  report.importPhase.workersBeforeFile = page.workers().length;
  const start = Date.now();
  await page
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(join(root, "dateien/B-Word-Medien-Tabelle.docx"));
  await page
    .getByRole("heading", { name: "2. Karten prüfen", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".import-step-body").disabled,
  );
  report.importPhase.fileToReviewMs = Date.now() - start;
  await cdp.send("HeapProfiler.collectGarbage");
  report.importPhase.mainDuringImportV8 = await cdp.send(
    "Runtime.getHeapUsage",
  );
  report.importPhase.mainDuringImportV8Bytes =
    report.importPhase.mainDuringImportV8.usedSize;
  Object.assign(report.importPhase, await workerMetric());
  page.once("dialog", (d) => d.accept());
  await b("Zurück zum Entwurf").click();
  await cdp.send("HeapProfiler.collectGarbage");
  report.importPhase.workersAfterClose = page.workers().length;
  report.importPhase.mainAfterCloseV8 = await cdp.send("Runtime.getHeapUsage");
  report.importPhase.mainAfterCloseV8Bytes =
    report.importPhase.mainAfterCloseV8.usedSize;
  await context.close();
  report.pdfPhases = [];
  for (const filename of ["C-PDF-12-Karten.pdf", "D-PDF-Mehrspaltig.pdf"]) {
    const context = await browser.newContext(),
      page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await page.goto(origin + "/current?pdf=" + filename);
    await context.setOffline(true);
    const b = (name) => page.getByRole("button", { name, exact: true });
    await b("Eigenes Mystery erstellen").click();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
    await b("Lehrkräftemodus öffnen").click();
    await b("Dokument importieren").click();
    const phase = {
      filename,
      workersBeforeFile: page.workers().length,
      wasm: "trusted bundled PDF decoders; V8 backing includes buffers, not a separate native WASM/Canvas RAM measurement",
    };
    const start = Date.now();
    await page
      .getByLabel("Word- oder PDF-Datei", { exact: true })
      .setInputFiles(join(root, "dateien", filename));
    await page
      .getByRole("heading", { name: "2. Karten prüfen", exact: true })
      .waitFor({ timeout: 45000 });
    await page.waitForFunction(
      () => !document.querySelector(".import-step-body").disabled,
    );
    phase.fileToRenderedReviewMs = Date.now() - start;
    await cdp.send("HeapProfiler.collectGarbage");
    phase.mainDuringImportV8 = await cdp.send("Runtime.getHeapUsage");
    Object.assign(phase, await workerMetric());
    page.once("dialog", (d) => d.accept());
    await b("Zurück zum Entwurf").click();
    await cdp.send("HeapProfiler.collectGarbage");
    phase.workersAfterClose = page.workers().length;
    phase.mainAfterCloseV8 = await cdp.send("Runtime.getHeapUsage");
    report.pdfPhases.push(phase);
    await context.close();
  }
  for (const variant of ["baseline", "current"]) {
    const runs = report.runs[variant];
    report.runs[variant + "Median"] = {
      readyMs: [...runs].sort((a, b) => a.readyMs - b.readyMs)[2].readyMs,
      mainV8UsedBytes: [...runs].sort(
        (a, b) => a.mainV8UsedBytes - b.mainV8UsedBytes,
      )[2].mainV8UsedBytes,
    };
  }
  report.status = "measured";
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    join(output, "ERGEBNIS.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
