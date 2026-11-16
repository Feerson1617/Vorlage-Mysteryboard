import { test, expect, type Page, type Frame } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { unzipSync } from "fflate";
import { button, getFile, importMystery } from "./authoring-helpers";
import { readDocument, type Draft } from "../../src/core/documents";
const fixtures = resolve("tests/fixtures/ocr");
const output =
  process.env.OCR_EVIDENCE_DIR || "/workspace/mysteryboard-ocr-evidence";
test.use({ hasTouch: true });
async function open(page: Page) {
  page.setDefaultTimeout(15000);
  const zip = unzipSync(
    await readFile("artifacts/MysteryBoard-OCR-SCORM-1.2.zip"),
  );
  const requests: { url: string; method: string }[] = [];
  const api: string[] = [];
  const errors: string[] = [];
  await page.addInitScript(() => {
    (window as any).API = {
      LMSInitialize: () => "true",
      LMSFinish: () => "true",
      LMSSetValue: () => {
        throw Error("No learner data");
      },
      LMSCommit: () => {
        throw Error("No learner data");
      },
    };
  });
  await page
    .context()
    .route("http://localhost:5174/ocr-sco/**", async (route) => {
      const name = new URL(route.request().url()).pathname.slice(
          "/ocr-sco/".length,
        ),
        data = zip[name];
      if (!data) return route.fulfill({ status: 404, body: "missing" });
      await route.fulfill({
        body: Buffer.from(data),
        contentType: name.endsWith(".html")
          ? "text/html"
          : name.endsWith(".js")
            ? "text/javascript"
            : "application/octet-stream",
      });
    });
  await page
    .context()
    .route(/^https?:\/\/(?!localhost:5174\/ocr-sco\/)/, (route) => {
      requests.push({
        url: route.request().url(),
        method: route.request().method(),
      });
      return route.abort();
    });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto("http://localhost:5174/ocr-sco/launch.html");
  const ui = page
    .frames()
    .find((f) => f.url() === "http://localhost:5174/ocr-sco/app.html")!;
  await button(ui, "Lehrkräfteeditor").tap();
  await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("OC");
  await button(ui, "Lehrkräftemodus öffnen").tap();
  return { ui, requests, api, errors };
}
async function load(ui: Frame, name: string) {
  await button(ui, "Foto oder Scan importieren").tap();
  await ui
    .getByLabel("Foto oder Scan", { exact: true })
    .setInputFiles(resolve(fixtures, name));
  await expect(
    ui.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 30000 },
  );
  await button(ui, "Original ansehen").tap();
}
async function recognize(ui: Frame, allowEmpty = false) {
  await button(ui, "Kartengrenzen und Text erkennen").tap();
  await expect(ui.locator(".import-step-body")).toHaveAttribute("disabled", "");
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    {
      timeout: 180000,
    },
  );
  const alerts = await ui.getByRole("alert").allTextContents();
  if (alerts.length) {
    await mkdir(output, { recursive: true });
    await writeFile(
      join(output, `OCR-Hinweis-${Date.now()}.json`),
      JSON.stringify(
        { alerts, status: await ui.getByRole("status").allTextContents() },
        null,
        2,
      ),
    );
  }
  if (!allowEmpty) await expect(ui.getByRole("alert")).toHaveCount(0);
  else
    for (const text of await ui.getByRole("alert").allTextContents())
      expect(text).toMatch(/Kein verwertbarer Text|Bereiche überlagern/);
}
async function snapshot(ui: Frame) {
  await button(ui, "Karten ansehen").tap();
  const n = await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count(),
    cards = [];
  for (let i = 0; i < n; i++) {
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .selectOption(String(i));
    cards.push({
      title: await ui.getByLabel("Überschrift", { exact: true }).inputValue(),
      text: await ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .inputValue(),
      source: await ui
        .getByRole("textbox", { name: "Quellenangabe", exact: true })
        .inputValue(),
      warning: await ui.getByLabel("OCR kontrollieren").innerText(),
    });
  }
  return cards;
}
test("Lokale OCR: echte 20- und 16-Karten-Scans, Absätze und Buchstaben", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const { ui, requests, errors } = await open(page);
  await mkdir(output, { recursive: true });
  for (const [name, expected, pages] of [
    ["Scan-A-20.pdf", 20, 2],
    ["Scan-B-16.pdf", 16, 1],
  ] as const) {
    if (await button(ui, "Zurück zum Entwurf").count()) {
      page.once("dialog", (d) => d.accept());
      await button(ui, "Zurück zum Entwurf").tap();
    }
    await load(ui, name);
    const timings = [];
    for (let p = 1; p <= pages; p++) {
      if (p > 1) {
        await button(ui, "Original ansehen").tap();
        await ui
          .getByLabel("PDF-Seite", { exact: true })
          .selectOption(String(p));
        await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
          "disabled",
          "",
          {
            timeout: 30000,
          },
        );
      }
      const start = Date.now();
      await recognize(ui);
      timings.push(Date.now() - start);
    }
    const cards = await snapshot(ui);
    await writeFile(
      join(output, name + ".json"),
      JSON.stringify({ cards, timings, requests, errors }, null, 2),
    );
    expect(cards).toHaveLength(expected);
    expect(cards.every((c) => c.title.startsWith("Karte"))).toBeTruthy();
    expect(cards.some((c) => c.text.includes("1912"))).toBeTruthy();
    for (const c of cards) expect(c.warning).toContain("Zahlen, Einheiten");
    expect(cards.some((c) => c.text.includes("\n\n"))).toBeTruthy();
    if (expected === 16) {
      const titles = [..."JGCDEFBHIAKLPNOM"].map((c) => "Karte " + c);
      const differences = cards.flatMap((c, i) =>
        c.title === titles[i]
          ? []
          : [{ card: i + 1, raw: c.title, expected: titles[i] }],
      );
      await writeFile(
        join(output, "B-Originalvergleich.json"),
        JSON.stringify({ differences, automaticCorrection: false }, null, 2),
      );
      // A transcription error must remain visible, never silently inferred.
      for (let i = 0; i < 16; i++) {
        await ui
          .getByLabel("Importkarte auswählen", { exact: true })
          .selectOption(String(i));
        await ui
          .getByRole("textbox", { name: "Überschrift", exact: true })
          .fill(titles[i]);
      }
      const corrected = await snapshot(ui);
      expect(corrected.map((c) => c.title)).toEqual(titles);
    }
    await button(ui, "Original ansehen").tap();
    await page.screenshot({
      path: join(output, name + ".png"),
      fullPage: true,
    });
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
test("Lokale OCR: Fotokarten mit Umlauten, Zahlen, Positionsdaten und Einzelkontrolle", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const { ui, requests, errors } = await open(page);
  await load(ui, "Gerades-Foto.jpg");
  await recognize(ui);
  const cards = await snapshot(ui);
  await writeFile(
    join(output, "Foto-roh.json"),
    JSON.stringify(cards, null, 2),
  );
  expect(cards).toHaveLength(4);
  expect(
    cards.every(
      (c) =>
        c.text.includes("Müller") &&
        c.text.includes("1,5 °C") &&
        c.text.includes("2,1 mg/l"),
    ),
  ).toBeTruthy();
  await button(ui, "Weiter zur Übernahme").tap();
  await ui.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
  await button(ui, "Geprüfte Karten übernehmen").tap();
  await expect(ui.getByRole("alert")).toContainText("einzeln");
  await button(ui, "Zurück zu den Karten").tap();
  for (let i = 0; i < 4; i++) {
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .selectOption(String(i));
    await ui.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
  }
  await button(ui, "Weiter zur Übernahme").tap();
  await ui.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
  await button(ui, "Geprüfte Karten übernehmen").tap();
  await expect(button(ui, "Dokument importieren")).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

import { openUniversal } from "./authoring-helpers";
import { downloadClassroom, classroom } from "./pdf-region-helpers";
import { gestures, connect, png, project } from "./help-runtime-helpers";
for (const file of ["Gerades-Foto.jpg", "Scan-B-16.pdf"])
  test(`OCR-Unterrichtsworkflow ${file}: Grenze, Korrektur, Entwurf, frisches SCORM und PNG`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(300000);
    const { ui, requests, errors } = await open(page);
    await load(ui, file);
    await recognize(ui);
    const picker = ui.getByLabel("Importkarte auswählen", { exact: true });
    const n = await picker.locator("option").count();
    const expectedCount = file.endsWith("pdf") ? 16 : 4;
    expect(n).toBe(expectedCount);
    await picker.selectOption("0");
    await button(ui, "Original ansehen").tap();
    await button(ui, "Kartengrenze markieren").tap();
    await ui.getByLabel("Links (%)", { exact: true }).fill("5");
    page.once("dialog", (d) => d.accept());
    await button(ui, "Grenze aktualisieren und Text neu lesen").tap();
    await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
      "disabled",
      "",
      { timeout: 180000 },
    );
    await button(ui, "Karten ansehen").tap();
    page.once("dialog", (d) => d.accept());
    await button(ui, "Diese Karte erneut per OCR erkennen").tap();
    await expect(ui.locator(".import-step-body")).toHaveAttribute(
      "disabled",
      "",
    );
    await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
      "disabled",
      "",
      { timeout: 180000 },
    );
    // Deliberate correction based on the independently supplied test-sheet text,
    // not a fuzzy assertion or a normalized OCR replacement in production.
    const corrected = file.endsWith("pdf")
      ? "1912 prüft Müller die Küste.\n1,5 °C und 2,1 mg/l.\n\n600 Millionen Liter.\nGröße, süßes Öl und Grüße."
      : "1912 prüft Müller die Küste.\nGrüße, Größe und süßes Öl.\n1,5 °C und 2,1 mg/l.\n600 Millionen Liter.";
    await ui
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(corrected);
    await ui
      .getByRole("combobox", { name: "Import-Kartengruppe", exact: true })
      .selectOption("extension");
    for (let i = 0; i < n; i++) {
      await picker.selectOption(String(i));
      await ui
        .getByRole("textbox", { name: "Überschrift", exact: true })
        .fill(
          "Karte " +
            (file.endsWith("pdf") ? "JGCDEFBHIAKLPNOM"[i] : String(i + 1)),
        );
      await ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill(corrected);
      await ui
        .getByRole("textbox", { name: "Quellenangabe", exact: true })
        .fill("Übung 2026.");
      await ui.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
    }
    if (file.endsWith("jpg")) {
      for (const viewport of [
        { width: 1024, height: 768 },
        { width: 768, height: 1024 },
        { width: 600, height: 800 },
        { width: 320, height: 700 },
      ]) {
        await page.setViewportSize(viewport);
        await button(ui, "Original ansehen").tap();
        expect(
          await ui.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: join(output, `OCR-Original-${viewport.width}.png`),
          fullPage: true,
        });
        await button(ui, "Karten ansehen").tap();
        await page.screenshot({
          path: join(output, `OCR-Karten-${viewport.width}.png`),
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1024, height: 768 });
    }
    await page.screenshot({
      path: join(output, `Korrektur-${file}.png`),
      fullPage: true,
    });
    const correctedCards = await snapshot(ui);
    expect(
      correctedCards.every(
        (c) => c.text === corrected && c.source === "Übung 2026.",
      ),
    ).toBeTruthy();
    await writeFile(
      join(output, `Korrigiert-${file}.json`),
      JSON.stringify(correctedCards, null, 2),
    );
    await ui.locator(".ocr-original-detail > summary").click();
    await expect(ui.locator(".ocr-original-detail img")).toBeVisible();
    expect(
      (await ui.locator(".ocr-original-detail img").boundingBox())!.width,
    ).toBeGreaterThan(200);
    await ui
      .locator(".ocr-original-detail")
      .screenshot({ path: join(output, `OCR-Originalausschnitt-${file}.png`) });
    await button(ui, "Weiter zur Übernahme").tap();
    await ui.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
    await button(ui, "Geprüfte Karten übernehmen").tap();
    await ui
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Lokale OCR – neutrale Übung");
    for (const id of ["V1", "2"]) {
      await button(ui, `Karte ${id} bearbeiten`).tap();
      await ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill(
          id === "V1"
            ? corrected
            : "Zweite Karte im bestehenden Editor geprüft: 1912 und 2,1 mg/l.",
        );
      await button(ui, "Karte übernehmen").tap();
    }
    await button(ui, "Hilfen bearbeiten").tap();
    await ui
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill("Vergleicht Zahlen und Quellen.");
    await ui
      .getByRole("checkbox", {
        name: "Kartennummern als Hilfe markieren",
        exact: true,
      })
      .check();
    await ui
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("causes");
    for (const [id, g] of [
      ["V1", "group1"],
      ["2", "group2"],
      ["3", "group3"],
    ])
      await ui
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(g);
    await button(ui, "Hilfe übernehmen").tap();
    await button(ui, "Entwurf sichern").tap();
    const draft = await getFile(ui, info, `OCR-${file}-Entwurf.mysteryboard`);
    await button(ui, "Schließen").tap();
    expect(draft.document.content.cards).toHaveLength(n);
    expect(draft.document.content.cards[0].text).toBe(corrected);
    await writeFile(
      join(output, `OCR-${file}-Entwurf.mysteryboard`),
      draft.bytes,
    );
    const context = await browser.newContext({ hasTouch: true }),
      fresh = await context.newPage();
    await openUniversal(fresh);
    await importMystery(fresh, draft.bytes);
    await button(fresh, "Schülerversion erstellen").tap();
    const task = await getFile(fresh, info, `OCR-${file}-Aufgabe.mysteryboard`);
    expect(task.document.content).toEqual(draft.document.content);
    await button(fresh, "Schließen").tap();
    const zip = await downloadClassroom(
      fresh,
      info,
      `OCR-${file}-Unterricht-SCORM.zip`,
    );
    await writeFile(join(output, `OCR-${file}-Unterricht-SCORM.zip`), zip);
    expect(Buffer.from(unzipSync(zip)["app.html"]).toString()).not.toContain(
      '<meta name="mysteryboard-ocr"',
    );
    await context.close();
    const viewport = { width: 1024, height: 768 };
    const student = await classroom(
      browser,
      info,
      zip,
      "Lokale OCR – neutrale Übung",
      viewport,
      "ocr-schueler",
    );
    await student.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Team Küste");
    await button(student.ui, "Beginnen").tap();
    await gestures(student.ui);
    await connect(student.ui, 1, 2, "Natürlicher Zusammenhang");
    const before = await project(student.ui, info, "OCR-vorher");
    const saved = await png(student.ui, info, "OCR-Original");
    expect(saved.filename).toBe("Team Küste_Lokale OCR – neutrale Übung.png");
    expect(saved.document).toEqual(before.document);
    await writeFile(join(output, `OCR-${file}-Original.png`), saved.bytes);
    await student.finish();
    const restored = await classroom(
      browser,
      info,
      zip,
      "Lokale OCR – neutrale Übung",
      viewport,
      "ocr-wiederhergestellt",
    );
    await button(restored.ui, "Fortsetzen").tap();
    await restored.ui
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles({
        name: "Original.png",
        mimeType: "image/png",
        buffer: saved.bytes,
      });
    const after = await project(restored.ui, info, "OCR-nachher");
    expect(after.document).toEqual(before.document);
    await expect(restored.ui.locator('[data-arrowhead="1"]')).toHaveAttribute(
      "data-direction",
      "1",
    );
    await restored.finish();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await writeFile(
      join(output, `Workflow-${file}.json`),
      JSON.stringify(
        {
          cards: n,
          correctedText: corrected,
          restored: after.document,
          externalRequests: requests,
          errors,
          workflow:
            "23 steps; actual OCR-SCO + fresh draft HTML + exported classroom SCO + fresh PNG restore",
        },
        null,
        2,
      ),
    );
  });

