import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { host } from "./web-host.mjs";
import { fixtures } from "./fixtures.mjs";
import { playerWorkflow } from "./player-workflow.mjs";
const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-evidence",
);
await mkdir(out, { recursive: true });
const sources = await fixtures(out),
  server = await host(out),
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
const times = [],
  exports = [];
let selected = sources[0].path,
  pdfName = "Studio-5-Karten.pdf";
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("dialog", (d) => d.accept());
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", (r) => {
    const u = r.request().url();
    requests.push(u);
    return /^https?:/.test(u) && !u.startsWith(server.origin)
      ? r.abort()
      : r.continue();
  });
  await page.exposeFunction("qaOpen", async () => ({
    bytes: [...(await readFile(selected))],
    name: selected.split("/").at(-1),
  }));
  await page.exposeFunction("qaSave", async (bytes, name) => {
    await writeFile(join(out, name), Buffer.from(bytes));
    exports.push(name);
    return { name };
  });
  await page.exposeFunction("qaPdf", async (html) => {
    await writeFile(join(out, pdfName + ".html"), html);
    const p = await context.newPage();
    await p.setContent(html);
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({
      path: join(out, pdfName),
      printBackground: true,
      preferCSSPageSize: true,
    });
    await p.close();
    return true;
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      openProject: async () => {
        const d = await window.qaOpen();
        return { ...d, bytes: new Uint8Array(d.bytes) };
      },
      openRecent: async () => null,
      recentProjects: async () => [],
      saveProject: async (bytes) =>
        window.qaSave([...bytes], "Usability-Projekt.mysteryboard"),
      projectState: async () => {},
      detachProject: async () => {},
      saveExport: async (bytes, name) =>
        !!(await window.qaSave([...bytes], name)),
      printPDF: (html) => window.qaPdf(html),
      onSaved: () => () => {},
    };
  });
  const start = () =>
    page.goto(server.origin + "/studio/dist/studio/index.html");
  const button = (name) => page.getByRole("button", { name, exact: true });
  const open = async (path) => {
    selected = path;
    if (await page.locator(".studio-project-menu summary").count())
      await page.locator(".studio-project-menu summary").click();
    await button("Mystery öffnen").click();
    await expect(page.locator(".studio-board")).toBeVisible();
  };
  const scorm = async () => {
    const before = exports.length;
    await button("Exportieren").click();
    await button("Als SCORM für itslearning exportieren").click();
    await expect.poll(() => exports.length).toBeGreaterThan(before);
    return join(out, exports.at(-1));
  };
  // A: four cards, title and export, without ever opening design.
  await start();
  let t = Date.now();
  await button("Neues Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("ST");
  await button("Mystery erstellen").click();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Vier einfache Beobachtungen");
  for (let i = 1; i <= 4; i++) {
    await button("Karte hinzufügen").click();
    await page
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill("Beobachtung " + i);
    await page
      .getByLabel("Kartentext", { exact: true })
      .fill(
        "1912, 1,5 °C und 2,1 mg/l bleiben als eingegebene Fakten erhalten.",
      );
    await button("Karte übernehmen").click();
  }
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(4);
  const simple = await scorm();
  times.push({
    workflow: "A: four cards without design",
    milliseconds: Date.now() - t,
    scorm: simple,
  });
  await button("Projekt sichern").click();
  await page.screenshot({ path: join(out, "Studio-Workflow-A.png") });
  // PDF: all requested card counts, all actual pages in preview and export.
  for (const source of sources) {
    await open(source.path);
    pdfName = `Studio-${source.n}-Karten.pdf`;
    await button("Exportieren").click();
    await button("Als Druck-PDF exportieren").click();
    await expect(button("PDF speichern")).toBeEnabled({ timeout: 60000 });
    const count = await page
      .getByRole("dialog", { name: "Als Druck-PDF exportieren", exact: true })
      .getByRole("status")
      .first()
      .innerText();
    await button("PDF speichern").click();
    await expect
      .poll(async () => {
        try {
          return (await readFile(join(out, pdfName))).length;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(1000);
    await page
      .getByRole("dialog", { name: "Als Druck-PDF exportieren", exact: true })
      .getByRole("button", { name: "Schließen", exact: true })
      .click();
    if (source.n === 5 || source.n === 16) {
      const zip = await scorm();
      await playerWorkflow(
        browser,
        server.origin,
        out,
        zip,
        "Studio-" + source.n,
        source.n,
      );
    }
    console.log("PDF and Player", source.n, count);
  }
  // C: a single document, real changes, return and save/reopen.
  await open(sources[0].path);
  t = Date.now();
  const before = await page
    .locator('.studio-board [data-card="1"]')
    .getAttribute("data-x");
  await button("Mystery gestalten").click();
  await expect(
    page.getByRole("region", { name: "Mystery gestalten", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Schrift", { exact: true }).selectOption("serif");
  await page.getByLabel("Kartenfarbe", { exact: true }).evaluate((e, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(e, v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, "#fff1cf");
  await button("Verbindungen").click();
  await page.getByLabel("Linienfarbe", { exact: true }).evaluate((e, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(e, v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, "#173d85");
  await page.getByLabel("Linienstärke", { exact: true }).press("Home");
  await page.getByLabel("Linienstärke", { exact: true }).press("ArrowRight");
  await page.getByLabel("Linienstärke", { exact: true }).press("ArrowRight");
  await page.getByLabel("Linienstärke", { exact: true }).press("ArrowRight");
  await page.getByLabel("Gestrichelte Verbindung", { exact: true }).check();
  await button("Zur Pinnwand").click();
  await expect(
    page.locator('.studio-board [data-card="1"] rect').first(),
  ).toHaveAttribute("fill", "#fff1cf");
  expect(
    await page.locator('.studio-board [data-card="1"]').getAttribute("data-x"),
  ).toBe(before);
  await button("Projekt sichern").click();
  await expect
    .poll(() => exports.includes("Usability-Projekt.mysteryboard"))
    .toBeTruthy();
  const styled = JSON.parse(
    await readFile(join(out, "Usability-Projekt.mysteryboard"), "utf8"),
  );
  expect(styled.content.design.font).toBe("serif");
  expect(styled.content.design.edgeColor).toBe("#173d85");
  await open(join(out, "Usability-Projekt.mysteryboard"));
  await expect(
    page.locator('.studio-board [data-card="1"] rect').first(),
  ).toHaveAttribute("fill", "#fff1cf");
  await scorm();
  times.push({
    workflow: "C: design, return, save, reopen, export",
    milliseconds: Date.now() - t,
  });
  await page.screenshot({ path: join(out, "Studio-Workflow-C.png") });
  // B: actual local OCR under the production CSP (no eval permission).
  await button("Material importieren").click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles(resolve("tests/fixtures/ocr/Scan-B-16.pdf"));
  await expect(
    page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 60000 },
  );
  await button("Original ansehen").click();
  t = Date.now();
  await button("Kartengrenzen und Text erkennen").click();
  await expect(page.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 240000 },
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await button("Karten ansehen").click();
  await expect(
    page.getByLabel("Importkarte auswählen", { exact: true }).locator("option"),
  ).toHaveCount(16);
  times.push({
    workflow: "B: scanned PDF, production CSP, 16 cards recognized",
    milliseconds: Date.now() - t,
  });
  await page.screenshot({ path: join(out, "Studio-Workflow-B-OCR.png") });
  await writeFile(
    join(out, "Usability.json"),
    JSON.stringify(
      {
        times,
        errors,
        externalRequests: requests.filter(
          (u) => /^https?:/.test(u) && !u.startsWith(server.origin),
        ),
        nativeDesktop: false,
        automatedWorkflowSimulation: true,
        realTeacherUsabilityStudy: false,
        colorPickerTest:
          "control input/change events; native OS color dialog not tested",
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log("Usability workflows and complete Player restores passed.");
} finally {
  await browser.close();
  server.close();
}
