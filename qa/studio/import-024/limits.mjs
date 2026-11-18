import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "../web-host.mjs";
import { button } from "../controls.mjs";
const [files, out] = process.argv.slice(2).map((p) => resolve(p));
await mkdir(out, { recursive: true });
const server = await host(out),
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
const network = [],
  cases = {};
try {
  const page = await browser.newPage();
  await page.route("**/*", (r) => {
    if (
      /^https?:/.test(r.request().url()) &&
      !r
        .request()
        .url()
        .startsWith(server.origin + "/")
    ) {
      network.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      recentProjects: async () => [],
      projectState: async () => {},
      detachProject: async () => {},
      onSaved: () => () => {},
    };
  });
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await button(page, "Neues Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel").fill("QA");
  await button(page, "Mystery erstellen").click();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Geschützter Arbeitsstand");
  await button(page, "Karte hinzufügen").click();
  await page
    .getByRole("textbox", { name: /Überschrift|Kartenüberschrift/i })
    .fill("Erhaltener Entwurf");
  await page
    .getByRole("textbox", { name: /^Kartentext/ })
    .fill("Unverändert 12,5 mg/l.");
  await button(page, "Karte übernehmen").click();
  for (const [name, source] of Object.entries(
    JSON.parse(await readFile(join(files, "sicherheit.json"))),
  )) {
    await page
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles(
        source.startsWith("tests/") ? resolve(source) : join(files, source),
      );
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 60000 });
    cases[name] = await alert.innerText();
    await button(page, "Zur Pinnwand").click();
    await expect(page.locator(".studio-board [data-card]")).toHaveCount(1);
    await page.locator(".studio-board [data-card]").press("Enter");
    await expect(
      page.getByRole("textbox", { name: /^Kartentext/ }),
    ).toHaveValue("Unverändert 12,5 mg/l.");
    await button(page, "Karte übernehmen").click();
  }
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles(join(files, "Scan-Textebene.pdf"));
  const audit = page.locator(".import-audit");
  await audit.locator("summary").click();
  await expect(audit).toContainText("Seitenfüllendes Bild mit Textebene");
  await expect(button(page, "Fehlenden Bildbereich markieren")).toBeEnabled();
  assert.deepEqual(network, []);
  await writeFile(
    join(out, "Importgrenzen.json"),
    JSON.stringify(
      { passed: true, cases, network, scanTextLayerFlagged: true },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
