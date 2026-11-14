import { test, expect } from "@playwright/test";
import { METHOD_PRESETS } from "../../src/core/help-authoring";
import { readFile } from "node:fs/promises";
import source from "../../examples/universal/content.json" with { type: "json" };
import { taskDocument, encodeDocument } from "../../src/core/documents";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
} from "./authoring-helpers";
test.use({ hasTouch: true });

test("gleich gemeinte Gruppennamen mit Großschreibung und Leerzeichen werden vor Übernahme und Veröffentlichung abgefangen", async ({
  page,
}, info) => {
  await openUniversal(page);
  await importMystery(
    page,
    await readFile("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
  );
  await button(page, "Hilfen bearbeiten").tap();
  for (const [i, label] of ["Ursachen", " Ursachen ", "ursachen"].entries())
    await page
      .getByRole("textbox", { name: `Name Gruppe ${i + 1}`, exact: true })
      .fill(label);
  await button(page, "Hilfe übernehmen").tap();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 2000 });
  await expect(
    page.getByRole("textbox", { name: "Name Gruppe 2", exact: true }),
  ).toHaveValue(" Ursachen ");
  await page.screenshot({
    path: info.outputPath("doppelte-gruppennamen.png"),
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Name Gruppe 2", exact: true })
    .fill("Prozesse");
  await page
    .getByRole("textbox", { name: "Name Gruppe 3", exact: true })
    .fill("Folgen");
  await button(page, "Hilfe übernehmen").tap();
  await button(page, "Schülerversion erstellen").tap();
  const saved = await getFile(
    page,
    info,
    "eindeutige-gruppennamen.mysteryboard",
  );
  expect(saved.document.content.help?.categories?.map((g) => g.label)).toEqual([
    "Ursachen",
    "Prozesse",
    "Folgen",
  ]);
});

test("alle fünf Denkimpulse bleiben nach eigener Änderung, Vorlagenwechsel und frischer Entwurfsöffnung erhalten", async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const input = await readFile(
    "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  );
  for (const [index, [name, text]] of METHOD_PRESETS.entries()) {
    const ctx = await browser.newContext({ hasTouch: true }),
      page = await ctx.newPage();
    await openUniversal(page);
    await importMystery(page, input);
    await button(page, "Hilfen bearbeiten").tap();
    await page
      .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
      .selectOption(String(index));
    await expect(
      page.getByRole("textbox", { name: "Hilfetext", exact: true }),
    ).toHaveValue(text);
    const own = text + " Eigener Zusatz " + (index + 1) + ".";
    await page
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill(own);
    await page
      .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
      .selectOption(String((index + 1) % 5));
    await page
      .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
      .selectOption("custom");
    await expect(
      page.getByRole("textbox", { name: "Hilfetext", exact: true }),
    ).toHaveValue(own);
    await button(page, "Hilfe übernehmen").tap();
    await button(page, "Entwurf sichern").tap();
    const saved = await getFile(
      page,
      info,
      `denkimpuls-${index + 1}.mysteryboard`,
    );
    expect(saved.document.content.help?.method).toBe(own);
    await ctx.close();
    const fresh = await browser.newContext({ hasTouch: true }),
      again = await fresh.newPage();
    await openUniversal(again);
    await importMystery(again, saved.bytes);
    await button(again, "Hilfen bearbeiten").tap();
    await expect(
      again.getByRole("textbox", { name: "Hilfetext", exact: true }),
    ).toHaveValue(own);
    await info.attach(name, { body: own, contentType: "text/plain" });
    await fresh.close();
  }
});

test("alte Dateien mit gleichlautenden Hilfen bleiben lesbar, werden aber nicht erneut unverändert veröffentlicht", async ({
  page,
}, info) => {
  const raw = structuredClone(source);
  raw.help.categories.forEach(
    (g, i) => (g.label = ["Ursachen", " Ursachen ", "ursachen"][i]),
  );
  const doc = taskDocument(raw);
  await openUniversal(page);
  await importMystery(page, Buffer.from(encodeDocument(doc)));
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Alte Datei");
  await button(page, "Beginnen").tap();
  await button(page, "Menü").tap();
  await button(page, "Projektdatei sichern").tap();
  const work = await getFile(
    page,
    info,
    "alte-gruppennamen-schueler.mysteryboard",
  );
  expect(work.document.content).toEqual(doc.content);
  await button(page, "Schließen").tap();
  await button(page, "Menü").tap();
  page.once("dialog", (d) => d.accept());
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await button(page, "Schülerversion erstellen").tap();
  await expect(page.getByRole("alert")).toContainText("gleichlautende Namen");
  await expect(
    page.getByRole("dialog", { name: "Datei sichern", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".author-card-list li")).toHaveCount(12);
});

test("Hilfeeditor und echte Schülerhilfe bleiben in allen vier geforderten Ansichten per Touch erreichbar", async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const bytes = await readFile(
    "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  );
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 600, height: 800 },
    { width: 320, height: 700 },
  ]) {
    const ctx = await browser.newContext({ hasTouch: true, viewport }),
      page = await ctx.newPage();
    await openUniversal(page);
    await importMystery(page, bytes);
    await button(page, "Hilfen bearbeiten").tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`hilfeeditor-${viewport.width}.png`),
      fullPage: true,
    });
    await button(page, "Hilfe aus Schülersicht ansehen").tap();
    const preview = page.getByRole("dialog", {
      name: "Hilfe aus Schülersicht",
      exact: true,
    });
    await expect(
      preview.getByRole("dialog", { name: "Hilfe", exact: true }),
    ).toBeVisible();
    await button(preview, "Weitere Hilfe anzeigen").tap();
    const last = preview.locator("#orientation-legend li").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`schuelerhilfe-${viewport.width}.png`),
    });
    await button(preview, "Zurück zu den Hilfen").tap();
    await button(page, "Hilfe übernehmen").tap();
    await expect(button(page, "Entwurf sichern")).toBeEnabled();
    await ctx.close();
  }
});
