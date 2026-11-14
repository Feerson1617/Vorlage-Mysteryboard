import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { embedWork } from "../../src/core/png";
import { initialWork } from "../../src/core/model";
import { resolve } from "node:path";
import source from "../../examples/universal/content.json" with { type: "json" };
import { encodeDocument, taskDocument } from "../../src/core/documents";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
  type UI,
} from "./authoring-helpers";
test.use({ hasTouch: true });

for (const viewport of [
  { width: 320, height: 700 },
  { width: 600, height: 800 },
])
  test(`Autorenoberfläche ${viewport.width}x${viewport.height}: Tabelle und Quelle bearbeiten, Medienfehler verlieren keine Karte`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await openUniversal(page);
    await button(page, "Eigenes Mystery erstellen").tap();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
    await button(page, "Lehrkräftemodus öffnen").tap();
    await page
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Tabellenprüfung");
    await button(page, "Karte hinzufügen").tap();
    await page
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill("Messwerte");
    await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill("Diese Werte sind bearbeitbar.");
    const picker = page.getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", {
      exact: true,
    });
    await picker.setInputFiles(resolve("examples/universal/diagramm-1.png"));
    await expect(page.locator(".media-view > img")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    const original = await page
      .locator(".media-view > img")
      .getAttribute("src");
    for (const f of [
      {
        name: "kaputt.png",
        mimeType: "image/png",
        buffer: Buffer.from("keine Bilddaten"),
      },
      {
        name: "zu-gross.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(3_000_001),
      },
      {
        name: "seite.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      },
    ]) {
      await picker.setInputFiles(f);
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      await expect(page.locator(".media-view > img")).toHaveAttribute(
        "src",
        original!,
      );
      await expect(
        page.getByRole("textbox", { name: "Kartentext", exact: true }),
      ).toHaveValue("Diese Werte sind bearbeitbar.");
    }
    await button(page, "Tabelle hinzufügen").tap();
    await page
      .getByLabel("Tabellenüberschrift", { exact: true })
      .fill("Messreihe");
    await page.getByLabel("Spalte 1", { exact: true }).fill("Zeit");
    await page.getByLabel("Spalte 2", { exact: true }).fill("Messwert");
    await page.getByLabel("Zeile 1, Spalte 1", { exact: true }).fill("Tag 1");
    await page.getByLabel("Zeile 1, Spalte 2", { exact: true }).fill("12");
    await button(page, "Zeile hinzufügen").tap();
    await page.getByLabel("Zeile 2, Spalte 1", { exact: true }).fill("Tag 2");
    await page.getByLabel("Zeile 2, Spalte 2", { exact: true }).fill("15");
    await page
      .getByRole("textbox", { name: "Quellenangabe (optional)", exact: true })
      .fill("Eigene Messreihe");
    await button(page, "Karte übernehmen").tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await button(page, "Karte 1 bearbeiten").tap();
    await expect(
      page.getByLabel("Zeile 2, Spalte 2", { exact: true }),
    ).toHaveValue("15");
    await page.getByLabel("Zeile 2, Spalte 2", { exact: true }).fill("17");
    await button(page, "Karte übernehmen").tap();
    await button(page, "Entwurf sichern").tap();
    const draft = await getFile(
      page,
      info,
      `tabelle-${viewport.width}-entwurf.mysteryboard`,
    );
    await button(page, "Schließen").tap();
    expect(draft.document.content.cards[0].table!.rows).toEqual([
      ["Tag 1", "12"],
      ["Tag 2", "17"],
    ]);
    expect(
      await page.evaluate(
        () =>
          !window.dispatchEvent(
            new Event("beforeunload", { cancelable: true }),
          ),
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("autorenansicht-" + viewport.width + ".png"),
      fullPage: true,
    });
    await button(page, "Schülerversion erstellen").tap();
    const task = await getFile(
      page,
      info,
      `tabelle-${viewport.width}-aufgabe.mysteryboard`,
    );
    await button(page, "Schließen").tap();
    await page.context().setOffline(false);
    page.once("dialog", (d) => d.accept());
    await openUniversal(page);
    await importMystery(page, task.bytes);
    await page
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Tabellengruppe");
    await button(page, "Beginnen").tap();
    await page.locator('[data-number="1"]').tap();
    await expect(
      page.getByRole("cell", { name: "17", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Quelle: Eigene Messreihe", { exact: true }),
    ).toBeVisible();
    await button(page, "Schließen").tap();
    if (viewport.width === 600) {
      await button(page, "Menü").tap();
      await button(page, "Druckfassung / PDF").tap();
      await expect(button(page, "Drucken / PDF speichern")).toBeEnabled({
        timeout: 60000,
      });
      const frame = await page
        .locator('iframe[title="Druckvorschau"]')
        .elementHandle()
        .then((h) => h!.contentFrame());
      const printPage = await page.context().newPage();
      await printPage.setContent(await frame!.content());
      await printPage.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode()));
      });
      const path = info.outputPath("strukturierte-tabelle.pdf");
      await printPage.pdf({
        path,
        preferCSSPageSize: true,
        printBackground: true,
      });
      await printPage.close();
      const text = execFileSync("pdftotext", ["-raw", path, "-"], {
        encoding: "utf8",
      }).replace(/\s+/g, " ");
      expect(text).toContain("Zeit: Tag 2 | Messwert: 17");
      expect(text).toContain("Quelle: Eigene Messreihe");
    }
  });

