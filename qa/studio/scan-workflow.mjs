import { expect } from "@playwright/test";
import { resolve, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  button,
  correction,
  simpleImport,
  chooseImportCard,
  saveProject,
} from "./controls.mjs";
export async function scanWorkflow(page, out) {
  await button(page, "Importieren").click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles(resolve("tests/fixtures/ocr/Gerades-Foto.jpg"));
  const picker = page.getByLabel("Importkarte auswählen", { exact: true });
  await expect(picker.locator("option")).toHaveCount(4, { timeout: 240000 });
  await expect(page.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
  );
  await expect(button(page, "Weiter zur Übernahme")).toBeDisabled();
  const texts = [];
  for (let i = 0; i < 4; i++) {
    await chooseImportCard(page, i);
    texts.push(
      await page
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .inputValue(),
    );
  }
  await chooseImportCard(page, 0);
  const corrected =
    texts[0] + "\n\nFachlich kontrolliert: 1912, 1,5 °C und 2,1 mg/l.";
  await page
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .fill(corrected);
  await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
  await chooseImportCard(page, 1);
  await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
  await correction(page, "Kartengrenzen");
  await button(page, "Kartengrenze markieren").click();
  const height = page.getByRole("spinbutton", {
    name: "Höhe (%)",
    exact: true,
  });
  await height.fill(String(Number(await height.inputValue()) - 0.5));
  await button(page, "Grenze aktualisieren und Text neu lesen").click();
  await expect(page.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 240000 },
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await simpleImport(page);
  await expect(
    page.getByRole("checkbox", { name: /Diese OCR-Karte/ }),
  ).not.toBeChecked();
  await expect(button(page, "Weiter zur Übernahme")).toBeDisabled();
  await page.screenshot({
    path: join(out, "Scan-Kartengrenze-korrigiert.png"),
  });
  for (let i = 0; i < 4; i++) {
    await chooseImportCard(page, i);
    if (i === 0) {
      expect(
        await page
          .getByRole("textbox", { name: "Kartentext", exact: true })
          .inputValue(),
      ).toBe(corrected);
      await expect(
        page.getByRole("checkbox", { name: /Diese OCR-Karte/ }),
      ).toBeChecked();
    } else if (i >= 2)
      expect(
        await page
          .getByRole("textbox", { name: "Kartentext", exact: true })
          .inputValue(),
      ).toBe(texts[i]);
    await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
  }
  await expect(button(page, "Weiter zur Übernahme")).toBeEnabled();
  await button(page, "Weiter zur Übernahme").click();
  await page
    .getByRole("radio", {
      name: "Neues Mystery aus dem Dokument erstellen",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", { name: "Mystery-Titel", exact: true })
    .fill("Kontrolliertes Foto-Mystery");
  await page.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
  await button(page, "Karten übernehmen").click();
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(4);
  await saveProject(page);
  await writeFile(
    join(out, "Scan-Workflow.json"),
    JSON.stringify(
      {
        passed: true,
        cards: 4,
        automaticLocalOCR: true,
        boundaryCorrection: true,
        affectedReviewInvalidated: true,
        unrelatedCardCorrectionAndReviewsRetained: true,
        remainingTwoTextsUnchanged: true,
        uncheckedCannotProceed: true,
      },
      null,
      2,
    ),
  );
  return corrected;
}
