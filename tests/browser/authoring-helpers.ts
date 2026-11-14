import { expect, type Page, type Frame, type TestInfo } from "@playwright/test";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { readDocument } from "../../src/core/documents";
export type UI = Page | Frame;
export const rootPage = (ui: UI): Page => ("page" in ui ? ui.page() : ui);
export const button = (p: UI, name: string) =>
  p.getByRole("button", { name, exact: true });
export async function openUniversal(page: Page) {
  page.setDefaultTimeout(15000);
  await page.context().setOffline(false);
  await page.goto(
    "http://localhost:5174/artifacts/MysteryBoard-Universal.html",
  );
  await page.context().setOffline(true);
}
export async function importMystery(
  page: UI,
  buffer: Buffer,
  name = "datei.mysteryboard",
) {
  await button(page, "Mystery bearbeiten").click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({
      name,
      mimeType: name.endsWith(".png") ? "image/png" : "application/json",
      buffer,
    });
}
export async function getFile(
  page: UI,
  info: TestInfo,
  name: string,
  link = "Datei herunterladen",
) {
  const pending = rootPage(page).waitForEvent("download");
  await page.getByRole("link", { name: link, exact: true }).click();
  const d = await pending,
    path = info.outputPath(name);
  await d.saveAs(path);
  const bytes = await readFile(path);
  await info.attach(name, {
    path,
    contentType: name.endsWith(".png") ? "image/png" : "application/json",
  });
  if (process.env.AUTHORING_EXAMPLES_DIR) {
    await mkdir(process.env.AUTHORING_EXAMPLES_DIR, { recursive: true });
    await copyFile(path, join(process.env.AUTHORING_EXAMPLES_DIR, name));
  }
  return { bytes, document: readDocument(bytes) };
}
export async function createTwelve(page: UI) {
  await button(page, "Eigenes Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").click();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Zwölf Beobachtungen aus dem Autorenmodus");
  await page
    .getByLabel("Untertitel (optional)", { exact: true })
    .fill("Technischer Unterrichtsablauf");
  for (let i = 1; i <= 12; i++) {
    await button(page, "+ Karte hinzufügen").click();
    await page
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill(`Information ${i}`);
    await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(
        `Beobachtung ${i}: Untersucht die Zusammenhänge und begründet eure Vermutungen.`,
      );
    await page
      .getByRole("combobox", { name: "Kartengruppe", exact: true })
      .selectOption(i <= 9 ? "required" : "extension");
    if (i <= 3) {
      await page
        .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
        .setInputFiles(
          resolve(
            `examples/universal/diagramm-${i}.${["png", "jpeg", "webp"][i - 1]}`,
          ),
        );
      await expect(button(page, "Karte übernehmen")).toBeEnabled();
      await page
        .getByLabel("Bildbeschreibung (optional)", { exact: true })
        .fill(`Diagramm ${i} mit Kreis und Legende`);
    }
    await button(page, "Karte übernehmen").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await button(page, "Karte 4 bearbeiten").click();
  await page
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .fill("Nachträglich geprüfter Kartentext 4.");
  await button(page, "Karte übernehmen").click();
}
