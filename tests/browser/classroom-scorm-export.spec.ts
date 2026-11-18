import {
  test,
  expect,
  type Page,
  type Browser,
  type TestInfo,
} from "@playwright/test";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { relative, join } from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
import { parseDocument } from "htmlparser2";
import source from "../../examples/universal/content.json" with { type: "json" };
import {
  encodeDocument,
  taskDocument,
  validateContent,
  type Task,
  type Student,
} from "../../src/core/documents";
import { retainCards, draftFromContent } from "../../src/core/authoring";
import { button, openUniversal, getFile, type UI } from "./authoring-helpers";
import { gestures, connect, project, png } from "./help-runtime-helpers";

test.use({ hasTouch: true });
const views = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
];
function task(index: number) {
  const content = retainCards(
    validateContent(source),
    Array.from({ length: index === 1 ? 12 : 5 }, (_, i) => i + 1),
  );
  content.id = `classroom-export-${index}`;
  content.title =
    index === 1
      ? "Zwölf Beobachtungen – SCORM-Test"
      : "Fünf andere Spuren – SCORM-Test";
  content.cards = content.cards.map((c) => ({
    ...c,
    title: `Mystery ${index} Information ${c.id}`,
    text: `Eigenständiges Mystery ${index}, Information ${c.id}. ${c.text}`,
  }));
  return taskDocument(content);
}
async function editor(page: Page) {
  await openUniversal(page);
  await button(page, "Lehrkräfteeditor").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("SC");
  await button(page, "Lehrkräftemodus öffnen").tap();
}
async function drop(page: Page, files: { name: string; bytes: Buffer }[]) {
  const transfer = await page.evaluateHandle(
    (items) => {
      const data = new DataTransfer();
      for (const item of items)
        data.items.add(
          new File(
            [Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0))],
            item.name,
          ),
        );
      return data;
    },
    files.map((f) => ({ name: f.name, data: f.bytes.toString("base64") })),
  );
  await page
    .locator("main.author-editor")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
}
async function downloadScorm(page: Page, info: TestInfo, name: string) {
  await button(page, "Schülerversion erstellen").tap();
  const dialog = page.getByRole("dialog", {
    name: "Mystery bereitstellen",
    exact: true,
  });
  await expect(dialog).toContainText("manuell");
  await button(dialog, "Für itslearning als SCORM herunterladen").tap();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Datei herunterladen", exact: true })
    .click();
  const download = await pending,
    path = info.outputPath(name);
  expect(download.suggestedFilename()).toMatch(
    /MysteryBoard-.+-v\d+\.\d+\.\d+-SCORM-1\.2\.zip$/,
  );
  await download.saveAs(path);
  const bytes = await readFile(path),
    entries = unzipSync(bytes);
  expect(Object.keys(entries).sort()).toEqual([
    "app.html",
    "imsmanifest.xml",
    "launch.html",
    "session.js",
  ]);
  expect(entries["app.html"].length).toBeLessThan(10_000_000);
  for (const n of ["launch.html", "session.js"])
    expect(Buffer.from(entries[n])).toEqual(await readFile("scorm/" + n));
  // Independent ZIP CRC verification, not only the same JS ZIP library.
  execFileSync("python3", [
    "-c",
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None",
    path,
  ]);
  execFileSync("python3", [
    "-c",
    'import zipfile,sys,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); r=E.fromstring(z.read("imsmanifest.xml")); ns={"i":"http://www.imsproject.org/xsd/imscp_rootv1p1p2"}; assert r.find("i:metadata/i:schemaversion",ns).text=="1.2"; assert r.find("i:resources/i:resource",ns).attrib["href"]=="launch.html"; assert {f.attrib["href"] for f in r.findall("i:resources/i:resource/i:file",ns)}=={"launch.html","session.js","app.html"}',
    path,
  ]);
  const html = Buffer.from(entries["app.html"]).toString();
  const scripts: string[] = [];
  const visit = (node: any) => {
    if (node.name === "script" && node.attribs?.type === "module")
      scripts.push(node.children.map((c: any) => c.data ?? "").join(""));
    for (const child of node.children ?? []) visit(child);
  };
  visit(parseDocument(html));
  expect(scripts).toEqual([
    await page.locator('script[type="module"]').textContent(),
  ]);
  expect(html).toContain("Third-party notices");
  expect(html).toContain("mammoth");
  expect(html).toContain("pdfjs-dist");
  const match =
    /<script id="mysteryboard-launch" type="application\/json">([^<]+)<\/script>/.exec(
      html,
    )!;
  const launch = JSON.parse(match[1]);
  expect(launch.classroom).toBe(true);
  const embedded = JSON.parse(
    Buffer.from(launch.task, "base64").toString(),
  ) as Task;
  expect(embedded.kind).toBe("task");
  expect(embedded).not.toHaveProperty("author");
  expect(embedded).not.toHaveProperty("work");
  expect(embedded.content.initial.edges).toEqual([]);
  await info.attach(name, { path, contentType: "application/zip" });
  if (process.env.CLASSROOM_EXPORT_DIR) {
    await mkdir(process.env.CLASSROOM_EXPORT_DIR, { recursive: true });
    await copyFile(path, join(process.env.CLASSROOM_EXPORT_DIR, name));
  }
  await button(page, "Schließen").tap();
  return { bytes, entries, embedded, html };
}
async function launch(
  browser: Browser,
  info: TestInfo,
  bytes: Buffer,
  title: string,
  viewport: { width: number; height: number },
  suffix: string,
) {
  const folder = info.outputPath("fresh-" + suffix);
  await mkdir(folder, { recursive: true });
  for (const [name, data] of Object.entries(unzipSync(bytes)))
    await writeFile(join(folder, name), data);
  const context = await browser.newContext({ hasTouch: true, viewport }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const external: string[] = [],
    errors: string[] = [];
  context.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    (window as any).__calls = [];
    (window as any).API = Object.fromEntries(
      [
        "LMSInitialize",
        "LMSFinish",
        "LMSGetValue",
        "LMSSetValue",
        "LMSCommit",
      ].map((n) => [
        n,
        (...args: string[]) => {
          (window as any).__calls.push([n, ...args]);
          return "true";
        },
      ]),
    );
  });
  await page.goto(
    "http://localhost:5174/" +
      relative(process.cwd(), join(folder, "launch.html")),
  );
  const ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
  await expect(
    ui.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    ui.getByLabel("Teamname oder Vornamen", { exact: true }),
  ).toBeVisible();
  await expect(button(ui, "Aufgabe öffnen")).toHaveCount(0);
  await expect(button(ui, "Lehrkräfteeditor")).toHaveCount(0);
  await expect(button(ui, "Lehrkräftemodus – Mystery bearbeiten")).toHaveCount(
    0,
  );
  await context.setOffline(true);
  return {
    context,
    page,
    ui,
    async finish() {
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
      expect(
        await ui.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ local: 0, session: 0 });
      expect(await page.evaluate(() => (window as any).__calls)).toEqual([
        ["LMSInitialize", ""],
      ]);
      await page.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: false }),
        ),
      );
      expect(await page.evaluate(() => (window as any).__calls)).toEqual([
        ["LMSInitialize", ""],
        ["LMSFinish", ""],
      ]);
      await context.close();
    },
  };
}

