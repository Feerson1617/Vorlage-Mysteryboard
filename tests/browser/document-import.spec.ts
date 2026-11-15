import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import original from "../fixtures/document-import/ORIGINAL-INHALTE.json" with { type: "json" };
import {
  button,
  openUniversal,
  importMystery,
  getFile,
} from "./authoring-helpers";
import { scorm, png, project, gestures, connect } from "./help-runtime-helpers";
test.use({ hasTouch: true });
const fixture = (n: string) => resolve("tests/fixtures/document-import", n),
  norm = (s: string) => s.replace(/\s+/g, " ").trim();
async function teacher(page: Page) {
  await openUniversal(page);
  await button(page, "Eigenes Mystery erstellen").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
  await button(page, "Lehrkräftemodus öffnen").tap();
}
async function parse(page: Page, name: string) {
  await page
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(fixture(name));
  await expect(
    page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".import-step-body")).toBeEnabled({
    timeout: 25000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
}
async function card(page: Page, i: number) {
  await button(page, "Karten ansehen").tap();
  await page
    .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
    .selectOption(String(i));
}
async function take(page: Page) {
  await button(page, "Weiter zur Übernahme").tap();
  await page
    .getByRole("checkbox", {
      name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
      exact: true,
    })
    .check();
  await button(page, "Geprüfte Karten übernehmen").tap();
  await expect(button(page, "Dokument importieren")).toBeVisible();
}
const views = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
];
for (const viewport of views)
  for (const format of ["docx", "pdf"] as const)
    test(`Dokumentimport ${format} ${viewport.width}x${viewport.height}: Originalvergleich, Bearbeitung, neue Sitzung, SCORM und PNG`, async ({
      browser,
    }, info) => {
      test.setTimeout(180000);
      const context = await browser.newContext({ viewport, hasTouch: true }),
        page = await context.newPage();
      const requests: string[] = [];
      page.on("request", (r) => {
        if (
          /^https?:/.test(r.url()) &&
          !r.url().startsWith("http://localhost:5174/")
        )
          requests.push(r.url());
      });
      await teacher(page);
      await page
        .getByLabel("Mystery-Titel", { exact: true })
        .fill("Dokumentimport-Probe");
      await button(page, "Dokument importieren").tap();
      await parse(
        page,
        format === "docx"
          ? "B-Word-Medien-Tabelle.docx"
          : "C-PDF-12-Karten.pdf",
      );
      const source = format === "docx" ? original.B : original.A;
      await expect(
        page
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option"),
      ).toHaveCount(source.length);
      for (let i = 0; i < source.length; i++) {
        await card(page, i);
        await expect(
          page.getByRole("textbox", { name: "Überschrift", exact: true }),
        ).toHaveValue(source[i].title);
        const body = await page
          .getByRole("textbox", { name: "Kartentext", exact: true })
          .inputValue();
        for (const part of source[i].paragraphs)
          expect(norm(body)).toContain(norm(part));
        expect(
          norm(
            await page
              .getByRole("textbox", { name: "Quellenangabe", exact: true })
              .inputValue(),
          ),
        ).toBe(norm(source[i].source));
        await expect(
          page.getByRole("combobox", {
            name: "Import-Kartengruppe",
            exact: true,
          }),
        ).toHaveValue(source[i].extension ? "extension" : "required");
      }
      if (format === "docx") {
        await card(page, 2);
        expect(
          await page
            .getByRole("textbox", { name: "Zeile 1, Spalte 2", exact: true })
            .inputValue(),
        ).toBe("12,5");
        await page
          .getByRole("textbox", { name: "Zeile 1, Spalte 2", exact: true })
          .fill("13,75");
        await page
          .getByRole("textbox", { name: "Tabellenüberschrift", exact: true })
          .fill("Geprüfte Messwerte");
      }
      await card(page, 0);
      const text = page.getByRole("textbox", {
        name: "Kartentext",
        exact: true,
      });
      await text.press("Control+Home");
      await text.press("Control+ArrowRight");
      await button(page, "Karte am Textcursor teilen").tap();
      await expect(
        page
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option"),
      ).toHaveCount(source.length + 1);
      await button(page, "Mit nächster Karte zusammenfügen").tap();
      await expect(
        page
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option"),
      ).toHaveCount(source.length);
      await page
        .getByLabel("Bild ersetzen (PNG, JPEG, WebP)", { exact: true })
        .setInputFiles(fixture("bild-2.jpeg"));
      await expect(page.locator(".import-step-body")).toBeEnabled();
      await page
        .getByRole("textbox", { name: "Bildbeschreibung", exact: true })
        .fill("Eigenes Prüfdiagramm");
      if (format === "pdf") {
        await button(page, "Tabelle hinzufügen").tap();
        await page
          .getByRole("textbox", { name: "Spalte 1", exact: true })
          .fill("Messgröße");
        await page
          .getByRole("textbox", { name: "Spalte 2", exact: true })
          .fill("Wert");
        await page
          .getByRole("textbox", { name: "Zeile 1, Spalte 1", exact: true })
          .fill("Temperatur");
        await page
          .getByRole("textbox", { name: "Zeile 1, Spalte 2", exact: true })
          .fill("12,5 °C");
      }
      await button(page, "Importkarte hinzufügen").tap();
      await page
        .getByRole("textbox", { name: "Überschrift", exact: true })
        .fill("Zusätzliche Kontrollkarte");
      await page
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill("Diese Angabe wurde bewusst im Importassistenten ergänzt.");
      await page
        .getByRole("combobox", { name: "Import-Kartengruppe", exact: true })
        .selectOption("extension");
      await card(page, source.length - 1);
      await button(page, "Importkarte entfernen").tap();
      const width = await page.evaluate(() => ({
        view: innerWidth,
        actual: document.documentElement.scrollWidth,
      }));
      expect(width.actual).toBeLessThanOrEqual(width.view + 1);
      await page.screenshot({
        path: info.outputPath("karten-pruefen.png"),
        fullPage: true,
      });
      await button(page, "Original ansehen").tap();
      await page.screenshot({
        path: info.outputPath("original-vergleichen.png"),
      });
      await take(page);
      await expect(page.getByRole("status")).toContainText(
        `${source.length} Karten übernommen`,
      );
      await button(page, "Hilfen bearbeiten").tap();
      await page
        .getByRole("textbox", { name: "Hilfetext", exact: true })
        .fill("Prüft, welche Beobachtungen eure Erklärung stützen.");
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
        ["2", "group2"],
        [format === "pdf" ? "V3" : "3", "group3"],
      ])
        await page
          .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
          .selectOption(g);
      await button(page, "Hilfe übernehmen").tap();
      await button(page, "Entwurf sichern").tap();
      const draft = await getFile(
        page,
        info,
        `import-${format}-${viewport.width}-entwurf.mysteryboard`,
      );
      expect(draft.document.content.cards).toHaveLength(source.length);
      expect(draft.document.content.cards[0].image).toMatch(
        /^data:image\/jpeg/,
      );
      expect(draft.document.content.cards.at(-1)?.title).toBe(
        "Zusätzliche Kontrollkarte",
      );
      expect(draft.document.content.cards.at(-1)?.group).toBe("extension");
      if (format === "docx")
        expect(draft.document.content.cards[2].table?.rows[0][1]).toBe("13,75");
      else
        expect(draft.document.content.cards[0].table?.rows[0][1]).toBe(
          "12,5 °C",
        );
      expect(requests).toEqual([]);
      await context.close();
      const reopened = await browser.newContext({ viewport, hasTouch: true }),
        p2 = await reopened.newPage();
      await openUniversal(p2);
      await importMystery(p2, draft.bytes);
      await button(p2, "Schülerversion erstellen").tap();
      const task = await getFile(
        p2,
        info,
        `import-${format}-${viewport.width}-aufgabe.mysteryboard`,
      );
      expect(task.document.content).toEqual(draft.document.content);
      expect(task.document.kind).toBe("task");
      await reopened.close();
      const student = await scorm(browser, info, "import-lernen", viewport);
      await importMystery(student.ui, task.bytes);
      await student.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("Importgruppe");
      await button(student.ui, "Beginnen").tap();
      await gestures(student.ui);
      await connect(student.ui, 1, 2, "Begründeter Zusammenhang");
      const before = await project(
        student.ui,
        info,
        `import-${format}-${viewport.width}-projekt`,
      );
      const saved = await png(
        student.ui,
        info,
        `import-${format}-${viewport.width}-schueler`,
      );
      expect(saved.document).toEqual(before.document);
      await student.page.screenshot({
        path: info.outputPath("scorm-schueler.png"),
      });
      await student.finish();
      const fresh = await scorm(browser, info, "import-frisch", viewport);
      await importMystery(fresh.ui, saved.bytes, "arbeit.png");
      expect(
        (
          await project(
            fresh.ui,
            info,
            `import-${format}-${viewport.width}-restauriert`,
          )
        ).document,
      ).toEqual(before.document);
      await connect(fresh.ui, 2, 3, "Nach Wiederherstellung weitergearbeitet");
      await fresh.finish();
    });