test("OCR: Abbruch beim Start, aktive Erkennung, Wiederholung und defekte Dateien erhalten den Entwurf", async ({
  page,
}) => {
  test.setTimeout(180000);
  const { ui, requests, errors } = await open(page);
  await ui
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Unveränderter Entwurf");
  await load(ui, "Gerades-Foto.jpg");
  for (let i = 0; i < 2; i++) {
    await button(ui, "Kartengrenzen und Text erkennen").tap();
    await expect(button(ui, "OCR abbrechen")).toBeVisible();
    if (i)
      await expect
        .poll(
          () =>
            page.workers().filter((w) => w.url().includes("ocr/worker")).length,
        )
        .toBe(1);
    await button(ui, "OCR abbrechen").tap();
    await expect(ui.getByRole("alert")).toContainText("abgebrochen");
    await expect
      .poll(
        () =>
          page.workers().filter((w) => w.url().includes("ocr/worker")).length,
      )
      .toBe(0);
  }
  await ui.evaluate(() => {
    const pressure = new Uint8Array(64 * 1024 * 1024);
    pressure.fill(17);
    (window as any).__ocrPressure = pressure;
  });
  await recognize(ui);
  expect(
    await ui.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
    })),
  ).toEqual({ local: 0, session: 0, databases: 0 });
  await ui.evaluate(() => delete (window as any).__ocrPressure);
  expect(
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count(),
  ).toBe(4);
  page.once("dialog", (d) => d.accept());
  await button(ui, "Zurück zum Entwurf").tap();
  await expect(ui.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Unveränderter Entwurf",
  );
  for (const [name, buffer] of [
    ["defekt.png", Buffer.from("no png")],
    ["photo.heic", Buffer.from("not supported")],
    ["gross.jpg", Buffer.alloc(20_000_001)],
  ] as const) {
    await button(ui, "Foto oder Scan importieren").tap();
    await ui
      .getByLabel("Foto oder Scan", { exact: true })
      .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
    await expect(ui.getByRole("alert")).toBeVisible();
    await button(ui, "Zurück zum Entwurf").tap();
    await expect(ui.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Unveränderter Entwurf",
    );
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
for (const missing of ["deu.traineddata.gz", "worker.min.js"])
  test(`OCR: fehlende lokale Ressource ${missing}`, async ({ page }) => {
    test.setTimeout(60000);
    const { ui, requests } = await open(page);
    await ui
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Entwurf behalten");
    await load(ui, "Gerades-Foto.jpg");
    await page
      .context()
      .route(`**/ocr/${missing}`, (r) =>
        r.fulfill({ status: 404, body: "missing local test resource" }),
      );
    await button(ui, "Kartengrenzen und Text erkennen").tap();
    await expect(ui.getByRole("alert")).toContainText(/OCR|Sprachdatei/, {
      timeout: 25000,
    });
    await expect
      .poll(
        () =>
          page.workers().filter((w) => w.url().includes("ocr/worker")).length,
      )
      .toBe(0);
    await button(ui, "Zurück zum Entwurf").tap();
    await expect(ui.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Entwurf behalten",
    );
    expect(requests).toEqual([]);
  });
for (const [name, options] of [
  ["Ohne-Rahmen.png", null],
  ["Einzelkarte.png", null],
  ["Schraeges-Foto.png", 3],
  ["Gedrehtes-Foto.png", 90],
  ["Schatten.png", null],
  ["Schwacher-Kontrast.png", null],
  ["Teilweise-unscharf.png", null],
  ["Kleine-Schrift.png", null],
] as const)
  test(`OCR-Fotovergleich ${name}`, async ({ page }) => {
    test.setTimeout(120000);
    const { ui, requests, errors } = await open(page);
    await load(ui, name);
    if (options !== null) {
      await ui.getByText("Bild vorbereiten", { exact: true }).click();
      await ui
        .getByLabel("Schräglage (Grad)", { exact: true })
        .fill(String(options));
      await button(ui, "Bildvorbereitung anwenden").tap();
      await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
        "disabled",
        "",
      );
    }
    await recognize(ui, true);
    const initialAlerts = await ui.getByRole("alert").allTextContents();
    let fallback = false;
    if (initialAlerts.some((text) => /Bereiche überlagern/.test(text))) {
      fallback = true;
      await page.screenshot({
        path: join(output, `Automatik-Grenze-${name}.png`),
        fullPage: true,
      });
      await ui
        .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
        .check();
      for (const [label, value] of [
        ["Links (%)", "4"],
        ["Oben (%)", "3.33"],
        ["Breite (%)", "44"],
        ["Höhe (%)", "41.67"],
      ])
        await ui.getByLabel(label, { exact: true }).fill(value);
      await button(ui, "Markierung als Textkarte hinzufügen").tap();
      await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
        "disabled",
        "",
        { timeout: 90000 },
      );
    }
    const cards = await snapshot(ui);
    expect(cards.length).toBeGreaterThan(0);
    expect(
      cards.every((c) => c.warning.includes("Keine Garantie")),
    ).toBeTruthy();
    await writeFile(
      join(output, name + ".json"),
      JSON.stringify(
        {
          cards,
          manualAngle: options,
          automaticSegmentationRejected: fallback,
          initialAlerts,
          requests,
          errors,
        },
        null,
        2,
      ),
    );
    await page.screenshot({
      path: join(output, name + ".png"),
      fullPage: true,
    });
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    if (name === "Ohne-Rahmen.png") expect(cards).toHaveLength(6);
    if (name === "Einzelkarte.png") expect(cards).toHaveLength(1);
  });

