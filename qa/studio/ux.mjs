import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";
import {
  button as b,
  saveProject,
  openExports,
  closeExports,
  overview,
  correction,
  simpleImport,
} from "./controls.mjs";
import { playerWorkflow } from "./player-workflow.mjs";
const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-ux-evidence",
);
await mkdir(out, { recursive: true });
const server = await host(out),
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
const records = [],
  exports = [],
  errors = [],
  requests = [];
let page,
  selected = "",
  cancelSave = false;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.route("**/*", (r) => {
    requests.push(r.request().url());
    return /^https?:/.test(r.request().url()) &&
      !r.request().url().startsWith(server.origin)
      ? r.abort()
      : r.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("qaOpen", async () => ({
    bytes: [...(await readFile(selected))],
    name: selected.split("/").at(-1),
  }));
  await page.exposeFunction("qaSave", async (bytes, saveAs) => {
    records.push({ operation: "save", saveAs, canceled: cancelSave });
    if (cancelSave) return null;
    await writeFile(join(out, "UX-Projekt.mysteryboard"), Buffer.from(bytes));
    return { name: "UX-Projekt.mysteryboard" };
  });
  await page.exposeFunction("qaExport", async (bytes, name) => {
    await writeFile(join(out, name), Buffer.from(bytes));
    exports.push(name);
    return true;
  });
  await page.addInitScript(() => {
    const commands = [],
      saves = [];
    window.__studioCommand = (command) => commands.forEach((fn) => fn(command));
    window.mysteryStudio = {
      openProject: async () => {
        const d = await window.qaOpen();
        return { ...d, bytes: new Uint8Array(d.bytes) };
      },
      recentProjects: async () => [],
      detachProject: async () => {},
      saveProject: async (bytes, saveAs) => {
        const r = await window.qaSave([...bytes], saveAs);
        if (r) saves.forEach((fn) => fn({ bytes, name: r.name }));
        return r;
      },
      projectState: async (state) => {
        window.__studioState = state;
      },
      onSaved: (fn) => {
        saves.push(fn);
        return () => saves.splice(saves.indexOf(fn), 1);
      },
      onCommand: (fn) => {
        commands.push(fn);
        return () => commands.splice(commands.indexOf(fn), 1);
      },
      saveExport: (bytes, name) => window.qaExport([...bytes], name),
      previewTask: async () => {},
    };
  });
  const button = (name) => b(page, name);
  const start = async (title) => {
    await page.goto(server.origin + "/studio/dist/studio/index.html");
    await button("Neues Mystery erstellen").click();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("UX");
    await button("Mystery erstellen").click();
    await page
      .getByRole("textbox", { name: "Mystery-Titel", exact: true })
      .fill(title);
    expect(
      await page
        .getByRole("navigation", { name: "Mystery bearbeiten" })
        .getByRole("button")
        .allTextContents(),
    ).toEqual([
      "Karte hinzufügen",
      "Importieren",
      "Mystery gestalten",
      "Exportieren",
    ]);
    await expect(page.locator(".studio-project-menu")).toHaveCount(0);
  };
  await start("Vier Beobachtungen");
  await openExports(page);
  await expect(button("Bearbeitbares Mystery sichern")).toBeEnabled();
  await expect(button("Für itslearning exportieren")).toBeDisabled();
  await page.screenshot({ path: join(out, "Export-leeres-Projekt.png") });
  await saveProject(page);
  expect(
    JSON.parse(await readFile(join(out, "UX-Projekt.mysteryboard"))).content
      .cards,
  ).toHaveLength(0);
  for (let i = 1; i <= 4; i++) {
    await button("Karte hinzufügen").click();
    await page
      .getByRole("textbox", { name: "Kartenüberschrift", exact: true })
      .fill("Beobachtung " + i);
    await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill("1912, 1,5 °C und 2,1 mg/l bleiben vollständig erhalten.");
    await button("Karte übernehmen").click();
  }
  await expect(page.locator(".studio-unsaved")).toBeVisible();
  cancelSave = true;
  await openExports(page);
  await button("Bearbeitbares Mystery sichern").click();
  await expect.poll(() => records.at(-1)?.canceled).toBe(true);
  await closeExports(page);
  await expect(page.locator(".studio-unsaved")).toBeVisible();
  cancelSave = false;
  await saveProject(page);
  await expect(page.locator(".studio-unsaved")).toHaveCount(0);
  await page.screenshot({ path: join(out, "Hauptleiste-und-Pinnwand.png") });
  await openExports(page);
  await page.screenshot({ path: join(out, "Speichern-und-Exportieren.png") });
  const before = exports.length;
  await button("Für itslearning exportieren").click();
  await expect.poll(() => exports.length).toBeGreaterThan(before);
  await playerWorkflow(
    browser,
    server.origin,
    out,
    join(out, exports.at(-1)),
    "UX-Schueler",
    4,
  );
  await openExports(page);
  await page.evaluate(() => window.__studioCommand("open"));
  const fileError = page.getByRole("dialog",{name:"Aktion nicht möglich",exact:true});
  await expect(fileError.getByRole("alert")).toContainText("konnte nicht geöffnet werden");
  await b(fileError,"Schließen").click();
  await closeExports(page);
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(4);
  await page.locator('.studio-board [data-card="1"]').click();
  await button("Groß ansehen").click();
  await expect(page.locator(".reading")).toContainText("1912");
  await button("Zur Bearbeitung").click();
  await button("Schließen").click();
  records.push({
    workflow: "A/F",
    fourCards: true,
    emptyDraftSaved: true,
    saveCancelPreservesDirty: true,
    playerPNGOnly: true,
  });
  for (const [n, path] of [
    [
      16,
      process.env.STUDIO_ORIGINAL16 ||
        "tests/fixtures/pdf-regions/Ohne-Rahmen-16.pdf",
    ],
    [
      20,
      process.env.STUDIO_ORIGINAL20 ||
        "tests/fixtures/pdf-regions/Rahmen-20.pdf",
    ],
  ]) {
    await start("Importprüfung " + n);
    await button("Importieren").click();
    await page
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles(resolve(path));
    await expect(
      page.getByRole("heading", { name: "Karten kontrollieren", exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".import-step-body")).not.toHaveAttribute(
      "disabled",
      "",
      { timeout: 60000 },
    );
    await expect(page.locator(".studio-import-summary")).toContainText(
      n + " Karten erkannt",
    );
    for (const name of [
      "Tabelle hinzufügen",
      "Karte am Textcursor teilen",
      "Importkarte hinzufügen",
      "Kartengrenzen und Text erkennen",
    ])
      await expect(button(name)).toBeHidden();
    for (const size of [
      { width: 1280, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 720, height: 600 },
    ]) {
      await page.setViewportSize(size);
      if (size.width >= 900) {
        const left = await page.locator(".import-original").boundingBox(),
          right = await page.locator(".import-cards").boundingBox();
        expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1);
        await expect(button("Karten ansehen")).toBeHidden();
      }
      await page.screenshot({
        path: join(out, `Import-${n}-${size.width}x${size.height}.png`),
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const headings = [];
    for (let i = 0; i < n; i++) {
      if (i) await button("Nächste Karte").click();
      headings.push(
        await page
          .getByRole("textbox", { name: "Überschrift", exact: true })
          .inputValue(),
      );
      await expect(page.locator(".import-cards h3")).toHaveText(
        `Karte ${i + 1} von ${n}`,
      );
    }
    if (n === 20)
      await expect(page.getByLabel("PDF-Seite", { exact: true })).toHaveValue(
        "2",
      );
    await page.getByLabel("PDF-Seite", { exact: true }).selectOption("1");
    await expect(page.locator(".import-step-body")).not.toHaveAttribute(
      "disabled",
      "",
      { timeout: 60000 },
    );
    await button("Bereich 1 auswählen").click();
    await expect(page.locator(".import-cards h3")).toHaveText(
      `Karte 1 von ${n}`,
    );
    const originalText = await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .inputValue();
    for (const category of [
      "Kartengrenzen",
      "Texterkennung",
      "Kartenstruktur",
      "Bilder, Diagramme und Tabellen",
    ]) {
      await correction(page, category);
      await expect(
        page.getByRole("navigation", { name: "Erkennung korrigieren" }),
      ).toBeVisible();
      await simpleImport(page);
      expect(
        await page
          .getByRole("textbox", { name: "Kartentext", exact: true })
          .inputValue(),
      ).toBe(originalText);
    }
    await correction(page,"Bilder, Diagramme und Tabellen");
    await button("Tabelle hinzufügen").click();
    await page.getByRole("textbox",{name:"Spalte 1",exact:true}).fill("Messgröße");
    await page.getByRole("textbox",{name:"Spalte 2",exact:true}).fill("Wert");
    await page.getByRole("textbox",{name:"Zeile 1, Spalte 2",exact:true}).fill("1,5 °C");
    await simpleImport(page);
    await expect(page.getByRole("textbox",{name:"Spalte 1",exact:true})).toBeHidden();
    await correction(page,"Bilder, Diagramme und Tabellen");
    await expect(page.getByRole("textbox",{name:"Zeile 1, Spalte 2",exact:true})).toHaveValue("1,5 °C");
    await button("Tabelle entfernen").click();
    await correction(page,"Kartenstruktur");
    await page.getByRole("textbox",{name:"Kartentext",exact:true}).evaluate(e=>e.setSelectionRange(20,20));
    await button("Karte am Textcursor teilen").click();
    await expect(page.locator(".studio-import-summary")).toContainText((n+1)+" Karten erkannt");
    await button("Mit nächster Karte zusammenfügen").click();
    await expect(page.locator(".studio-import-summary")).toContainText(n+" Karten erkannt");
    expect(await page.getByRole("textbox",{name:"Kartentext",exact:true}).inputValue()).toBe(originalText);
    await simpleImport(page);
    await button("Weiter zur Übernahme").click();
    for (const choice of await page.getByRole("radio").all()) {
      const geometry = await choice.evaluate((e) => ({
        width: e.getBoundingClientRect().width,
        labelWidth: e.parentElement.getBoundingClientRect().width,
      }));
      expect(geometry.width).toBeLessThan(24);
      expect(geometry.labelWidth).toBeGreaterThan(geometry.width);
    }
    await page.screenshot({ path: join(out, `Radioauswahl-${n}.png`) });
    await page.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
    await button("Karten übernehmen").click();
    await expect(page.locator(".studio-board [data-card]")).toHaveCount(n);
    await expect(
      page.getByRole("status").filter({ hasText: n + " Karten übernommen." }),
    ).toContainText("Exportieren");
    const board = await page.locator(".studio-board").boundingBox();
    expect(board.y + board.height).toBeLessThanOrEqual(
      page.viewportSize().height + 1,
    );
    for (const c of await page.locator(".studio-board [data-card]").all()) {
      const box = await c.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(board.x);
      expect(box.y).toBeGreaterThanOrEqual(board.y);
      expect(box.x + box.width).toBeLessThanOrEqual(board.x + board.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(
        board.y + board.height + 1,
      );
    }
    await page.screenshot({ path: join(out, `Pinnwand-${n}.png`) });
    await saveProject(page);
    await writeFile(
      join(out, `Import-${n}.mysteryboard`),
      await readFile(join(out, "UX-Projekt.mysteryboard")),
    );
    records.push({
      workflow: n === 16 ? "B" : "C",
      cards: n,
      headings,
      originalProvided:
        !!process.env[n === 16 ? "STUDIO_ORIGINAL16" : "STUDIO_ORIGINAL20"],
      allCardsVisible: true,
      toolsAndEditsRetained: true,
    });
  }
  expect(errors).toEqual([]);
  expect(
    requests.filter((u) => /^https?:/.test(u) && !u.startsWith(server.origin)),
  ).toEqual([]);
  await writeFile(
    join(out, "UX-Browser.json"),
    JSON.stringify(
      {
        passed: true,
        browser: browser.version(),
        nativeDesktop: false,
        originalsPublished: false,
        records,
        errors,
        externalRequests: [],
      },
      null,
      2,
    ),
  );
  console.log(
    "Built Studio UX: A/B/C/F, empty draft, save cancellation, four-action toolbar, original selection, tools, radios and restored PNG passed.",
  );
} catch (e) {
  if (page) {
    await page.screenshot({ path: join(out, "UX-Fehler.png") }).catch(() => {});
    await writeFile(
      join(out, "UX-Fehler.txt"),
      String(e) +
        "\n" +
        (await page
          .locator("body")
          .innerText()
          .catch(() => "")),
    );
  }
  throw e;
} finally {
  await browser.close();
  server.close();
}