test("Word A: 12 Karten, neun Pflicht- und drei explizite Vertiefungskarten; Import bleibt bis zur Bestätigung unverbindlich", async ({
  page,
}, info) => {
  await teacher(page);
  await button(page, "Dokument importieren").tap();
  await parse(page, "A-Word-12-Karten.docx");
  for (let i = 0; i < 12; i++) {
    await card(page, i);
    await expect(
      page.getByRole("textbox", { name: "Überschrift", exact: true }),
    ).toHaveValue(original.A[i].title);
    await expect(
      page.getByRole("textbox", { name: "Kartentext", exact: true }),
    ).toHaveValue(original.A[i].paragraphs.join("\n\n"));
  }
  await take(page);
  await button(page, "Entwurf sichern").tap();
  const saved = await getFile(page, info, "import-A-12-entwurf.mysteryboard");
  expect(
    saved.document.content.cards
      .filter((c) => c.group === "extension")
      .map((c) => c.id),
  ).toEqual([3, 8, 12]);
  expect(saved.document.content.title).toBe("A-Word-12-Karten");
});

test("PDF D/E/G: komplexe Seiten, echter Ausschnitt, Scan ohne OCR und seitenübergreifender Text", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await teacher(page);
  await button(page, "Dokument importieren").tap();
  await parse(page, "D-PDF-Mehrspaltig.pdf");
  await expect(
    page
      .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
      .locator("option"),
  ).toHaveCount(6);
  for (let i = 0; i < original.B.length; i++) {
    await card(page, i);
    await expect(
      page.getByRole("textbox", { name: "Überschrift", exact: true }),
    ).toHaveValue(original.B[i].title);
    const body = norm(
      await page
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .inputValue(),
    );
    for (const part of original.B[i].paragraphs)
      expect(body).toContain(norm(part));
    if (i === 2) {
      for (const row of original.table.rows)
        for (const value of row) expect(body).toContain(value);
    }
    expect(
      norm(
        await page
          .getByRole("textbox", { name: "Quellenangabe", exact: true })
          .inputValue(),
      ),
    ).toBe(original.B[i].source);
  }
  await card(page, 0);
  await button(page, "Original ansehen").tap();
  await expect(
    page
      .getByRole("combobox", { name: "PDF-Seite", exact: true })
      .locator("option"),
  ).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
    .check();
  for (const [name, v] of [
    ["Links (%)", "50"],
    ["Oben (%)", "0"],
    ["Breite (%)", "45"],
    ["Höhe (%)", "30"],
  ])
    await page.getByRole("spinbutton", { name, exact: true }).fill(v);
  await button(page, "Ausschnitt der aktuellen Karte zuordnen").tap();
  await expect(page.locator(".import-step-body")).toBeEnabled();
  await button(page, "Karten ansehen").tap();
  await expect(page.locator(".import-cards .media-view > img")).toHaveCount(1);
  const ratio = await page
    .locator(".import-cards .media-view > img")
    .evaluate((e: HTMLImageElement) => e.naturalWidth / e.naturalHeight);
  expect(ratio).toBeCloseTo(((595 / 842) * 0.45) / 0.3, 1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(fixture("E-PDF-Scan-ohne-Text.pdf"));
  await expect(
    page.getByText(
      "Dieses PDF enthält keinen auslesbaren Text. Sie können eine Seite als Bild übernehmen. Die automatische Texterkennung ergänzen wir später.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".import-step-body")).toBeEnabled({
    timeout: 25000,
  });
  await expect(
    page.getByRole("combobox", { name: "Importkarte auswählen", exact: true }),
  ).toHaveCount(0);
  await button(page, "Original ansehen").tap();
  await button(page, "Seite als Bildkarte hinzufügen").tap();
  await expect(page.locator(".import-step-body")).toBeEnabled();
  await take(page);
  await button(page, "Entwurf sichern").tap();
  const scan = await getFile(page, info, "import-scan-bildkarte.mysteryboard");
  expect(scan.document.content.cards[0].text).toBe("");
  expect(scan.document.content.cards[0].image).toMatch(/^data:image\//);
  await button(page, "Schließen").tap();
  await button(page, "Dokument importieren").tap();
  await parse(page, "G-PDF-Seitenuebergreifend.pdf");
  await card(page, 0);
  const text = await page
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .inputValue();
  expect(text).toContain("Erster Teil: 12,5 °C.");
  expect(text).toContain("Fortsetzung ohne neue Kartenüberschrift: 3,50 g.");
});

test("Fehler, aktive Inhalte, Abbruch und Ersatzbestätigung lassen den vorhandenen Entwurf unverändert; keine Fremdanfragen", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      external.push(r.url());
  });
  await openUniversal(page);
  const bytes = await readFile(
    "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  );
  await importMystery(page, bytes);
  await button(page, "Entwurf sichern").tap();
  const before = await getFile(page, info, "import-vorher.mysteryboard");
  await button(page, "Schließen").tap();
  for (const name of [
    "F-Altformat.doc",
    "F-Defekt.docx",
    "F-Defekt.pdf",
    "F-Word-komprimiert.docx",
    "F-Word-aktive-Inhalte.docx",
    "F-Word-Mediengrenze.docx",
    "F-PDF-JavaScript.pdf",
  ]) {
    await button(page, "Dokument importieren").tap();
    await page
      .getByLabel("Word- oder PDF-Datei", { exact: true })
      .setInputFiles(fixture(name));
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 45000 });
    await button(page, "Zurück zum Entwurf").tap();
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      before.document.content.title,
    );
  }
  await button(page, "Dokument importieren").tap();
  await page
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(fixture("H-PDF-Abbruch-38-Seiten.pdf"));
  await button(page, "Import abbrechen").tap();
  await expect(button(page, "Dokument importieren")).toBeVisible();
  await button(page, "Dokument importieren").tap();
  await parse(page, "F-Word-Text-und-externe-Verweise.docx");
  await expect(
    page.getByRole("textbox", { name: "Kartentext", exact: true }),
  ).toHaveValue(/<script>/);
  expect(
    await page.evaluate(() => (window as any).__importXss),
  ).toBeUndefined();
  page.once("dialog", (d) => d.accept());
  await button(page, "Zurück zum Entwurf").tap();
  await button(page, "Dokument importieren").tap();
  await parse(page, "A-Word-12-Karten.docx");
  await button(page, "Weiter zur Übernahme").tap();
  await page
    .getByRole("radio", {
      name: "Neues Mystery aus dem Dokument erstellen",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
      exact: true,
    })
    .check();
  page.once("dialog", (d) => d.dismiss());
  await button(page, "Geprüfte Karten übernehmen").tap();
  page.once("dialog", (d) => d.accept());
  await button(page, "Zurück zum Entwurf").tap();
  await button(page, "Entwurf sichern").tap();
  const after = await getFile(page, info, "import-nach-abbruch.mysteryboard");
  expect(after.document).toEqual(before.document);
  expect(external).toEqual([]);
});