if (process.env.OCR_PRIVATE_CASES)
  test("Private Originale: reine Bildscans 20/16, keine öffentlichen Inhalte", async ({
    page,
  }) => {
    test.setTimeout(300000);
    const samples = JSON.parse(
      await readFile(process.env.OCR_PRIVATE_CASES!, "utf8"),
    );
    const { ui, requests, errors } = await open(page);
    for (const sample of samples) {
      if (await button(ui, "Zurück zum Entwurf").count()) {
        page.once("dialog", (d) => d.accept());
        await button(ui, "Zurück zum Entwurf").tap();
      }
      await load(ui, sample.file);
      for (let p = 1; p <= sample.pages; p++) {
        if (p > 1) {
          await button(ui, "Original ansehen").tap();
          await ui
            .getByLabel("PDF-Seite", { exact: true })
            .selectOption(String(p));
          await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
            "disabled",
            "",
            { timeout: 30000 },
          );
        }
        await recognize(ui);
      }
      const cards = await snapshot(ui);
      await mkdir(output, { recursive: true });
      await writeFile(
        join(output, sample.alias + ".json"),
        JSON.stringify(
          {
            raw: cards,
            expectedTitles: sample.titles,
            external: requests,
            errors,
          },
          null,
          2,
        ),
      );
      expect(cards).toHaveLength(sample.cards);
      await page.screenshot({
        path: join(output, sample.alias + ".png"),
        fullPage: true,
      });
    }
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });

