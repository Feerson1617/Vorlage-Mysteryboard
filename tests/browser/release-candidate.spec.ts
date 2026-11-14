import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readDocument } from "../../src/core/documents";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
} from "./authoring-helpers";
import { scorm, png, project, connect, gestures } from "./help-runtime-helpers";
test.use({ hasTouch: true });
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
])
  test(`Release Candidate Papierprobe ${viewport.width}x${viewport.height}: alle Originalfelder, Revision, SCORM und alte/neue PNG`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const input = await readFile(
      "examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard",
    );
    const source = readDocument(input);
    const context = await browser.newContext({ hasTouch: true, viewport }),
      page = await context.newPage();
    const filenames: string[] = [];
    page.on("download", (d) => filenames.push(d.suggestedFilename()));
    await openUniversal(page);
    await expect(page.getByText(/Auch Dateien von einer KI/)).toBeVisible();
    await importMystery(page, input);
    await page
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Papierprobe original");
    await button(page, "Beginnen").tap();
    for (const c of source.content.cards) {
      await page.locator(`[data-number="${c.id}"]`).tap();
      await expect(page.locator(".reading h3")).toHaveText(c.title);
      await expect(page.locator(".reading > p").first()).toHaveText(c.text);
      await expect(page.locator(".reading > p.small")).toHaveText(
        "Quelle: " + c.source,
      );
      if (c.table) {
        await expect(page.locator(".reading caption")).toHaveText(
          c.table.caption!,
        );
        expect(await page.locator(".reading th").allTextContents()).toEqual(
          c.table.headers,
        );
        expect(
          await page
            .locator(".reading tbody tr")
            .evaluateAll((rows) =>
              rows.map((r) =>
                [...r.querySelectorAll("td")].map((c) => c.textContent),
              ),
            ),
        ).toEqual(c.table.rows);
      }
      if (c.image) {
        await expect(page.locator(".media-view > img")).toHaveAttribute(
          "src",
          c.image,
        );
        await button(page, "Bild vergrößern").tap();
        await page
          .getByRole("slider", { name: "Bildvergrößerung", exact: true })
          .press("End");
        await expect(
          page.getByRole("slider", { name: "Bildvergrößerung", exact: true }),
        ).toHaveValue("4");
        const size = await page
          .locator(".media-scroll img")
          .evaluate((el: HTMLImageElement) => ({
            width: el.getBoundingClientRect().width,
            natural: el.naturalWidth,
          }));
        expect(size.natural).toBe(900);
        expect((size.width / 900) * 21).toBeGreaterThanOrEqual(14);
        await page.screenshot({
          path: info.outputPath("diagramm-lesefenster.png"),
        });
        const enlarged = page.getByLabel("Vergrößertes Bild", { exact: true });
        await enlarged.scrollIntoViewIfNeeded();
        await enlarged.press("End");
        for (let i = 0; i < 60; i++) await enlarged.press("ArrowRight");
        await expect
          .poll(() =>
            enlarged.evaluate(
              (e) =>
                e.scrollLeft >= e.scrollWidth - e.clientWidth - 2 &&
                e.scrollTop >= e.scrollHeight - e.clientHeight - 2,
            ),
          )
          .toBe(true);
        await page.screenshot({
          path: info.outputPath("diagramm-rechts-unten.png"),
        });
      }
      await button(page, "Schließen").tap();
    }
    await connect(page, 1, 2, "Originalbeobachtungen");
    const old = await png(
      page,
      info,
      `rc-papier-${viewport.width}-alte-schuelerarbeit`,
    );
    expect(old.document.content).toEqual(source.content);
    await button(page, "Menü").tap();
    page.once("dialog", (d) => d.accept());
    await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("RC");
    await button(page, "Lehrkräftemodus öffnen").tap();
    await button(page, "Karte hinzufügen").tap();
    await page
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill("Zusätzliche Prüfbeobachtung");
    await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(
        "Eine spätere Prüfung soll mehrere Messorte vergleichen. Dies ist eine Ergänzung der zweiten Fassung.",
      );
    await button(page, "Karte übernehmen").tap();
    page.once("dialog", (d) => d.accept());
    await button(page, "Karte 2 löschen").tap();
    await button(page, "Karte 1 bearbeiten").tap();
    const revisedText =
      source.content.cards[0].text +
      " Ergänzung: Eine spätere Untersuchung wird gesondert dokumentiert.";
    await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(revisedText);
    await button(page, "Karte übernehmen").tap();
    await button(page, "Karte 4 bearbeiten").tap();
    await page
      .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
      .setInputFiles(resolve("examples/ki-papierprobe/oxygen-alternative.png"));
    await page
      .getByLabel("Bildbeschreibung (optional)", { exact: true })
      .fill(
        "Überarbeitete Darstellung derselben synthetischen Sauerstoffwerte.",
      );
    await button(page, "Karte übernehmen").tap();
    await button(page, "Hilfen bearbeiten").tap();
    await page
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill(
        "Unterscheidet dokumentierte Beobachtungen und noch ungeprüfte Vermutungen.",
      );
    await page
      .getByRole("checkbox", {
        name: "Kartennummern als Hilfe markieren",
        exact: true,
      })
      .check();
    await page
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("causes");
    for (const [id, g] of [
      ["1", "group1"],
      ["4", "group2"],
      ["V9", "group3"],
    ])
      await page
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(g);
    await page
      .getByRole("searchbox", {
        name: "Karten suchen (Nummer oder Titel)",
        exact: true,
      })
      .fill("V9");
    await expect(page.locator(".help-card-assignments li")).toHaveCount(1);
    await expect(
      page.getByRole("combobox", { name: "Hilfe für Karte V9", exact: true }),
    ).toHaveValue("group3");
    await button(page, "Suche zurücksetzen").tap();
    await button(page, "Mehrere Karten gemeinsam zuordnen").tap();
    await page
      .getByRole("combobox", { name: "Gemeinsame Farbgruppe", exact: true })
      .selectOption("group2");
    for (const id of [3, 4])
      await page
        .getByRole("checkbox", {
          name: `Karte ${id} gemeinsam zuordnen`,
          exact: true,
        })
        .check();
    await button(page, "Ausgewählte Karten zuordnen").tap();
    await button(page, "Mehrfachzuordnung schließen").tap();
    await page.screenshot({
      path: info.outputPath("lehrkraft-hilfen.png"),
      fullPage: true,
    });
    await button(page, "Hilfe übernehmen").tap();
    await button(page, "Entwurf sichern").tap();
    const draft = await getFile(
      page,
      info,
      `rc-papier-${viewport.width}-entwurf-v2.mysteryboard`,
    );
    expect(filenames.at(-1)).toMatch(
      /^MysteryBoard-Entwurf-Ein-Montagmorgen-am-Parkteich-v1\./,
    );
    expect(draft.document.content.cards).toHaveLength(10);
    expect(draft.document.content.cards[0].text).toBe(revisedText);
    expect(draft.document.content.cards[2].table).toEqual(
      source.content.cards[3].table,
    );
    expect(draft.document.content.cards[3].image).not.toBe(
      source.content.cards[4].image,
    );
    expect(
      draft.document.content.cards.find(
        (c) => c.title === "Was die Daten nicht zeigen",
      )?.group,
    ).toBe("extension");
    expect(draft.document.content.initial.edges).toEqual([]);
    expect(
      draft.document.content.help?.categories?.map((g) => g.cardIds),
    ).toEqual([[1], [3, 4], [9]]);
    await context.close();
    const c2 = await browser.newContext({ hasTouch: true, viewport }),
      p2 = await c2.newPage();
    let taskName = "";
    p2.on("download", (d) => (taskName = d.suggestedFilename()));
    await openUniversal(p2);
    await importMystery(p2, draft.bytes);
    await button(p2, "Schülerversion erstellen").tap();
    const revised = await getFile(
      p2,
      info,
      `rc-papier-${viewport.width}-aufgabe-v2.mysteryboard`,
    );
    expect(taskName).toMatch(
      /^MysteryBoard-Aufgabe-Ein-Montagmorgen-am-Parkteich-v1\./,
    );
    expect(revised.document.content).toEqual(draft.document.content);
    expect(revised.document.kind).toBe("task");
    expect("author" in revised.document).toBe(false);
    await c2.close();
    const learner = await scorm(browser, info, "papier-lernen", viewport);
    await importMystery(learner.ui, revised.bytes);
    await learner.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Neue Papiergruppe");
    await button(learner.ui, "Beginnen").tap();
    await button(learner.ui, "Menü").tap();
    await button(learner.ui, "Hilfe").tap();
    await button(learner.ui, "Weitere Hilfe anzeigen").tap();
    await expect(learner.ui.locator("#orientation-legend")).toContainText("V9");
    await button(learner.ui, "Hilfe schließen").tap();
    await gestures(learner.ui);
    await connect(learner.ui, 1, 4, "Messwerte prüfen");
    const before = await project(
      learner.ui,
      info,
      `rc-papier-${viewport.width}-projekt-v2`,
    );
    const saved = await png(
      learner.ui,
      info,
      `rc-papier-${viewport.width}-schuelerarbeit-v2`,
    );
    expect(saved.document).toEqual(before.document);
    await learner.page.screenshot({
      path: info.outputPath("scorm-neue-fassung.png"),
    });
    await learner.finish();
    const fresh = await scorm(browser, info, "papier-frisch", viewport);
    await importMystery(fresh.ui, saved.bytes, "neu.png");
    expect(
      (
        await project(
          fresh.ui,
          info,
          `rc-papier-${viewport.width}-restauriert-v2`,
        )
      ).document,
    ).toEqual(before.document);
    await button(fresh.ui, "Menü").tap();
    await button(fresh.ui, "Fortsetzen").tap();
    await fresh.ui.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
      name: "alt.png",
      mimeType: "image/png",
      buffer: old.bytes,
    });
    expect(
      (
        await project(
          fresh.ui,
          info,
          `rc-papier-${viewport.width}-alte-fassung-unvermischt`,
        )
      ).document,
    ).toEqual(old.document);
    await fresh.finish();
    expect(
      await readFile(
        "examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard",
      ),
    ).toEqual(input);
  });