test("Bestehendes Mystery ergänzen und ein neues Mystery bewusst erstellen bleiben getrennte, versionierte Vorgänge", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await openUniversal(page);
  const base = await readFile(
    "examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard",
  );
  await importMystery(page, base);
  await button(page, "Entwurf sichern").tap();
  const originalDraft = await getFile(
    page,
    info,
    "import-bestand-original.mysteryboard",
  );
  await button(page, "Schließen").tap();
  await button(page, "Dokument importieren").tap();
  await parse(page, "B-Word-Medien-Tabelle.docx");
  await take(page);
  await button(page, "Entwurf sichern").tap();
  const appended = await getFile(
    page,
    info,
    "import-bestand-ergaenzt.mysteryboard",
  );
  expect(appended.document.content.cards).toHaveLength(18);
  expect(appended.document.content.id).toBe(originalDraft.document.content.id);
  expect(appended.document.content.cards.slice(0, 12)).toEqual(
    originalDraft.document.content.cards,
  );
  expect(appended.document.content.help).toEqual(
    originalDraft.document.content.help,
  );
  await button(page, "Schließen").tap();
  await button(page, "Dokument importieren").tap();
  await parse(page, "A-Word-12-Karten.docx");
  await button(page, "Weiter zur Übernahme").tap();
  await page
    .getByRole("radio", {
      name: "Neues Mystery aus dem Dokument erstellen",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", { name: "Mystery-Titel", exact: true })
    .fill("Neues Mystery nur aus Word");
  await page
    .getByRole("checkbox", {
      name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
      exact: true,
    })
    .check();
  page.once("dialog", (d) => d.accept());
  await button(page, "Geprüfte Karten übernehmen").tap();
  await button(page, "Entwurf sichern").tap();
  const created = await getFile(
    page,
    info,
    "import-neue-identitaet.mysteryboard",
  );
  expect(created.document.content.id).not.toBe(appended.document.content.id);
  expect(created.document.content.cards).toHaveLength(12);
  expect(created.document.content.help).toBeUndefined();
  expect(created.document.content.title).toBe("Neues Mystery nur aus Word");
  expect(
    await readFile("examples/help-editor/Hilfe-Lehrkraftentwurf.mysteryboard"),
  ).toEqual(base);
});

test("Importparser werden erst bei der Dateiauswahl instanziiert und nach Abbruch freigegeben", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const W = window.Worker;
    (window as any).__importWorkers = [];
    window.Worker = new Proxy(W, {
      construct(target, args) {
        (window as any).__importWorkers.push(args[1]?.name ?? "");
        return Reflect.construct(target, args);
      },
    });
  });
  await teacher(page);
  expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual(
    [],
  );
  await button(page, "Dokument importieren").tap();
  expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual(
    [],
  );
  await parse(page, "A-Word-12-Karten.docx");
  expect(await page.evaluate(() => (window as any).__importWorkers)).toEqual([
    "mysteryboard-document-import",
  ]);
  expect(await page.evaluate(() => typeof (window as any).pdfjsWorker)).toBe(
    "undefined",
  );
  page.once("dialog", (d) => d.accept());
  await button(page, "Zurück zum Entwurf").tap();
  await expect.poll(() => page.workers().length).toBe(0);
});
