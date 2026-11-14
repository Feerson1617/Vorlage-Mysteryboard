// Optional historical reproduction. Never overwrites an existing output file.
// node reproduce-preview.mjs OLD.html DRAFT.mysteryboard OUTPUT.png
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const [htmlPath, draftPath, output] = process.argv.slice(2);
assert(
  htmlPath && draftPath && output,
  "OLD.html DRAFT.mysteryboard OUTPUT.png angeben",
);
assert(!existsSync(output), "Ausgabedatei existiert bereits");
const bytes = await readFile(htmlPath);
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(bytes);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ hasTouch: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.context().setOffline(true);
  const button = (ui, name) => ui.getByRole("button", { name, exact: true });
  await button(page, "Mystery bearbeiten").tap();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({
      name: "entwurf.mysteryboard",
      mimeType: "application/json",
      buffer: await readFile(draftPath),
    });
  const oldEntry = button(page, "Hilfetext festlegen");
  await oldEntry.or(button(page, "Hilfen bearbeiten")).waitFor();
  await (
    (await oldEntry.count()) ? oldEntry : button(page, "Hilfen bearbeiten")
  ).tap();
  await button(page, "Hilfe aus Schülersicht ansehen").tap();
  const preview = page.getByRole("dialog", {
    name: "Hilfe aus Schülersicht",
    exact: true,
  });
  await button(preview, "Hilfe schließen").tap();
  await button(preview, "Übersicht").waitFor();
  const save = button(preview, "Sichern");
  if (await save.count()) {
    await save.tap();
    const link = preview.getByRole("link", {
      name: "Sicherungsbild herunterladen",
      exact: true,
    });
    await link.waitFor({ timeout: 60000 });
    const pending = page.waitForEvent("download");
    await link.click();
    await (await pending).saveAs(output);
    const png = await readFile(output);
    console.log(
      JSON.stringify(
        {
          bugReproduced: true,
          htmlSha256: createHash("sha256").update(bytes).digest("hex"),
          pngBytes: png.length,
          pngSha256: createHash("sha256").update(png).digest("hex"),
        },
        null,
        2,
      ),
    );
  } else {
    assert.equal(await button(preview, "Menü").count(), 0);
    assert.equal(await preview.locator('input[type="file"]').count(), 0);
    console.log(
      JSON.stringify(
        {
          bugReproduced: false,
          saveUnavailable: true,
          importUnavailable: true,
          htmlSha256: createHash("sha256").update(bytes).digest("hex"),
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