test("Fehlerhafte und abgebrochene Imports verändern einen geöffneten Entwurf nicht; HTML bleibt Text", async ({
  page,
}, info) => {
  await openUniversal(page);
  await button(page, "Eigenes Mystery erstellen").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Unverlierbarer Entwurf");
  for (const bytes of [
    Buffer.from("{kaputt"),
    Buffer.from(JSON.stringify({ format: "MysteryBoard", formatVersion: 999 })),
    Buffer.alloc(30_000_001),
  ]) {
    await button(page, "Entwurf öffnen").tap();
    await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
      name: "falsch.mysteryboard",
      mimeType: "application/json",
      buffer: bytes,
    });
    await expect(
      page
        .getByRole("dialog", { name: "Fortsetzen", exact: true })
        .getByRole("alert"),
    ).toBeVisible();
    await button(page, "Abbrechen").tap();
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Unverlierbarer Entwurf",
    );
  }
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((r) => setTimeout(r, 400));
      return original.call(this);
    };
  });
  await button(page, "Entwurf öffnen").tap();
  await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name: "gueltig.mysteryboard",
    mimeType: "application/json",
    buffer: Buffer.from(encodeDocument(taskDocument(source))),
  });
  await button(page, "Abbrechen").tap();
  await page.waitForTimeout(600);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Unverlierbarer Entwurf",
  );
  const raw = structuredClone(source);
  const text =
    '<img src="https://example.invalid/exfiltrate" onerror="window.executed=true"><script>window.executed=true</script>';
  raw.cards[0].text = text;
  const task = taskDocument(raw);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await button(page, "Entwurf öffnen").tap();
  await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name: "texte.mysteryboard",
    mimeType: "application/json",
    buffer: Buffer.from(encodeDocument(task)),
  });
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Sicher");
  await button(page, "Beginnen").tap();
  await page.locator('[data-number="1"]').tap();
  await expect(page.locator(".reading > p").first()).toHaveText(text);
  expect(await page.evaluate(() => (window as any).executed)).toBeUndefined();
  expect(requests).toEqual([]);
  await page.screenshot({
    path: info.outputPath("importierte-inhalte-als-text.png"),
  });
});

