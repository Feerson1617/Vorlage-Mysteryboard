import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { expect } from "@playwright/test";
import {
  button,
  chooseImportCard,
  correction,
  openExports,
  saveProject,
  simpleImport,
} from "../controls.mjs";
export async function roundtrip(page, id, spec, fixtures, out) {
  // Only the file chooser is supplied by the test host. App encoding, loading,
  // publishing and writing the learner ZIP run through the production controls.
  if (spec.warning) {
    page.once("dialog", (d) => d.accept());
    await button(page, "Zur Pinnwand").click();
    await expect(button(page, "Karte hinzufügen")).toBeVisible();
    await page
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles(join(fixtures, id + "-Druck.pdf"));
    await expect(page.getByLabel("PDF-Seite", { exact: true })).toHaveValue(
      "1",
    );
    await expect(page.locator(".import-step-body")).toBeEnabled();
    // Preserve the actual printed header, text box/chart, table and photo as a
    // single original page, explicitly replacing the Word layout suggestions.
    const initial = await page
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count();
    if (!(await page.locator(".import-audit").evaluate((d) => d.open)))
      await page.locator(".import-audit summary").click();
    await button(page, "Fehlenden Bildbereich markieren").click();
    await button(
      page,
      "Markierten Ausschnitt als Bildkarte übernehmen",
    ).click();
    await expect(
      page
        .getByLabel("Importkarte auswählen", { exact: true })
        .locator("option"),
    ).toHaveCount(initial + 1);
    for (let i = 0; i < initial; i++) {
      await chooseImportCard(page, i);
      await correction(page, "Kartenstruktur");
      await page
        .getByRole("checkbox", { name: "Diese Karte übernehmen", exact: true })
        .uncheck();
    }
    await chooseImportCard(page, initial);
    await expect(page.locator(".import-cards img").first()).toBeVisible();
  }
  if (spec.sections) {
    await button(page, "Separate Texte prüfen").click();
    await button(
      page,
      "Abschnitt „Ziel“ als Aufgabenstellung übernehmen",
    ).click();
  }
  if (spec.ocr) {
    const total = await page
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count();
    for (let i = 0; i < total; i++) {
      await chooseImportCard(page, i);
      const field = page.getByRole("textbox", { name: /^Kartentext/ });
      if (!(await field.inputValue()).trim())
        throw Error("OCR card missing text; inspect original");
      await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
    }
  }
  if (await button(page, "Zur einfachen Ansicht").isVisible())
    await simpleImport(page);
  await button(page, "Weiter zur Übernahme").click();
  await page
    .getByLabel("Mystery-Titel")
    .last()
    .fill("Kontrolliertes Material " + id);
  await page.getByLabel(/Ich habe Texte, Grenzen, Bilder/).check();
  await button(page, "Karten übernehmen").click();
  await expect(page.locator(".studio-board [data-card]").first()).toBeVisible();
  const count = await page.locator(".studio-board [data-card]").count();
  await saveProject(page);
  const project = JSON.parse(await readFile(join(out, id + ".mysteryboard")));
  assert.equal(project.content.cards.length, count);
  if (spec.sections) {
    assert.equal(count, spec.count);
    assert.equal(
      project.content.instructions,
      "Ziel: Vergleicht die Messwerte.",
    );
  }
  await button(page, "Zur Projektübersicht").click();
  await button(page, "Mystery öffnen").click();
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(count);
  await openExports(page);
  await button(page, "Für itslearning exportieren").click();
  await expect
    .poll(async () => {
      try {
        return !!unzipSync(await readFile(join(out, id + ".zip")))["app.html"];
      } catch {
        return false;
      }
    })
    .toBe(true);
  const zip = unzipSync(await readFile(join(out, id + ".zip")));
  const html = Buffer.from(zip["app.html"]).toString();
  const payload = JSON.parse(
    html.match(
      /<script id="mysteryboard-launch" type="application\/json">([^<]+)<\/script>/,
    )[1],
  );
  const task = JSON.parse(Buffer.from(payload.task, "base64"));
  assert.deepEqual(task.content, project.content);
  assert.match(
    Buffer.from(zip["imsmanifest.xml"]).toString(),
    /<schemaversion>1\.2<\/schemaversion>/,
  );
  if (spec.warning) {
    assert.equal(count, 1);
    assert(task.content.cards[0].image);
  }
  return {
    savedReopened: true,
    scormContentMatchesProject: true,
    publishedCards: count,
  };
}
