// Optional diagnostic; an administrative browser restriction is reported OPEN.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
if (!process.argv[2] || !process.argv[3])
  throw new Error("Aufruf: node file-scheme.mjs HTML-DATEI TESTDATEIEN-ORDNER");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const result = {
  browser: browser.version(),
  scope: "actual standalone file URL, followed by offline DOCX/PDF import",
};
try {
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + resolve(process.argv[2]));
  await context.setOffline(true);
  const b = (name) => page.getByRole("button", { name, exact: true });
  await b("Lehrkräfteeditor").click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
  await b("Lehrkräftemodus öffnen").click();
  result.imports = [];
  for (const name of ["B-Word-Medien-Tabelle.docx", "C-PDF-12-Karten.pdf"]) {
    await b("Dokument importieren").click();
    await page
      .getByLabel("Word- oder PDF-Datei", { exact: true })
      .setInputFiles(resolve(process.argv[3], name));
    await page
      .getByRole("heading", { name: "2. Karten prüfen", exact: true })
      .waitFor({ timeout: 45000 });
    await page.waitForFunction(
      () => !document.querySelector(".import-step-body").disabled,
    );
    result.imports.push({
      name,
      cards: await page
        .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
        .locator("option")
        .count(),
    });
    page.once("dialog", (d) => d.accept());
    await b("Zurück zum Entwurf").click();
  }
  result.errors = errors;
  if (
    errors.length ||
    result.imports[0].cards !== 6 ||
    result.imports[1].cards !== 12
  )
    throw new Error(
      "Dokumentimport oder Browserfehler im direkten Dateiaufruf.",
    );
  result.status = "passed";
  await context.close();
} catch (error) {
  result.status = /ERR_BLOCKED_BY_ADMINISTRATOR/.test(error.message)
    ? "open"
    : "failed";
  result.error = error.message;
  if (result.status === "failed") process.exitCode = 1;
} finally {
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}