for (const kind of ["HTML", "SCORM"])
  test(`Neuer mysteryspezifischer ${kind}-Build bietet denselben vollständigen Lehrkräftemodus`, async ({
    page,
  }, info) => {
    const root = page;
    let ui: UI = page;
    if (kind === "SCORM") {
      const folder = info.outputPath("specific-scorm");
      await mkdir(folder, { recursive: true });
      for (const [name, data] of Object.entries(
        unzipSync(
          await readFile(
            "artifacts/tests/MysteryBoard-Editierbares-Beispiel-SCORM.zip",
          ),
        ),
      ))
        await writeFile(join(folder, name), data);
      await page.addInitScript(() => {
        (window as any).API = {
          LMSInitialize: () => "true",
          LMSFinish: () => "true",
        };
      });
      await page.goto(
        "http://localhost:5174/" +
          relative(process.cwd(), join(folder, "launch.html")),
      );
      await expect(
        page
          .frameLocator("iframe")
          .getByRole("heading", { name: source.title, exact: true }),
      ).toBeVisible();
      ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
    } else
      await page.goto(
        "http://localhost:5174/artifacts/tests/MysteryBoard-Editierbares-Beispiel.html",
      );
    await page.context().setOffline(true);
    await expect(
      ui.getByRole("heading", { name: source.title, exact: true }),
    ).toBeVisible();
    await button(ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
    await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("XY");
    await button(ui, "Lehrkräftemodus öffnen").tap();
    await expect(ui.locator(".author-card-list li")).toHaveCount(12);
    await ui
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Bearbeitet aus dem Einzel-HTML");
    await button(ui, "Entwurf sichern").tap();
    const saved = await getFile(
      ui,
      info,
      "spezifisches-html-entwurf.mysteryboard",
    );
    expect(saved.document.content.title).toBe("Bearbeitet aus dem Einzel-HTML");
    expect(saved.document.content.cards.filter((c) => c.image)).toHaveLength(3);
  });

test("Original-Aufgaben-PNG und gedrehtes JPEG sind vollständig; Legacy-PNG wird verständlich erkannt", async ({
  page,
}, info) => {
  await openUniversal(page);
  await importMystery(page, Buffer.from(encodeDocument(taskDocument(source))));
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await button(page, "Karte 1 bearbeiten").tap();
  await page
    .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
    .setInputFiles(resolve("tests/fixtures/oriented-diagram.jpg"));
  await expect(page.locator(".media-view > img")).toHaveAttribute(
    "src",
    /^data:image\/jpeg/,
  );
  expect(
    await page
      .locator(".media-view > img")
      .evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]),
  ).toEqual([900, 450]);
  await button(page, "Karte übernehmen").tap();
  await button(page, "Aufgabe als PNG").tap();
  await button(page, "Aufgabe als Original-PNG erzeugen").tap();
  const saved = await getFile(
    page,
    info,
    "neutrale-aufgabe.png",
    "Aufgaben-PNG herunterladen",
  );
  expect(saved.document.kind).toBe("task");
  expect("work" in saved.document).toBe(false);
  await button(page, "Schließen").tap();
  await button(page, "Entwurf öffnen").tap();
  await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name: "aufgabe.png",
    mimeType: "image/png",
    buffer: saved.bytes,
  });
  await expect(
    page.getByLabel("Teamname oder Vornamen", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Bildprüfung");
  await button(page, "Beginnen").tap();
  await page.locator('[data-number="1"]').tap();
  await expect(page.locator(".media-view > img")).toHaveAttribute(
    "src",
    saved.document.content.cards[0].image!,
  );
  await button(page, "Schließen").tap();
  const legacy = embedWork(
    new Uint8Array(await readFile("examples/universal/diagramm-1.png")),
    initialWork(saved.document.content),
  );
  await button(page, "Menü").tap();
  await button(page, "Fortsetzen").tap();
  await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name: "alt.png",
    mimeType: "image/png",
    buffer: Buffer.from(legacy),
  });
  await expect(page.getByRole("alert")).toContainText(
    "ursprünglichen passenden Mystery-HTML",
  );
  await button(page, "Abbrechen").tap();
  await expect(page.locator("[data-card]")).toHaveCount(12);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
});

test("Fehler bei Projektdatei und Downloadvorbereitung bleiben verständlich und verlieren keinen Entwurf", async ({
  page,
}, info) => {
  await openUniversal(page);
  await button(page, "Eigenes Mystery erstellen").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Entwurf trotz Dateifehler");
  await page.evaluate(() => {
    (window as any).__originalFile = File;
    (window as any).File = class extends File {
      constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) {
        if (name.endsWith(".mysteryboard"))
          throw new Error("Dateigrenze für den Test erreicht.");
        super(parts, name, options);
      }
    };
  });
  await button(page, "Entwurf sichern").tap();
  await expect(page.getByRole("alert")).toContainText(
    "Der geöffnete Stand bleibt erhalten",
  );
  await button(page, "Schließen").tap();
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Entwurf trotz Dateifehler",
  );
  await page.evaluate(() => {
    (window as any).File = (window as any).__originalFile;
    (window as any).__createURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error("Download nicht verfügbar");
    };
  });
  await button(page, "Entwurf sichern").tap();
  await expect(page.getByRole("alert")).toContainText(
    "Der Download konnte nicht vorbereitet werden",
  );
  await button(page, "Schließen").tap();
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Entwurf trotz Dateifehler",
  );
  await page.evaluate(() => {
    URL.createObjectURL = (window as any).__createURL;
  });
  await button(page, "Entwurf sichern").tap();
  const saved = await getFile(
    page,
    info,
    "entwurf-nach-dateifehler.mysteryboard",
  );
  expect(saved.document.content.title).toBe("Entwurf trotz Dateifehler");
  expect(saved.document.kind).toBe("draft");
});
