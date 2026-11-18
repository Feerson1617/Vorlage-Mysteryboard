// Black-box screenshots and viewport checks from the actual delivery bytes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { unzipSync } from "fflate";
import { parseDocument } from "htmlparser2";
const root = resolve(process.argv[2]);
const html = await readFile(join(root, "MysteryBoard-Universal.html"));
const files = unzipSync(await readFile(join(root, "MysteryBoard-Zwoelf-Beobachtungen-SCORM-1.2.zip")));
let bootstrap;
function visit(node) {
  if (node.name === "script" && node.attribs?.id === "mysteryboard-launch")
    bootstrap = JSON.parse(node.children.map(c => c.data ?? "").join(""));
  for (const child of node.children ?? []) visit(child);
}
visit(parseDocument(Buffer.from(files["app.html"]).toString()));
const server = createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const output = join(root, "screenshots");
await mkdir(output, { recursive: true });
const report = [];
try {
  for (const [width, height] of [[1024, 768], [768, 1024], [600, 800], [320, 700]]) {
    const context = await browser.newContext({ hasTouch: true, viewport: { width, height } }), page = await context.newPage();
    const external = [], errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:")) external.push(r.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await context.setOffline(true);
    const button = name => page.getByRole("button", { name, exact: true });
    assert.deepEqual(await page.locator("main.universal-welcome button").allTextContents(), ["Aufgabe öffnen", "Arbeit fortsetzen", "Lehrkräfteeditor"]);
    await page.screenshot({ path: join(output, `start-${width}x${height}.png`) });
    await button("Lehrkräfteeditor").tap();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("QA");
    await button("Vorhandenes Mystery öffnen").tap();
    await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({ name: "echte-browseraufgabe.mysteryboard", mimeType: "application/json", buffer: Buffer.from(bootstrap.task, "base64") });
    await page.getByLabel("Mystery-Titel", { exact: true }).waitFor({ state: "visible" });
    await page.screenshot({ path: join(output, `import-editor-${width}x${height}.png`), fullPage: true });
    const editorWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(editorWidth <= width + 1, `Editor overflow ${editorWidth} > ${width}`);
    await button("Schülerversion erstellen").tap();
    const scorm = button("Für itslearning als SCORM herunterladen");
    await scorm.scrollIntoViewIfNeeded();
    assert(await scorm.isVisible());
    const box = await scorm.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1);
    await page.screenshot({ path: join(output, `bereitstellen-${width}x${height}.png`) });
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    report.push({ width, height, threeStartButtons: true, directTeacherImport: true, editorWidth, scormButtonReachable: true, externalRequests: external, errors });
    await context.close();
  }
  await writeFile(join(output, "viewport-checks.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