test("OCR-Kartengrenzen: teilen, zusammenführen, leere Region, Touch-Markierung, Tastatur und Einzeltextschutz", async ({
  page,
}) => {
  test.setTimeout(180000);
  const { ui, requests, errors } = await open(page);
  await load(ui, "Gerades-Foto.jpg");
  await recognize(ui);
  const before = await snapshot(ui);
  await ui
    .getByLabel("Importkarte auswählen", { exact: true })
    .selectOption("0");
  await button(ui, "Original ansehen").tap();
  page.once("dialog", (d) => d.accept());
  await button(ui, "Bereich teilen").tap();
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 180000 },
  );
  expect(
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count(),
  ).toBe(5);
  await ui
    .getByLabel("Anderer Kartenbereich", { exact: true })
    .selectOption("5");
  page.once("dialog", (d) => d.accept());
  await button(ui, "Bereiche zusammenführen").tap();
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 180000 },
  );
  const after = await snapshot(ui);
  expect(after).toHaveLength(4);
  expect(after.slice(1)).toEqual(before.slice(1));
  await button(ui, "Original ansehen").tap();
  await ui
    .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
    .check();
  // A real touch drag, not a DOM-generated selection, changes the crop box.
  await ui.evaluate(() => {
    (window as any).__regionEvents = [];
    for (const type of ["pointerdown", "pointerup", "pointercancel", "click"])
      document.addEventListener(
        type,
        (e) => {
          const p = e as PointerEvent;
          const target = e.target as Element;
          (window as any).__regionEvents.push({
            type,
            x: p.clientX,
            y: p.clientY,
            tag: target.tagName,
            text: target.textContent?.slice(0, 70),
          });
        },
        true,
      );
  });
  const rect = (await ui.locator(".import-page").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const p = (x: number, y: number) => ({ id: 1, x, y });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [p(rect.x + 2, rect.y + 2)],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [p(rect.x + rect.width * 0.03, rect.y + rect.height * 0.03)],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await ui.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  for (const label of ["Links (%)", "Oben (%)"])
    await ui.getByLabel(label, { exact: true }).fill("0");
  for (const label of ["Breite (%)", "Höhe (%)"])
    await ui.getByLabel(label, { exact: true }).fill("3");
  // CDP drag + Playwright native tap can lose the following compatibility
  // click even on a bare HTML page (see the retained driver probe). Exercise
  // touch marking and the genuine keyboard action without injecting a click.
  const add = button(ui, "Markierung als Textkarte hinzufügen");
  await add.focus();
  await add.press("Enter");
  await ui.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await writeFile(
    join(output, "manual-events.json"),
    JSON.stringify(
      await ui.evaluate(() => ({
        events: (window as any).__regionEvents,
        alerts: [...document.querySelectorAll("[role=alert]")].map(
          (e) => e.textContent,
        ),
        text: document.body.innerText.slice(-2000),
      })),
      null,
      2,
    ),
  );
  await expect(
    ui.getByLabel("Importkarte auswählen", { exact: true }).locator("option"),
  ).toHaveCount(5, { timeout: 90000 });
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 180000 },
  );
  await cdp.detach();
  await ui.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await button(ui, "Karten ansehen").tap();
  await expect(ui.getByRole("alert")).toContainText("Kein verwertbarer Text");
  await expect(
    ui.getByRole("checkbox", { name: /Diese OCR-Karte/ }),
  ).toBeDisabled();
  await button(ui, "Importkarte entfernen").tap();
  expect(
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count(),
  ).toBe(4);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Gemischte PDF: Textebene unverändert, fehlende Bildkarte gezielt per OCR ohne Verdopplung", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { ui, requests, errors } = await open(page);
  await load(ui, "Gemischt.pdf");
  await button(ui, "Karten ansehen").tap();
  const text = await ui
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .inputValue();
  expect(text).toBe("Vorhandener Text: 1912 und 2,1 mg/l.");
  await button(ui, "Original ansehen").tap();
  await ui
    .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
    .check();
  for (const [label, value] of [
    ["Links (%)", "11.63"],
    ["Oben (%)", "22"],
    ["Breite (%)", "35.5"],
    ["Höhe (%)", "28.5"],
  ])
    await ui.getByLabel(label, { exact: true }).fill(value);
  await button(ui, "Markierung als Textkarte hinzufügen").tap();
  await expect(ui.locator(".import-step-body")).toHaveAttribute("disabled", "");
  await expect(ui.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 60000 },
  );
  await expect(ui.getByRole("alert")).toHaveCount(0);
  await button(ui, "Karten ansehen").tap();
  await expect(
    ui.getByRole("textbox", { name: "Kartentext", exact: true }),
  ).toContainText("1912");
  await ui
    .getByLabel("Importkarte auswählen", { exact: true })
    .selectOption("0");
  await expect(
    ui.getByRole("textbox", { name: "Kartentext", exact: true }),
  ).toHaveValue(text);
  expect(
    await ui
      .getByLabel("Importkarte auswählen", { exact: true })
      .locator("option")
      .count(),
  ).toBe(2);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
