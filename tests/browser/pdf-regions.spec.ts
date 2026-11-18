import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import expected from "../fixtures/pdf-regions/ERWARTETE-KARTEN.json" with { type: "json" };
import {
  button,
  openUniversal,
  importMystery,
  getFile,
  type UI,
} from "./authoring-helpers";
import { scorm, gestures, connect, project, png } from "./help-runtime-helpers";
import { classroom, downloadClassroom } from "./pdf-region-helpers";
import type { Student } from "../../src/core/documents";

type Case = {
  alias: string;
  title: string;
  pdf: string;
  pages: number[];
  cards: { title: string; text: string }[];
  sections?: string[];
};
const cases: Case[] = process.env.PDF_REGION_CASES
  ? JSON.parse(readFileSync(process.env.PDF_REGION_CASES, "utf8"))
  : [
      {
        alias: "Rahmen20",
        title: "Neutrale Messungen – 20 Felder",
        pdf: resolve("tests/fixtures/pdf-regions/Rahmen-20.pdf"),
        pages: [15, 5],
        cards: expected.grid.map(({ title, text }) => ({ title, text })),
        sections: ["Arbeitsauftrag"],
      },
      {
        alias: "OhneRahmen16",
        title: "Neutrale Beobachtungen – 16 Karten",
        pdf: resolve("tests/fixtures/pdf-regions/Ohne-Rahmen-16.pdf"),
        pages: [16],
        cards: expected.headings.map(({ title, text }) => ({ title, text })),
      },
    ];
