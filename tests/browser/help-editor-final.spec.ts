import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  readDocument,
  encodeDocument,
  type Draft,
} from "../../src/core/documents";
import { reviseDraft } from "../../src/core/authoring";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
  type UI,
} from "./authoring-helpers";
import { scorm, project, png, connect, gestures } from "./help-runtime-helpers";

test.use({ hasTouch: true });
const views = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
];
async function fixture(count: number) {
  const draft = readDocument(
    await readFile("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
  ) as Draft;
  if (count === 12) return encodeDocument(draft);
  const content = structuredClone(draft.content);
  content.id = "mystery-help-final-sixty";
  content.title = "Sechzig neutrale Prüfbeobachtungen";
  for (let id = 13; id <= 60; id++) {
    content.cards.push({
      id,
      title: `Beobachtung ${id}`,
      text: `Prüfinformation ${id} ohne vorgegebenen Zusammenhang.`,
      group: id <= 45 ? "required" : "extension",
    });
    content.initial.cards.push({ id, x: (id - 1) * 480, y: 0, color: 0 });
  }
  for (const card of content.cards)
    card.group = card.id <= 45 ? "required" : "extension";
  return encodeDocument(reviseDraft(draft, content));
}
async function openHelp(ui: UI) {
  await button(ui, "Menü").tap();
  await button(ui, "Hilfe").tap();
}
for (const count of [12, 60])
  for (const viewport of views)
    test(`Finale Hilfen ${count} Karten ${viewport.width}x${viewport.height}: Suche, Mehrfachwahl, isolierte Vorschau, SCORM und portable PNG`, async ({
      browser,
    }, info) => {
      test.setTimeout(180000);
      const context = await browser.newContext({ hasTouch: true, viewport }),
        page = await context.newPage();
      await openUniversal(page);
      await importMystery(page, Buffer.from(await fixture(count)));
      await expect(page.locator(".author-help-entry")).toContainText(
        "3 Farbgruppen · 4 Karten markiert",
      );
      await button(page, "Hilfen bearbeiten").tap();
      await page
        .getByRole("textbox", { name: "Hilfetext", exact: true })
        .fill("Vergleicht Beobachtungen und begründet eure Zusammenhänge.");
      await expect(
        page.getByRole("combobox", {
          name: "Gemeinsame Farbgruppe",
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("textbox", { name: "Name Gruppe 1", exact: true })
        .fill("Erste Perspektive");
      await page
        .getByRole("combobox", { name: "Hilfe für Karte 5", exact: true })
        .selectOption("group2");
      const search = page.getByRole("searchbox", {
        name: "Karten suchen (Nummer oder Titel)",
        exact: true,
      });
      await search.fill("1");
      await expect(page.locator(".help-card-assignments li")).toHaveCount(1);
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: `1 von ${count} Karten angezeigt.` }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("nummernsuche.png"),
        fullPage: true,
      });
      await search.fill(count === 60 ? "Beobachtung 60" : "Information 12");
      await expect(page.locator(".help-card-assignments li")).toHaveCount(1);
      await search.fill("Keine passende Überschrift");
      await expect(page.locator(".help-card-assignments li")).toHaveCount(0);
      await button(page, "Suche zurücksetzen").tap();
      await expect(
        page.getByRole("combobox", { name: "Hilfe für Karte 5", exact: true }),
      ).toHaveValue("group2");
      await button(page, "Mehrere Karten gemeinsam zuordnen").tap();
      await page
        .getByRole("combobox", { name: "Gemeinsame Farbgruppe", exact: true })
        .selectOption("group3");
      for (const id of [1, 2])
        await page
          .getByRole("checkbox", {
            name: `Karte ${id} gemeinsam zuordnen`,
            exact: true,
          })
          .check();
      await search.fill("1");
      await expect(
        page.getByRole("status").filter({ hasText: "2 Karten ausgewählt" }),
      ).toContainText("1 davon außerhalb der Suche");
      await button(page, "Ausgewählte Karten zuordnen").tap();
      await button(page, "Suche zurücksetzen").tap();
      // Leave every group nonempty: card 3 in group1, card 5 in group2, cards 4/1/2 in group3.
      for (const id of [1, 2, 4])
        await expect(
          page.getByRole("combobox", {
            name: `Hilfe für Karte ${id}`,
            exact: true,
          }),
        ).toHaveValue("group3");
      await expect(
        page.getByRole("combobox", { name: "Hilfe für Karte 3", exact: true }),
      ).toHaveValue("group1");
      await button(page, "Mehrfachzuordnung schließen").tap();
      await search.fill("1");
      const pageWidth = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        view: innerWidth,
      }));
      expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.view + 1);
      await page.screenshot({
        path: info.outputPath("editor-gefiltert.png"),
        fullPage: true,
      });
      let downloads = 0;
      page.on("download", () => downloads++);
      await button(page, "Hilfe aus Schülersicht ansehen").tap();
      const preview = page.getByRole("dialog", {
        name: "Hilfe aus Schülersicht",
        exact: true,
      });
      await button(preview, "Weitere Hilfe anzeigen").tap();
      await expect(preview.locator("#orientation-legend")).toContainText(
        "Erste Perspektive",
      );
      await button(preview, "Hilfe schließen").tap();
      for (const name of [
        "Sichern",
        "Menü",
        "Teamname ändern",
        "Fortsetzen",
        "Druckfassung / PDF",
        "Zur Startansicht",
        "Projektdatei sichern",
      ])
        await expect(button(preview, name)).toHaveCount(0);
      await expect(preview.locator('input[type="file"]')).toHaveCount(0);
      await connect(preview, 1, 2, "Temporäre Vorschau");
      await gestures(preview as unknown as UI);
      await expect(preview.locator("[data-edge-label]")).toContainText(
        "Temporäre Vorschau",
      );
      await button(preview, "Hilfe").press("Enter");
      await expect(
        preview.getByRole("dialog", { name: "Hilfe", exact: true }),
      ).toBeVisible();
      await button(preview, "Hilfe schließen").tap();
      await page.screenshot({
        path: info.outputPath("vorschau-ohne-dateifunktionen.png"),
      });
      await button(preview, "Zurück zu den Hilfen").tap();
      expect(downloads).toBe(0);
      // Remounting the same shared App must discard its previous edits and orientation.
      await button(page, "Hilfe aus Schülersicht ansehen").tap();
      await button(preview, "Hilfe schließen").tap();
      await expect(preview.locator("[data-edge-label]")).toHaveCount(0);
      await expect(preview.locator('[data-number="1"] circle')).toHaveAttribute(
        "fill",
        "#334f40",
      );
      await button(preview, "Zurück zu den Hilfen").tap();
      await button(page, "Hilfe übernehmen").tap();
      await expect(page.locator(".author-help-entry")).toContainText(
        "3 Farbgruppen · 5 Karten markiert",
      );
      await expect(page.getByRole("status")).toContainText("Entwurf sichern");
      await button(page, "Entwurf sichern").tap();
      const draft = await getFile(
        page,
        info,
        `final-${count}-${viewport.width}-entwurf.mysteryboard`,
      );
      expect(draft.document.content.initial.edges).toEqual([]);
      const original = readDocument(await fixture(count));
      expect(draft.document.content.initial).toEqual(original.content.initial);
      expect(
        draft.document.content.help?.categories?.map((g) => g.cardIds),
      ).toEqual([[3], [5], [4, 1, 2]]);
      await context.close();
      const c2 = await browser.newContext({ hasTouch: true, viewport }),
        p2 = await c2.newPage();
      await openUniversal(p2);
      await importMystery(p2, draft.bytes);
      await button(p2, "Schülerversion erstellen").tap();
      const task = await getFile(
        p2,
        info,
        `final-${count}-${viewport.width}-aufgabe.mysteryboard`,
      );
      expect(task.document.content).toEqual(draft.document.content);
      await button(p2, "Schließen").tap();
      await button(p2, "Hilfen bearbeiten").tap();
      await p2
        .getByRole("textbox", { name: "Hilfetext", exact: true })
        .fill("Eine spätere Revision mit geändertem Denkimpuls.");
      await button(p2, "Hilfe übernehmen").tap();
      await button(p2, "Schülerversion erstellen").tap();
      const revision = await getFile(
        p2,
        info,
        `final-${count}-${viewport.width}-revision.mysteryboard`,
      );
      expect(revision.document.content.version).not.toBe(
        task.document.content.version,
      );
      await c2.close();
      const learner = await scorm(browser, info, "lernende-final", viewport);
      await importMystery(learner.ui, task.bytes);
      await learner.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill(`Team ${count}`);
      await button(learner.ui, "Beginnen").tap();
      await expect(learner.ui.locator(".learning-help")).toHaveCount(0);
      await openHelp(learner.ui);
      await button(learner.ui, "Weitere Hilfe anzeigen").tap();
      await expect(learner.ui.locator("#orientation-legend")).toContainText(
        "Erste Perspektive",
      );
      await button(learner.ui, "Hilfe schließen").tap();
      await gestures(learner.ui);
      await connect(learner.ui, 1, 2, "Schülerbegründung");
      const before = await project(
        learner.ui,
        info,
        `final-${count}-${viewport.width}-projekt`,
      );
      const saved = await png(
        learner.ui,
        info,
        `final-${count}-${viewport.width}-schueler`,
      );
      expect(saved.document).toEqual(before.document);
      await learner.page.screenshot({
        path: info.outputPath("scorm-schueler.png"),
      });
      await learner.finish();
      const fresh = await scorm(browser, info, "neu-und-alt-final", viewport);
      await importMystery(fresh.ui, revision.bytes);
      await fresh.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("Neue Gruppe");
      await button(fresh.ui, "Beginnen").tap();
      await button(fresh.ui, "Menü").tap();
      await button(fresh.ui, "Fortsetzen").tap();
      await fresh.ui
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles({
          name: "original.png",
          mimeType: "image/png",
          buffer: saved.bytes,
        });
      const restored = await project(
        fresh.ui,
        info,
        `final-${count}-${viewport.width}-wiederhergestellt`,
      );
      expect(restored.document).toEqual(before.document);
      await expect(fresh.ui.locator(".learning-help")).toHaveCount(0);
      await fresh.finish();
    });