test("WebP-Foto: tatsächliche Dekodierung und lokale Mehrkarten-OCR", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { ui, requests, errors } = await open(page);
  await load(ui, "Foto.webp");
  await recognize(ui);
  const cards = await snapshot(ui);
  expect(cards).toHaveLength(4);
  expect(cards[0].text).toContain("Müller");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Scan-PDF zuschneiden: Prozentmarkierung entspricht Rasterpixeln, rechte Spalte bleibt vollständig", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { ui, requests, errors } = await open(page);
  await load(ui, "Scan-B-16.pdf");
  const image = ui.locator(".import-page > img");
  const before = await image.evaluate((im: HTMLImageElement) => ({
    width: im.naturalWidth,
    height: im.naturalHeight,
  }));
  expect(before.width).toBeGreaterThan(1000);
  await ui.getByText("Bild vorbereiten", { exact: true }).click();
  await ui
    .getByRole("checkbox", { name: "Ausschnitt markieren", exact: true })
    .check();
  for (const [label, value] of [
    ["Links (%)", "50"],
    ["Oben (%)", "0"],
    ["Breite (%)", "50"],
    ["Höhe (%)", "100"],
  ])
    await ui.getByLabel(label, { exact: true }).fill(value);
  await button(ui, "Auf Markierung zuschneiden").tap();
  await expect
    .poll(() => image.evaluate((im: HTMLImageElement) => im.naturalWidth))
    .toBe(Math.floor(before.width / 2));
  expect(await image.evaluate((im: HTMLImageElement) => im.naturalHeight)).toBe(
    before.height,
  );
  await recognize(ui);
  const cards = await snapshot(ui);
  expect(cards).toHaveLength(8);
  expect(cards.map((c) => c.title)).toEqual(
    [..."GDFHALNM"].map((c) => "Karte " + c),
  );
  expect(cards.some((c) => c.text.includes("1912"))).toBeTruthy();
  await writeFile(
    join(output, "PDF-Zuschnitt.json"),
    JSON.stringify(
      {
        before,
        after: await image.evaluate((im: HTMLImageElement) => ({
          width: im.naturalWidth,
          height: im.naturalHeight,
        })),
        cards,
      },
      null,
      2,
    ),
  );
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