for (const viewport of views)
  test(`Browser-SCORM ${viewport.width}x${viewport.height}: zwei Drops, bearbeitete Aufgaben, kalter Start, PNG und Fortsetzen`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ viewport, hasTouch: true }),
      page = await context.newPage();
    await editor(page);
    const packages: Awaited<ReturnType<typeof downloadScorm>>[] = [];
    for (const index of [1, 2]) {
      const original = task(index);
      await writeFile(
        info.outputPath(`original-${index}.mysteryboard`),
        encodeDocument(original),
      );
      if (index === 2)
        page.once("dialog", async (d) => {
          expect(d.message()).toContain("Entwurf ersetzen");
          await d.accept();
        });
      await drop(page, [
        {
          name: `aufgabe-${index}.mysteryboard`,
          bytes: Buffer.from(encodeDocument(original)),
        },
      ]);
      await expect(
        page.getByLabel("Mystery-Titel", { exact: true }),
      ).toHaveValue(original.content.title);
      await expect(
        page.getByLabel("Teamname oder Vornamen", { exact: true }),
      ).toHaveCount(0);
      await button(page, "Entwurf sichern").tap();
      const unmodified = await getFile(
        page,
        info,
        `unveraendert-${viewport.width}-${index}.mysteryboard`,
      );
      expect(unmodified.document.content).toEqual(original.content);
      expect(unmodified.document.contentHash).toEqual(original.contentHash);
      await button(page, "Schließen").tap();
      await button(page, "Karte 1 bearbeiten").tap();
      const text = `Geprüfte Bearbeitung ${index}: </ScRiPt><img src="https://example.invalid/leak" onerror="window.executed=true">`;
      await page
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill(text);
      await button(page, "Karte übernehmen").tap();
      await button(page, "Hilfen bearbeiten").tap();
      await page
        .getByRole("textbox", { name: "Hilfetext", exact: true })
        .fill(`Eigener Denkimpuls für Mystery ${index}.`);
      await button(page, "Hilfe übernehmen").tap();
      const pack = await downloadScorm(
        page,
        info,
        `Unterricht-${index}-${viewport.width}-SCORM-1.2.zip`,
      );
      expect(pack.embedded.content.cards[0].text).toBe(text);
      expect(pack.embedded.content.help?.method).toBe(
        `Eigener Denkimpuls für Mystery ${index}.`,
      );
      expect(pack.embedded.content.id).toBe(original.content.id);
      expect(pack.html).not.toContain(text);
      if (index === 2) {
        expect(pack.html).not.toContain(
          Buffer.from(encodeDocument(packages[0].embedded)).toString("base64"),
        );
        expect(pack.embedded.content.cards).toHaveLength(5);
        expect(
          pack.embedded.content.cards.every((c) =>
            c.title.startsWith("Mystery 2"),
          ),
        ).toBe(true);
      }
      packages.push(pack);
      const learner = await launch(
        browser,
        info,
        pack.bytes,
        original.content.title,
        viewport,
        `learner-${index}`,
      );
      await learner.page.screenshot({
        path: info.outputPath(`autostart-${index}-${viewport.width}.png`),
      });
      await learner.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill(`Team ${index}`);
      await button(learner.ui, "Beginnen").tap();
      await expect(learner.ui.locator(".card")).toHaveCount(
        original.content.cards.length,
      );
      await learner.ui.locator('[data-number="1"]').tap();
      await expect(learner.ui.locator(".reading > p").first()).toHaveText(text);
      await expect(learner.ui.locator(".media-view > img")).toHaveAttribute(
        "src",
        original.content.cards[0].image!,
      );
      await button(learner.ui, "Schließen").tap();
      await button(learner.ui, "Menü").tap();
      await button(learner.ui, "Hilfe").tap();
      await expect(
        learner.ui.getByRole("dialog", { name: "Hilfe", exact: true }),
      ).toContainText(`Eigener Denkimpuls für Mystery ${index}.`);
      await button(learner.ui, "Hilfe schließen").tap();
      await gestures(learner.ui);
      await connect(learner.ui, 1, 2, `Begründung ${index}`);
      await expect(learner.ui.locator("[data-edge-label]")).toHaveCount(1);
      await button(learner.ui, "Rückgängig").tap();
      await expect(learner.ui.locator("[data-edge-label]")).toHaveCount(0);
      await button(learner.ui, "Wiederholen").tap();
      await expect(learner.ui.locator("[data-edge-label]")).toHaveCount(1);
      const before = await project(
        learner.ui,
        info,
        `vollstand-${index}-${viewport.width}`,
      );
      const saved = await png(
        learner.ui,
        info,
        `original-png-${index}-${viewport.width}`,
      );
      expect(saved.document).toEqual(before.document);
      const fresh = await launch(
        browser,
        info,
        pack.bytes,
        original.content.title,
        viewport,
        `restore-${index}`,
      );
      await button(fresh.ui, "Fortsetzen").tap();
      await fresh.ui
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles({
          name: "Original.png",
          mimeType: "image/png",
          buffer: saved.bytes,
        });
      const restored = await project(
        fresh.ui,
        info,
        `restored-${index}-${viewport.width}`,
      );
      expect(restored.document).toEqual(before.document);
      await connect(
        fresh.ui,
        2,
        3,
        "Nach echter Wiederherstellung weitergearbeitet",
      );
      const continued = await project(
        fresh.ui,
        info,
        `continued-${index}-${viewport.width}`,
      );
      expect((continued.document as Student).work.edges).toHaveLength(2);
      expect(
        await fresh.ui.evaluate(() => (window as any).executed),
      ).toBeUndefined();
      await fresh.finish();
      await learner.finish();
    }
    await page.screenshot({
      path: info.outputPath(`editor-${viewport.width}.png`),
      fullPage: true,
    });
    await context.close();
  });