for (const [vi, viewport] of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
].entries())
  for (const sample of cases)
    test(`PDF-Bereiche ${sample.alias} ${viewport.width}x${viewport.height}: Originalvergleich, Grenze, Entwurf, SCORM, Pfeil und frische PNG`, async ({
      browser,
    }, info) => {
      test.setTimeout(180000);
      const sco =
        vi % 2
          ? await scorm(browser, info, "universal-editor", viewport)
          : null;
      const context =
          sco?.context ??
          (await browser.newContext({ hasTouch: true, viewport })),
        page = sco?.page ?? (await context.newPage()),
        ui: UI = sco?.ui ?? page;
      if (!sco) await openUniversal(page);
      const requests: string[] = [];
      context.on("request", (r) => {
        if (
          /^https?:/.test(r.url()) &&
          !r.url().startsWith("http://localhost:5174/")
        )
          requests.push(r.url());
      });
      await button(ui, "Lehrkräfteeditor").tap();
      await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("PDF");
      await button(ui, "Lehrkräftemodus öffnen").tap();
      await ui
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles(sample.pdf);
      await expect(
        ui.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(ui.locator(".import-step-body")).toBeEnabled({
        timeout: 30000,
      });
      const picker = ui.getByRole("combobox", {
        name: "Importkarte auswählen",
        exact: true,
      });
      await expect(picker.locator("option")).toHaveCount(sample.cards.length);
      for (const [i, c] of sample.cards.entries()) {
        await picker.selectOption(String(i));
        await expect(
          ui.getByRole("textbox", { name: "Überschrift", exact: true }),
        ).toHaveValue(c.title);
        await expect(
          ui.getByRole("textbox", { name: "Kartentext", exact: true }),
        ).toHaveValue(c.text);
      }
      if (sample.sections) {
        await ui.locator(".pdf-document-sections > summary").click();
        for (const text of sample.sections)
          await expect(
            ui.getByRole("textbox", {
              name: "Separate Dokumentabschnitte",
              exact: true,
            }),
          ).toHaveValue(new RegExp(text));
      }
      await button(ui, "Original ansehen").tap();
      for (const [index, count] of sample.pages.entries()) {
        await ui
          .getByRole("combobox", { name: "PDF-Seite", exact: true })
          .selectOption(String(index + 1));
        await expect(ui.locator(".import-step-body")).toBeEnabled({
          timeout: 30000,
        });
        await expect(ui.locator("[data-pdf-region]")).toHaveCount(count);
        const path = info.outputPath(
          `regionen-${sample.alias}-${viewport.width}-seite-${index + 1}.png`,
        );
        await ui.locator(".import-page").screenshot({ path });
        if (process.env.PDF_REGION_DOWNLOADS) {
          await mkdir(process.env.PDF_REGION_DOWNLOADS, { recursive: true });
          await copyFile(
            path,
            join(
              process.env.PDF_REGION_DOWNLOADS,
              `regionen-${sample.alias}-${viewport.width}-seite-${index + 1}.png`,
            ),
          );
        }
      }
      await ui
        .getByRole("combobox", { name: "PDF-Seite", exact: true })
        .selectOption("1");
      await expect(ui.locator(".import-step-body")).toBeEnabled();
      await button(ui, "Karten ansehen").tap();
      await picker.selectOption("0");
      await button(ui, "Original ansehen").tap();
      const border = ui.locator('[data-region-card="1"] > rect').first(),
        before = await border.getAttribute("width");
      await button(ui, "Kartengrenze markieren").tap();
      const width = ui.getByRole("spinbutton", {
        name: "Breite (%)",
        exact: true,
      });
      await width.fill(String(Number(await width.inputValue()) - 0.1));
      await button(ui, "Grenze aktualisieren und Text neu lesen").tap();
      await expect(border).not.toHaveAttribute("width", before!);
      await button(ui, "Karten ansehen").tap();
      await expect(picker.locator("option")).toHaveCount(sample.cards.length);
      await expect(
        ui.getByRole("textbox", { name: "Kartentext", exact: true }),
      ).toHaveValue(sample.cards[0].text);
      await button(ui, "Weiter zur Übernahme").tap();
      await ui.getByLabel("Mystery-Titel", { exact: true }).fill(sample.title);
      await ui
        .getByRole("checkbox", {
          name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
          exact: true,
        })
        .check();
      await button(ui, "Geprüfte Karten übernehmen").tap();
      await expect(ui.locator(".author-card-list > li")).toHaveCount(
        sample.cards.length,
      );
      await button(ui, "Entwurf sichern").tap();
      const draft = await getFile(
        ui,
        info,
        `${sample.alias}-${viewport.width}-entwurf.mysteryboard`,
      );
      await button(ui, "Schließen").tap();
      expect(
        draft.document.content.cards.map((c) => ({
          title: c.title,
          text: c.text,
        })),
      ).toEqual(sample.cards);
      expect(JSON.stringify(draft.document)).not.toContain('"pdfLayout"');
      if (sco) await sco.finish();
      else await context.close();
      const freshContext = await browser.newContext({
          hasTouch: true,
          viewport,
        }),
        author = await freshContext.newPage();
      await openUniversal(author);
      await importMystery(author, draft.bytes);
      await expect(
        author.getByLabel("Mystery-Titel", { exact: true }),
      ).toHaveValue(sample.title);
      await button(author, "Schülerversion erstellen").tap();
      const task = await getFile(
        author,
        info,
        `${sample.alias}-${viewport.width}-aufgabe.mysteryboard`,
      );
      await button(author, "Schließen").tap();
      expect(task.document.content).toEqual(draft.document.content);
      const zip = await downloadClassroom(
        author,
        info,
        `${sample.alias}-${viewport.width}-SCORM-1.2.zip`,
      );
      await freshContext.close();
      const learner = await classroom(
        browser,
        info,
        zip,
        sample.title,
        viewport,
        "task-start",
      );
      await learner.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("PDF-Testteam");
      await button(learner.ui, "Beginnen").tap();
      await expect(learner.ui.locator(".card")).toHaveCount(
        sample.cards.length,
      );
      await gestures(learner.ui);
      await connect(learner.ui, 1, 2, "Eigene geprüfte Verbindung");
      await expect(learner.ui.locator('[data-arrowhead="1"]')).toHaveAttribute(
        "data-direction",
        "1",
      );
      const original = await project(
          learner.ui,
          info,
          `${sample.alias}-${viewport.width}-schueler`,
        ),
        saved = await png(
          learner.ui,
          info,
          `${sample.alias}-${viewport.width}-original`,
        );
      expect(saved.document).toEqual(original.document);
      await learner.finish();
      const restored = await classroom(
        browser,
        info,
        zip,
        sample.title,
        viewport,
        "task-restored",
      );
      await button(restored.ui, "Fortsetzen").tap();
      await restored.ui
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles({
          name: "Original.png",
          mimeType: "image/png",
          buffer: saved.bytes,
        });
      const again = await project(
        restored.ui,
        info,
        `${sample.alias}-${viewport.width}-wiederhergestellt`,
      );
      expect(again.document).toEqual(original.document);
      await expect(restored.ui.locator('[data-arrowhead="1"]')).toBeVisible();
      await connect(restored.ui, 2, 3, "Weitergearbeitet");
      await button(restored.ui, "Rückgängig").tap();
      await expect(restored.ui.locator("[data-arrowhead]")).toHaveCount(1);
      await button(restored.ui, "Wiederholen").tap();
      await expect(restored.ui.locator("[data-arrowhead]")).toHaveCount(2);
      const continued = await project(
        restored.ui,
        info,
        `${sample.alias}-${viewport.width}-fortgesetzt`,
      );
      expect(
        (continued.document as Student).work.edges.map((e) => e.direction),
      ).toEqual([1, 1]);
      await restored.page.screenshot({
        path: info.outputPath("wiederhergestellte-pfeile.png"),
      });
      await restored.finish();
      expect(requests).toEqual([]);
    });
