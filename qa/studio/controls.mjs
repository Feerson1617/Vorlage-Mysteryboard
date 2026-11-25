import { expect } from "@playwright/test";
export const button = (page, name) =>
  page.getByRole("button", { name, exact: true });
export async function overview(page) {
  const back = button(page, "Zur Projektübersicht");
  if (await back.count()) await back.click();
}
export async function openExports(page) {
  if (
    !(await page
      .getByRole("dialog", { name: "Speichern und exportieren", exact: true })
      .count())
  )
    await button(page, "Exportieren").click();
}
export async function closeExports(page) {
  const dialog = page.getByRole("dialog", {
    name: "Speichern und exportieren",
    exact: true,
  });
  if (await dialog.count()) await button(dialog, "Schließen").click();
}
export async function saveProject(page, saveAs = false) {
  await openExports(page);
  await button(
    page,
    saveAs ? "Speichern unter …" : "Bearbeitbares Mystery sichern",
  ).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Projekt gespeichert." }),
  ).toBeVisible();
  await closeExports(page);
}
export async function correction(page, category) {
  if (await button(page, "Erkennung korrigieren").count())
    await button(page, "Erkennung korrigieren").click();
  await button(page, category).click();
}
export async function simpleImport(page) {
  if (await button(page, "Zur einfachen Ansicht").count())
    await button(page, "Zur einfachen Ansicht").click();
}
export async function chooseImportCard(page, index) {
  await correction(page, "Kartenstruktur");
  await page
    .getByLabel("Importkarte auswählen", { exact: true })
    .selectOption(String(index));
  await simpleImport(page);
}

export async function compactBackup(ui) {
  if (!(await button(ui, "Export").count())) {
    // Historical reference player.
    await button(ui, "Menü").click();
    await button(ui, "Kleineres Sicherungsbild").click();
    return;
  }
  await button(ui, "Export").click();
  const details = ui.locator("details.export-details");
  await expect(ui.getByAltText("Vorschau des Sicherungsbildes")).toBeVisible({timeout:60000});
  if (await details.count()) {
    await details.locator("summary").click();
    if (await button(details, "Kleineres Bild erzeugen").count()) {
      await button(details, "Kleineres Bild erzeugen").click();
      await expect(details).toContainText("2480 × 1754",{timeout:60000});
      if (!(await details.evaluate(el => el.open))) await details.locator("summary").click();
    }
    await expect(details).toContainText("2480 × 1754");
  } else {
    await button(ui, "Kleineres Bild erzeugen").click();
  }
}