test("Editor-Dateiimport: defekt, zu groß, Bilddecoder, Mehrfachdrop, Abbruch und bestätigter Entwurfswechsel", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await editor(page);
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Ungesicherter Entwurf");
  const original = task(2),
    good = Buffer.from(encodeDocument(original));
  for (const file of [
    { name: "defekt.mysteryboard", bytes: Buffer.from("{kaputt") },
    { name: "zu-gross.mysteryboard", bytes: Buffer.alloc(30_000_001) },
  ]) {
    await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
      name: file.name,
      mimeType: "application/json",
      buffer: file.bytes,
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Ungesicherter Entwurf",
    );
  }
  await drop(page, [
    { name: "eins.mysteryboard", bytes: good },
    { name: "zwei.mysteryboard", bytes: good },
  ]);
  await expect(page.getByRole("alert")).toContainText("genau eine");
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((r) => setTimeout(r, 500));
      return original.call(this);
    };
  });
  await drop(page, [{ name: "gueltig.mysteryboard", bytes: good }]);
  await button(page, "Import abbrechen").tap();
  await page.waitForTimeout(700);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Ungesicherter Entwurf",
  );
  page.once("dialog", async (d) => {
    expect(d.message()).toContain("Entwurf ersetzen");
    await d.dismiss();
  });
  await drop(page, [{ name: "gueltig.mysteryboard", bytes: good }]);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Ungesicherter Entwurf",
  );
  // Valid image header but corrupt compressed image data must fail real decoding.
  const raw = structuredClone(original.content);
  raw.cards[0].image = "data:image/jpeg;base64,/9j/wAALCAABAAEBAREA/9k=";
  const badImage = taskDocument(raw);
  await drop(page, [
    {
      name: "defektes-bild.mysteryboard",
      bytes: Buffer.from(encodeDocument(badImage)),
    },
  ]);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    "Ungesicherter Entwurf",
  );
  const draft = draftFromContent(original.content, "ORIGINAL");
  draft.author.initials = "PRIVATE-NOTE-EXAMPLE";
  draft.author.hiddenCards = [5];
  page.once("dialog", async (d) => d.accept());
  await drop(page, [
    { name: "entwurf.mysteryboard", bytes: Buffer.from(encodeDocument(draft)) },
  ]);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    original.content.title,
  );
  await button(page, "Entwurf sichern").tap();
  const saved = await getFile(
    page,
    info,
    "unveraenderter-lehrkraftentwurf.mysteryboard",
  );
  expect(saved.document).toEqual(draft);
  await button(page, "Schließen").tap();
  const pack = await downloadScorm(page, info, "nur-freigegebene-karten.zip");
  expect(pack.embedded.content.cards).toHaveLength(4);
  expect(JSON.stringify(pack.embedded)).not.toContain("PRIVATE-NOTE-EXAMPLE");
  expect(pack.html).not.toContain(
    Buffer.from(encodeDocument(draft)).toString("base64"),
  );
});

