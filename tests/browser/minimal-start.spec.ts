import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { button, openUniversal, getFile, type UI } from "./authoring-helpers";
import { scorm, project, png, gestures, connect } from "./help-runtime-helpers";

const views = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
];
async function welcome(ui: UI, width: number, height: number) {
  const main = ui.locator("main.universal-welcome");
  await expect(
    main.getByRole("heading", { name: "MysteryBoard", exact: true }),
  ).toBeVisible();
  await expect(main.locator("p")).toHaveCount(1);
  await expect(main.locator("p")).toHaveText(
    "Öffnet eine Aufgabe oder setzt eure Arbeit fort.",
  );
  await expect(main.getByRole("button")).toHaveText([
    "Aufgabe öffnen",
    "Arbeit fortsetzen",
    "Lehrkräfteeditor",
  ]);
  await expect(main.locator("svg, img, aside, .number-guidance")).toHaveCount(
    0,
  );
  const task = await button(main, "Aufgabe öffnen").boundingBox();
  const resume = await button(main, "Arbeit fortsetzen").boundingBox();
  const teacher = await button(main, "Lehrkräfteeditor").boundingBox();
  for (const b of [task!, resume!, teacher!]) {
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(height + 1);
  }
  expect(teacher!.y).toBeGreaterThanOrEqual(
    Math.max(task!.y + task!.height, resume!.y + resume!.height) + 20,
  );
  expect(teacher!.width).toBeLessThan(task!.width);
  const styles = await button(main, "Lehrkräfteeditor").evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      font: parseFloat(s.fontSize),
      background: s.backgroundColor,
      animation: s.animationName,
    };
  });
  const pupilFont = await button(main, "Aufgabe öffnen").evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(styles.font).toBeLessThan(pupilFont);
  expect(styles.background).toBe("rgba(0, 0, 0, 0)");
  expect(styles.animation).toBe("none");
  const size = await ui.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(size.width).toBeLessThanOrEqual(width + 1);
  expect(size.height).toBeLessThanOrEqual(height + 1);
}
async function chooseFile(ui: UI, buffer: Buffer, name: string) {
  await expect(
    ui.getByRole("dialog", { name: "Datei öffnen", exact: true }),
  ).toBeVisible();
  await ui.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name,
    mimeType: name.endsWith(".png") ? "image/png" : "application/json",
    buffer,
  });
}
for (const viewport of views)
  for (const mode of ["html", "scorm"] as const) {
    test(`Minimale Startseite ${mode} ${viewport.width}x${viewport.height}: drei Einstiege, echte PNG und Rückwege`, async ({
      browser,
    }, info) => {
      test.setTimeout(150000);
      const created =
        mode === "scorm"
          ? await scorm(browser, info, "minimal-scorm", viewport)
          : null;
      const context =
        created?.context ??
        (await browser.newContext({ viewport, hasTouch: true }));
      const page = created?.page ?? (await context.newPage());
      const ui: UI = created?.ui ?? page;
      if (!created) await openUniversal(page);
      await welcome(ui, viewport.width, viewport.height);
      await page.screenshot({
        path: info.outputPath(
          `start-${mode}-${viewport.width}x${viewport.height}.png`,
        ),
      });
      // Both pupil actions use the same established file chooser and validation.
      await button(ui, "Arbeit fortsetzen").tap();
      await expect(
        ui.getByRole("dialog", { name: "Datei öffnen", exact: true }),
      ).toBeVisible();
      await button(ui, "Abbrechen").tap();
      await welcome(ui, viewport.width, viewport.height);
      await button(ui, "Aufgabe öffnen").tap();
      const taskBytes = await readFile(
        "examples/universal/ki-beispiel.mysteryboard",
      );
      const taskData = JSON.parse(taskBytes.toString());
      await chooseFile(ui, taskBytes, "neue-aufgabe.mysteryboard");
      await ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("Startseiten-Test");
      await button(ui, "Beginnen").tap();
      await expect(ui.locator(".card")).toHaveCount(
        taskData.content.cards.length,
      );
      await gestures(ui);
      await connect(ui, 1, 2, "Eigener Zusammenhang");
      const before = await project(
        ui,
        info,
        `start-${mode}-${viewport.width}-projekt`,
      );
      const saved = await png(
        ui,
        info,
        `start-${mode}-${viewport.width}-schueler`,
      );
      expect(saved.document).toEqual(before.document);
      await button(ui, "Menü").tap();
      page.once("dialog", (d) => d.accept());
      await button(ui, "Zur Startansicht").tap();
      await welcome(ui, viewport.width, viewport.height);
      await button(ui, "Arbeit fortsetzen").tap();
      await chooseFile(ui, saved.bytes, "Original-Schuelerarbeit.png");
      const restored = await project(
        ui,
        info,
        `start-${mode}-${viewport.width}-wiederhergestellt`,
      );
      expect(restored.document).toEqual(before.document);
      await connect(ui, 2, 3, "Nach Wiederherstellung weitergearbeitet");
      await button(ui, "Menü").tap();
      page.once("dialog", (d) => d.accept());
      await button(ui, "Zur Startansicht").tap();
      await welcome(ui, viewport.width, viewport.height);
      await button(ui, "Lehrkräfteeditor").tap();
      await expect(button(ui, "Vorhandenes Mystery öffnen")).toBeVisible();
      await button(ui, "Schließen").tap();
      await welcome(ui, viewport.width, viewport.height);
      await button(ui, "Lehrkräfteeditor").tap();
      await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("TEST");
      await button(ui, "Lehrkräftemodus öffnen").tap();
      await expect(ui.locator(".author-card-list > li")).toHaveCount(0);
      await expect(button(ui, "Dokument importieren")).toBeVisible();
      await expect(button(ui, "Hilfen bearbeiten")).toBeVisible();
      await ui
        .getByLabel("Mystery-Titel", { exact: true })
        .fill("Startseite – eigene Aufgabe");
      await button(ui, "Karte hinzufügen").tap();
      await ui
        .getByLabel("Kartenüberschrift", { exact: true })
        .fill("Eigene Information");
      await ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill("Diese Karte wurde im bestehenden Lehrkräfteeditor erstellt.");
      await button(ui, "Karte übernehmen").tap();
      await button(ui, "Schülerversion erstellen").tap();
      const exported = await getFile(
        ui,
        info,
        `start-${mode}-${viewport.width}-eigene-aufgabe.mysteryboard`,
      );
      expect(exported.document.kind).toBe("task");
      expect(exported.document.content.cards).toHaveLength(1);
      expect(exported.document.content.cards[0].text).toBe(
        "Diese Karte wurde im bestehenden Lehrkräfteeditor erstellt.",
      );
      await button(ui, "Schließen").tap();
      page.once("dialog", (d) => d.accept());
      await button(ui, "Startseite").tap();
      await welcome(ui, viewport.width, viewport.height);
      // Teacher navigation now uses the same editor importer directly.
      await button(ui, "Lehrkräfteeditor").tap();
      await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("TEST2");
      await button(ui, "Vorhandenes Mystery öffnen").tap();
      await chooseFile(ui, exported.bytes, "eigene-aufgabe.mysteryboard");
      await expect(
        ui.getByLabel("Teamname oder Vornamen", { exact: true }),
      ).toHaveCount(0);
      await expect(ui.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
        "Startseite – eigene Aufgabe",
      );
      await expect(ui.locator(".author-card-list > li")).toHaveCount(1);
      if (created) await created.finish();
      else await context.close();
    });
  }
