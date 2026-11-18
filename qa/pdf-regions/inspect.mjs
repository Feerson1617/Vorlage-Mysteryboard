// Black-box inspection of real production bytes. Input PDFs and all output stay
// in the caller's chosen directory; never add private materials to the repo.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
const [htmlPath, output, ...inputs] = process.argv.slice(2);
if (!htmlPath || !output || !inputs.length) throw new Error("HTML OUTPUT_DIR PDF...");
await mkdir(output, { recursive: true });
const html = await readFile(htmlPath);
const server = createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  for (const [index, input] of inputs.entries()) {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } }), page = await context.newPage();
    await page.addInitScript(() => {
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) {
          super(...args);
          this.addEventListener("message", event => { if (event.data?.type === "parsed") window.__parsedImport = event.data.result; });
        }
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await context.setOffline(true);
    const button = name => page.getByRole("button", { name, exact: true });
    await button("Lehrkräfteeditor").tap();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("QA");
    await button("Lehrkräftemodus öffnen").tap();
    await button("Dokument importieren").tap();
    await page.getByLabel("Word- oder PDF-Datei", { exact: true }).setInputFiles(input);
    await page.waitForFunction(() => !!window.__parsedImport, { timeout: 60000 });
    const parsed = await page.evaluate(() => window.__parsedImport);
    await writeFile(join(output, `document-${index + 1}-parsed.json`), JSON.stringify(parsed, null, 2) + "\n");
    await page.locator(".import-step-body").waitFor();
    await button("Original ansehen").tap();
    await page.locator(".import-page > img").waitFor({ state: "visible" });
    for (let n = 1; n <= parsed.pages.length; n++) {
      if (n > 1) await page.getByRole("combobox", { name: "PDF-Seite", exact: true }).selectOption(String(n));
      await page.locator(".import-page > img").waitFor({ state: "visible" });
      await page.locator(".import-page").screenshot({ path: join(output, `document-${index + 1}-page-${n}.png`) });
    }
    console.log(JSON.stringify({ input: basename(input), cards: parsed.cards.length, regions: parsed.pdfLayout?.regions.length ?? null, pages: parsed.pages.length }));
    await context.close();
  }
} finally { await browser.close(); await new Promise(r => server.close(r)); }