for (const extension of ["docx", "pdf"])
  test(`Einheitlicher ${extension}-Import öffnet denselben Assistenten; Abbruch erhält den Entwurf`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await editor(page);
    await page
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Bleibt erhalten");
    const path =
      extension === "docx"
        ? "tests/fixtures/document-import/A-Word-12-Karten.docx"
        : "tests/fixtures/document-import/C-PDF-12-Karten.pdf";
    if (extension === "docx")
      await drop(page, [
        { name: "Material.docx", bytes: await readFile(path) },
      ]);
    else
      await page
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles(path);
    await expect(
      page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    page.once("dialog", async (d) => d.accept());
    await button(page, "Zurück zum Entwurf").tap();
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Bleibt erhalten",
    );
    await expect(page.locator(".author-card-list > li")).toHaveCount(0);
  });

test("Zu große vollständige Unterrichts-HTML wird verständlich abgelehnt; Entwurf und Dateiexport bleiben erhalten", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await editor(page);
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 500;
    const ctx = canvas.getContext("2d")!,
      pixels = ctx.createImageData(500, 500);
    let seed = 17;
    for (let i = 0; i < pixels.data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = seed >>> 24;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  });
  const content = task(2).content;
  content.title = "Große geprüfte Bilder";
  content.cards = content.cards.map((c) => ({ ...c, image }));
  const large = taskDocument(content);
  await drop(page, [
    { name: "gross.mysteryboard", bytes: Buffer.from(encodeDocument(large)) },
  ]);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    content.title,
  );
  await button(page, "Schülerversion erstellen").tap();
  const dialog = page.getByRole("dialog", {
    name: "Mystery bereitstellen",
    exact: true,
  });
  const unexpected: string[] = [];
  page.on("download", (d) => unexpected.push(d.suggestedFilename()));
  await button(dialog, "Für itslearning als SCORM herunterladen").tap();
  await expect(dialog.getByRole("alert")).toContainText("10 MB", {
    timeout: 30000,
  });
  expect(unexpected).toEqual([]);
  await expect(button(dialog, "Schülerversion als Datei")).toBeEnabled();
  const saved = await getFile(
    page,
    info,
    "gross-trotzdem-als-aufgabe.mysteryboard",
  );
  expect(saved.document).toEqual(large);
});

test("Erneuter Export aus einem aufgabenspezifischen CLI-Build übernimmt ausschließlich die neue Aufgabe", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  await page.goto(
    "http://localhost:5174/artifacts/tests/MysteryBoard-Editierbares-Beispiel.html",
  );
  await page.context().setOffline(true);
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("NEU");
  await button(page, "Lehrkräftemodus öffnen").tap();
  const other = task(2);
  await drop(page, [
    {
      name: "andere-aufgabe.mysteryboard",
      bytes: Buffer.from(encodeDocument(other)),
    },
  ]);
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    other.content.title,
  );
  const exported = await downloadScorm(
    page,
    info,
    "erneuter-export-aus-aufgabenbuild.zip",
  );
  expect(exported.embedded).toEqual(other);
  const previous = await readFile(
    "examples/universal/ki-beispiel.mysteryboard",
  );
  expect(exported.html).not.toContain(previous.toString("base64"));
  const fresh = await launch(
    browser,
    info,
    exported.bytes,
    other.content.title,
    { width: 1024, height: 768 },
    "cli-reexport",
  );
  await fresh.finish();
});
