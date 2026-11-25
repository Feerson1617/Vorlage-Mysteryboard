import {compactBackup} from "./controls.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { _electron, chromium, webkit, expect } from "@playwright/test";
import { unzlibSync, unzipSync } from "fflate";
import { button, closeExports, openExports, saveProject } from "./controls.mjs";
import { cardPosition, releaseOnly } from "./student-release.mjs";
import {
  compareReadability,
  layoutObservation,
  detailedText,
  checkPreview,
  capturePrint,
} from "./student-readability-026.mjs";
import { host } from "./web-host.mjs";
import {
  actualPrint,
  comparePrints,
  verifyPrintStructure,
} from "./print-quality-027.mjs";

const out = resolve(process.argv[2] || "artifacts/student-text-025");
const native = Boolean(process.env.STUDIO_EXEC);
const webkitOnly = process.env.MB_ENGINE === "webkit";
const version = process.env.STUDIO_VERSION || "0.2.5";
const printQuality = ["0.2.7","0.2.8","0.2.9","0.3.0"].includes(version);
const compactCards = version === "0.2.6" || printQuality;
const sizes = compactCards ? [12, 20, 30, 60, 100] : [12, 20, 60, 100];
const permission =
  "Lernende dürfen Überschrift und Text dieser Karte bearbeiten.";
const editedTitle = "Eigene Erklärung: Wärme & CO₂";
const longText = Array.from(
  { length: 20 },
  (_, n) =>
    `Absatz ${n + 1}: Ändert sich 12,5 µg/m³? Diese Beobachtung gehört in unsere Erklärung.`,
).join("\n\n");
const neutralImage = resolve("tests/fixtures/document-import/bild-1.png");
const card = (page, id) => page.locator(`[data-card="${id}"]`);
const dialog = (page) => page.getByRole("dialog");
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(",")}}`
      : JSON.stringify(value);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const original = {
  title: "Messwerte",
  text: "Der Originaltext enthält 12,5 µg/m³.",
};
await mkdir(out, { recursive: true });
const server = await host(out);
const browser = webkitOnly
  ? await webkit.launch({
      executablePath: process.env.WEBKIT_PATH || undefined,
    })
  : await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
const evidence = {
  engine: browser.version(),
  native,
  platform: process.platform,
  cases: [],
};
let studio, teacher, openPath, savePath;

async function fileTarget(name) {
  savePath = join(out, name);
  if (studio)
    await studio.evaluate((_, path) => (globalThis.qaSave = path), savePath);
  return savePath;
}

async function open(path) {
  openPath = path;
  if (studio)
    await studio.evaluate((_, path) => (globalThis.qaOpen = path), openPath);
  await button(teacher, "Mystery öffnen").click();
}

async function back() {
  await closeExports(teacher);
  await button(teacher, "Zur Projektübersicht").click();
  await expect(button(teacher, "Mystery öffnen")).toBeVisible();
}

async function addCard(title, text, editable = false, image = false) {
  await button(teacher, "Karte hinzufügen").click();
  const edit = dialog(teacher);
  await expect(edit.getByLabel(permission)).not.toBeChecked();
  await edit.getByLabel("Kartenüberschrift").fill(title);
  await edit.getByLabel("Kartentext", { exact: true }).fill(text);
  if (editable) await edit.getByLabel(permission).check();
  if (image) {
    await edit
      .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
      .setInputFiles(neutralImage);
    await edit.getByText("Weitere Kartenangaben", { exact: true }).click();
    await edit
      .getByLabel("Quellenangabe (optional)")
      .fill("Unveränderliche Quelle");
  }
  await button(edit, "Karte übernehmen").click();
}

async function author() {
  if (native) {
    assert.equal(process.platform, "darwin");
    assert.equal(process.arch, "arm64");
    studio = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + join(out, "private-profile")],
      timeout: 60000,
    });
    teacher = await studio.firstWindow();
    evidence.app = await studio.evaluate(({ app, dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [globalThis.qaOpen],
      });
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: globalThis.qaSave,
      });
      return { version: app.getVersion(), packaged: app.isPackaged };
    });
    assert.deepEqual(evidence.app, { version, packaged: true });
  } else {
    teacher = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await teacher.exposeFunction("qaOpen", async () => ({
      name: basename(openPath),
      encoded: (await readFile(openPath)).toString("base64"),
    }));
    await teacher.exposeFunction("qaSave", (bytes) =>
      writeFile(savePath, Buffer.from(bytes)),
    );
    await teacher.addInitScript(() => {
      window.mysteryStudio = {
        openProject: async () => {
          const result = await window.qaOpen();
          return {
            name: result.name,
            bytes: Uint8Array.fromBase64(result.encoded),
          };
        },
        recentProjects: async () => [],
        saveProject: async (bytes) => {
          await window.qaSave([...bytes]);
          return { name: "Testprojekt.mysteryboard" };
        },
        saveExport: async (bytes) => window.qaSave([...bytes]),
        projectState: async () => {},
        detachProject: async () => {},
        onSaved: () => {},
      };
    });
    await teacher.goto(server.origin + "/studio/dist/studio/index.html");
  }
  teacher.on("dialog", (prompt) => prompt.accept().catch(() => {}));
  await button(teacher, "Neues Mystery erstellen").click();
  await teacher.getByLabel("Lehrkraftkürzel").fill("QA");
  await button(teacher, "Mystery erstellen").click();
  await teacher
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Erklärungen zur Messreihe");
  await addCard(original.title, original.text, true, true);
  await addCard("Beobachtung ergänzen", "", true);
  await addCard("Gesicherte Daten", "Originalmaterial");
  await addCard("Vergleich", "Weitere Daten");
  await addCard("Quellen", "Beleg");
  const marked = teacher.locator(
    '.studio-board [data-student-editable="true"]',
  );
  await expect(marked).toHaveCount(2);
  await button(teacher, "Mystery gestalten").click();
  await button(teacher, "Bearbeitungsfreigabe").click();
  await button(
    teacher,
    "Alle Karten für Lernende bearbeitbar machen (3 Änderungen)",
  ).click();
  await expect(
    button(
      teacher,
      "Alle Karten für Lernende bearbeitbar machen (0 Änderungen)",
    ),
  ).toBeDisabled();
  await button(teacher, "Zur Pinnwand").click();
  await expect(marked).toHaveCount(5);
  await button(teacher, "Mystery gestalten").click();
  await button(teacher, "Bearbeitungsfreigabe").click();
  await button(
    teacher,
    "Alle Karten für Lernende sperren (5 Änderungen)",
  ).click();
  await button(teacher, "Zur Pinnwand").click();
  await expect(marked).toHaveCount(0);
  for (const id of [1, 2]) {
    await card(teacher, id).press("Enter");
    await dialog(teacher).getByLabel(permission).check();
    await button(dialog(teacher), "Karte übernehmen").click();
    await expect(marked).toHaveCount(id);
  }
  await card(teacher, 1).press("Enter");
  await teacher.screenshot({ path: join(out, "Freigabe.png") });
  await button(dialog(teacher), "Karte übernehmen").click();
  await button(teacher, "Mystery gestalten").click();
  await button(teacher, "Startanordnung").click();
  await teacher.getByLabel("Spalten der Startansicht").selectOption("2");
  await button(teacher, "Zur Pinnwand").click();
  const path = await fileTarget("Textkarten.mysteryboard");
  await saveProject(teacher);
  const project = await read(path);
  await back();
  await open(path);
  await expect(marked).toHaveCount(2);
  return project;
}

async function exportScorm(count) {
  const path = await fileTarget(
    count === 5 ? "Textkarten-SCORM.zip" : `SCORM-${count}.zip`,
  );
  await openExports(teacher);
  await button(teacher, "Für itslearning exportieren").click();
  let entries;
  await expect
    .poll(
      async () => {
        try {
          entries = unzipSync(await readFile(path));
          return Boolean(entries["app.html"]);
        } catch {
          return false;
        }
      },
      { timeout: 20000 },
    )
    .toBe(true);
  assert.match(
    Buffer.from(entries["imsmanifest.xml"]).toString(),
    /<schemaversion>1\.2<\/schemaversion>/,
  );
  const html = Buffer.from(entries["app.html"]).toString();
  assert(
    !html.includes(
      "Lernende dürfen Überschrift und Text dieser Karte bearbeiten.",
    ),
  );
  const launch = JSON.parse(
    html.match(
      /<script id="mysteryboard-launch" type="application\/json">([^<]+)<\/script>/,
    )[1],
  );
  assert(Buffer.byteLength(html) < 10_000_000);
  const task = JSON.parse(Buffer.from(launch.task, "base64"));
  const folder = join(out, "launch-" + count);
  await mkdir(folder, { recursive: true });
  for (const [name, bytes] of Object.entries(entries))
    await writeFile(join(folder, name), bytes);
  return task;
}

async function learner(count, viewport, backup, resource = `launch-${count}`) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  const external = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      url.startsWith(server.origin + "/") ||
      url.startsWith("blob:" + server.origin + "/") ||
      url.startsWith("data:")
    )
      return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.goto(`${server.origin}/qa-evidence/${resource}/launch.html`);
  const ui = page.frameLocator("iframe");
  if (backup) {
    await button(ui, /^(Fortsetzen|Original-PNG öffnen)$/).click();
    await ui.getByLabel("Schüler-Sicherung").setInputFiles(backup);
  } else {
    await ui.getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/).fill("Team Text");
    await button(ui, "Beginnen").click();
  }
  await expect(ui.locator("[data-card]")).toHaveCount(count);
  return { page, ui, external };
}

async function changeText(ui, id, title, text, useTap = false) {
  await card(ui, id).press("Enter");
  const reading = dialog(ui);
  if (useTap) await button(reading, "Text bearbeiten").tap();
  else await button(reading, "Text bearbeiten").click();
  assert.equal(await reading.locator("input,textarea").count(), 2);
  await reading.getByLabel("Kartenüberschrift").fill(title);
  await reading.getByLabel("Kartentext", { exact: true }).fill(text);
  await button(reading, "Änderungen übernehmen").click();
  await expect(reading.locator(".reading h3")).toHaveText(title);
  if (compactCards)
    assert.equal(
      await reading.locator(".reading > p:not(.small)").first().textContent(),
      text,
    );
  return reading;
}

async function backupFile(page, ui, count) {
  const path = join(
    out,
    count === 5
      ? webkitOnly
        ? "WebKit-Schuelerarbeit.png"
        : "Team Text_Erklärungen zur Messreihe.png"
      : `Arbeitsstand-${count}.png`,
  );
  await compactBackup(ui);
  await expect(ui.getByAltText("Vorschau des Sicherungsbildes")).toBeVisible({
    timeout: 45000,
  });
  if (compactCards)
    await expect(
      dialog(ui).getByText(/Beim Öffnen der Original-PNG/),
    ).toBeVisible();
  const download = page.waitForEvent("download");
  await ui.getByRole("link", { name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/ }).click();
  const downloaded = await download;
  assert.match(downloaded.suggestedFilename(), /^Team[ _]Text_.+\.png$/);
  await downloaded.saveAs(path);
  return path;
}

async function contents(path) {
  const png = await readFile(path);
  assert(png.length < 30_000_000);
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "mySt") {
      const payload = png.subarray(offset + 8, offset + 8 + size);
      assert.equal(payload.toString("ascii", 0, 3), "MBX");
      const bytes = unzlibSync(payload.subarray(40));
      assert.equal(bytes.length, payload.readUInt32BE(4));
      assert.equal(sha(bytes), payload.subarray(8, 40).toString("hex"));
      return {
        document: JSON.parse(Buffer.from(bytes)),
        bytes: png.length,
        sha256: sha(png),
      };
    }
    offset += size + 12;
  }
  throw Error("PNG-Arbeitsstand fehlt.");
}

const snapshot = (ui) =>
  ui.locator("svg.board").evaluate((svg) => ({
    cards: [...svg.querySelectorAll("[data-card]")].map((node) => [
      node.dataset.card,
      node.dataset.x,
      node.dataset.y,
      node.querySelector("rect").getAttribute("fill"),
      node.textContent,
    ]),
    edges: [...svg.querySelectorAll("[data-edge-label]")].map(
      (node) => node.textContent,
    ),
  }));

async function classroom(task, viewport) {
  const { page, ui, external } = await learner(5, viewport);
  await card(ui, 3).press("Enter");
  await expect(button(dialog(ui), "Text bearbeiten")).toHaveCount(0);
  await button(dialog(ui), "Schließen").click();
  await card(ui, 2).press("Enter");
  await button(dialog(ui), "Text bearbeiten").tap();
  await expect(
    dialog(ui).getByLabel("Kartentext", { exact: true }),
  ).toHaveValue("");
  if (compactCards)
    await expect(card(ui, 2).locator("[data-card-text] tspan")).toHaveCount(0);
  await dialog(ui)
    .getByLabel("Kartentext", { exact: true })
    .fill("Verworfener Text");
  await button(dialog(ui), "Schließen").click();
  await expect(dialog(ui).getByRole("alert")).toContainText(
    "Eure Eingaben sind noch offen.",
  );
  await expect(
    dialog(ui).getByLabel("Kartentext", { exact: true }),
  ).toHaveValue("Verworfener Text");
  await button(dialog(ui), "Bearbeitung abbrechen").click();
  await expect(dialog(ui).locator(".reading")).not.toContainText(
    "Verworfener Text",
  );
  await button(dialog(ui), "Schließen").click();

  const firstLocation = await card(ui, 1).getAttribute("data-x");
  let reading = await changeText(ui, 1, editedTitle, longText, true);
  await expect(reading.locator(".reading")).toContainText(
    "Unveränderliche Quelle",
  );
  await expect(reading.locator(".reading img")).toBeVisible();
  await button(reading, "Ursprünglichen Text wiederherstellen").click();
  await expect(reading.locator(".reading h3")).toHaveText(original.title);
  await button(reading, "Schließen").click();
  reading = await changeText(ui, 1, editedTitle, longText);
  await page.screenshot({
    path: join(out, `Schuelerkarte-${viewport.width}.png`),
  });
  await button(reading, "Schließen").click();
  assert.equal(await card(ui, 1).getAttribute("data-x"), firstLocation);
  if (compactCards) await checkPreview(card(ui, 1), longText);
  else await expect(card(ui, 1)).toContainText("Absatz 20");
  await button(ui, "Rückgängig").click();
  await expect(card(ui, 1)).toContainText(original.title);
  await button(ui, "Wiederholen").click();
  if (compactCards) {
    await checkPreview(card(ui, 1), longText);
    await expect(button(ui, "Überlagerte Karten anzeigen")).toHaveCount(0);
    const [x1, y1] = await cardPosition(ui, 1);
    const [x3, y3] = await cardPosition(ui, 3);
    const zoom = Number(
      await ui.locator("svg.board").getAttribute("data-zoom"),
    );
    const overlap = await releaseOnly(ui, 3, {
      dx: (x1 + 10 - x3) * zoom,
      dy: (y1 + 35 - y3) * zoom,
      type: "touch",
    });
    assert.deepEqual(overlap.actual, overlap.target);
  } else await expect(card(ui, 1)).toContainText("Absatz 20");
  await button(ui, "Überlagerte Karten anzeigen").click();
  await expect(button(dialog(ui), "Karte 3")).toBeVisible();
  await button(dialog(ui), "Karte 1").click();
  await button(dialog(ui), "Diese Karte neben die anderen setzen").click();
  await button(dialog(ui), "Schließen").click();
  await expect(button(ui, "Überlagerte Karten anzeigen")).toHaveCount(0);
  evidence.overlapResolved = true;
  const movement = await releaseOnly(ui, 2, { type: "touch", dx: 24, dy: 18 });
  assert.deepEqual(movement.actual, movement.target);
  await button(ui, "Rückgängig").click();
  await button(ui, "Wiederholen").click();

  reading = await changeText(
    ui,
    2,
    "Eigene Beobachtung",
    "Erste Zeile\n\nZweite Zeile!",
  );
  await button(reading, "Gelb").click();
  await button(reading, "Schließen").click();
  for (const to of [3, 4]) {
    await card(ui, 2).press("Enter");
    await button(dialog(ui), "Mit einer Karte verbinden").click();
    await card(ui, to).press("Enter");
    await dialog(ui)
      .getByLabel(/Beschriftung/)
      .fill("Zusammenhang " + to);
    await button(dialog(ui), "Übernehmen").click();
  }
  await button(ui, "Rückgängig").click();
  await expect(ui.locator("[data-edge-label]")).toHaveCount(1);
  await button(ui, "Wiederholen").click();
  await expect(ui.locator("[data-edge-label]")).toHaveCount(2);
  await button(ui, "Menü").click();
  await button(ui, "Druckfassung / PDF").click();
  const print = ui.frameLocator('iframe[title="Druckvorschau"]');
  await expect(print.locator("body")).toContainText("Eigene Beobachtung", {
    timeout: 45000,
  });
  await expect(print.locator("body")).toContainText("Absatz 20");
  if (printQuality) {
    const cards = await print.locator("[data-overview-card-id]").all();
    assert.equal(cards.length, 5);
    for (const c of cards)
      assert((await c.locator("[data-overview-text-line]").count()) <= 6);
  }
  await button(dialog(ui), "Schließen").click();
  const before = await snapshot(ui);
  const path = await backupFile(page, ui, 5);
  const checked = await contents(path);
  assert.deepEqual(checked.document.content, task.content);
  assert.equal(checked.document.work.schema, 3);
  assert.equal(checked.document.work.team, "Team Text");
  assert.deepEqual(
    checked.document.work.textEdits.map((edit) => edit.id),
    [1, 2],
  );
  assert.equal(checked.document.work.textEdits[0].text, longText);
  assert.equal(checked.document.work.edges.length, 2);
  assert.deepEqual(external, []);
  const storage = await page.context().storageState({ indexedDB: true });
  assert.deepEqual(storage.cookies, []);
  assert.deepEqual(storage.origins, []);
  await page.context().close();

  const restored = await learner(5, viewport, path);
  assert.deepEqual(await snapshot(restored.ui), before);
  await card(restored.ui, 1).press("Enter");
  await button(dialog(restored.ui), "Text bearbeiten").click();
  await expect(
    dialog(restored.ui).getByLabel("Kartentext", { exact: true }),
  ).toHaveValue(longText);
  assert.deepEqual(restored.external, []);
  await restored.page.context().close();
  return {
    count: 5,
    viewport,
    bytes: checked.bytes,
    sha256: checked.sha256,
    edits: 2,
  };
}

async function large(project, count) {
  const comparison = compactCards && count === 30;
  const content = {
    ...project.content,
    id: `textkarten-${count}`,
    cards: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title:
        printQuality && comparison && i === 4
          ? "Pegelstand\nBoden und Wasser\nΔP → Fluss"
          : "Karte " + (i + 1),
      text: "Beobachtung",
      group: "required",
      ...(comparison && i < 2
        ? {
            image: project.content.cards[0].image,
            imageAlt: "Messdiagramm",
            imageCaption: "Messreihe und Legende",
            imagePosition: i === 0 ? "after-text" : "before-text",
            source: project.content.cards[0].source,
            ...(printQuality && i === 0
              ? {
                  extraImages: [
                    {
                      src: project.content.cards[0].image,
                      alt: "Weitere Messgrafik",
                      caption: "Weitere Messgrafik",
                      source: "Lokales Messprotokoll",
                    },
                  ],
                  table: {
                    caption: "Pegelstand nach Starkregen",
                    headers: ["Messgröße", "Einheit"],
                    rows: [
                      ["Pegelstand", "cm"],
                      ["Abfluss", "m³/s"],
                    ],
                  },
                }
              : {}),
          }
        : {}),
      ...(i % 5 === 4 ? {} : { studentEditable: true }),
    })),
    ...(comparison ? { startLayout: { mode: "explicit" } } : {}),
    initial: {
      cards: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        color: 0,
        x: comparison ? (i % 5) * 370 : (i % 10) * 340,
        y: comparison
          ? Math.floor(i / 5) * (printQuality ? 430 : 390)
          : Math.floor(i / 10) * 220,
      })),
      edges: [],
      categories: Array(6).fill(""),
    },
  };
  // Both releases must accept exactly the same 30-card comparison material.
  if(["0.2.8","0.2.9","0.3.0"].includes(version) && comparison)delete content.recovery;
  const path = join(out, `Projekt-${count}.mysteryboard`);
  await writeFile(
    path,
    JSON.stringify({
      ...project,
      content,
      contentHash: sha(canonical(content)),
      author: { ...project.author, board: undefined },
    }),
  );
  await back();
  await open(path);
  await expect(teacher.locator(".studio-board [data-card]")).toHaveCount(count);
  const task = await exportScorm(count);
  const session = await learner(count, { width: 1024, height: 768 });
  const { page, ui, external } = session;
  const beforeText = comparison ? await layoutObservation(ui) : null;
  if (comparison) {
    for (const to of [6, 11, 12]) {
      await card(ui, 1).press("Enter");
      await button(dialog(ui), "Mit einer Karte verbinden").click();
      await card(ui, to).press("Enter");
      await dialog(ui)
        .getByLabel(/Beschriftung/)
        .fill("Beziehung " + to);
      await button(dialog(ui), "Übernehmen").click();
    }
  }
  const beforeArrows = comparison ? await layoutObservation(ui) : null;
  const expectedEdits = [];
  for (const c of task.content.cards.filter((c) => c.studentEditable)) {
    const text = comparison
      ? detailedText(c.id)
      : `Teamtext für Karte ${c.id}. Äß Ω₂\n` +
        (count >= 60
          ? "Aussage mit Sonderzeichen. π µ − \n".repeat(20)
          : "Absatz 2.");
    const title =
      comparison && c.id === 6
        ? printQuality
          ? "W".repeat(96) + "ΔΩÄß"
          : "Beobachtungen zur Versickerung und zum Hochwasser nach dem Starkregen im dicht bebauten Viertel"
        : comparison && printQuality && c.id === 7
          ? "Åbfluss · ΔP → 12,5 µg/m³"
          : "Ergänzung " + c.id;
    expectedEdits.push({ id: c.id, title, text });
    await changeText(ui, c.id, title, text);
    await button(dialog(ui), "Schließen").click();
    if (comparison) {
      await checkPreview(card(ui, c.id), text);
      const headingLines = await card(ui, c.id)
        .locator(":scope > text:first-of-type > tspan")
        .allTextContents();
      if (printQuality && c.id === 6) {
        assert.equal(headingLines.length, 3);
        assert.match(headingLines.at(-1), /…$/);
        await expect(card(ui, c.id)).toHaveAttribute(
          "data-title-excerpt",
          "true",
        );
      } else assert.equal(headingLines.join(" "), title);
    }
  }
  const afterText = comparison ? await layoutObservation(ui) : null;
  if (comparison) {
    assert.deepEqual(afterText.positions, beforeText.positions);
    assert.equal(afterText.connectors.length, 3);
    assert.notDeepEqual(afterText.connectors, beforeArrows.connectors);
    const bottom = afterText.cards[0].y + afterText.cards[0].height;
    const top = afterText.cards[5].y;
    const gap = top - bottom > 14 ? 7 : 0.5;
    assert.equal(afterText.connectors[0].startY, bottom + gap);
    assert.equal(afterText.connectors[0].endY, top - gap);
    assert(afterText.connectors[0].endY > afterText.connectors[0].startY);
    await expect(button(ui, "Überlagerte Karten anzeigen")).toHaveCount(0);
    if (printQuality) {
      await expect(card(ui, 1).locator("[data-card-media]")).toHaveText(
        "Tabelle · Bild · Weitere Bilder",
      );
      await expect(card(ui, 1)).toHaveAccessibleDescription(
        /Tabelle\. Bild\. Weitere Bilder/,
      );
      await card(ui, 5).press("Enter");
      assert.equal(
        await dialog(ui).locator(".reading h3").textContent(),
        content.cards[4].title,
      );
      await button(dialog(ui), "Schließen").click();
    }
  }
  const before = await snapshot(ui);
  const png = await backupFile(page, ui, count);
  const checked = await contents(png);
  assert.deepEqual(checked.document.content, task.content);
  assert.equal(
    checked.document.work.textEdits.length,
    count - Math.floor(count / 5),
  );
  if (compactCards)
    assert.deepEqual(checked.document.work.textEdits, expectedEdits);
  assert.deepEqual(external, []);
  await page.context().close();
  const restored = await learner(count, { width: 768, height: 1024 }, png);
  assert.deepEqual(await snapshot(restored.ui), before);
  assert.deepEqual(restored.external, []);
  if (printQuality && comparison) {
    evidence.printComparison = await comparePrints(
      out,
      learner,
      browser,
      restored.ui,
      png,
      checked.document,
    );
  } else if (printQuality) {
    verifyPrintStructure(
      await actualPrint(null, restored.ui, "a4"),
      checked.document,
    );
  }
  if (comparison && !printQuality) {
    await capturePrint(
      browser,
      restored.ui,
      join(out, "Vollstaendige-Kartentexte-A4.pdf"),
      expectedEdits,
    );
    evidence.comparison = await compareReadability(
      out,
      learner,
      png,
      viewportFor(chromium),
      "Chromium",
    );
  }
  await restored.page.context().close();
  return {
    count,
    bytes: checked.bytes,
    sha256: checked.sha256,
    edits: checked.document.work.textEdits.length,
  };
}

const viewportFor = (engine) =>
  engine === chromium
    ? { width: 1024, height: 768 }
    : { width: 768, height: 1024 };

try {
  if (webkitOnly) {
    const central = await read(join(out, "Chromium.json"));
    const file = await contents(
      join(out, "Team Text_Erklärungen zur Messreihe.png"),
    );
    assert.equal(central.cases[0].sha256, file.sha256);
    evidence.cases.push(
      await classroom(
        { content: file.document.content },
        { width: 1024, height: 768 },
      ),
    );
    if (compactCards) {
      for (const count of sizes) {
        const path = join(out, `Arbeitsstand-${count}.png`);
        const result = await contents(path);
        const restored = await learner(count, viewportFor(webkit), path);
        const { page, ui, external } = restored;
        await expect(ui.locator("[data-card]")).toHaveCount(count);
        for (const edit of result.document.work.textEdits.slice(
          0,
          count === 30 ? 3 : 1,
        )) {
          await card(ui, edit.id).press("Enter");
          await expect(dialog(ui).locator(".reading h3")).toHaveText(
            edit.title,
          );
          assert.equal(
            await dialog(ui)
              .locator(".reading > p:not(.small)")
              .first()
              .textContent(),
            edit.text,
          );
          await button(dialog(ui), "Schließen").click();
          if (count === 30) await checkPreview(card(ui, edit.id), edit.text);
        }
        if (printQuality) {
          verifyPrintStructure(
            await actualPrint(null, ui, "a4"),
            result.document,
          );
          if (count === 30)
            verifyPrintStructure(
              await actualPrint(null, ui, "a3"),
              result.document,
            );
        }
        assert.deepEqual(external, []);
        await page.context().close();
        evidence.cases.push({
          count,
          edits: result.document.work.textEdits.length,
          bytes: result.bytes,
          sha256: result.sha256,
        });
      }
      if (!printQuality)
        evidence.comparison = await compareReadability(
          out,
          learner,
          join(out, "Arbeitsstand-30.png"),
          viewportFor(webkit),
          "WebKit",
        );
    }
  } else {
    const project = await author();
    const task = await exportScorm(5);
    assert.deepEqual(task.content.cards, project.content.cards);
    evidence.cases.push(await classroom(task, { width: 768, height: 1024 }));
    for (const count of sizes) evidence.cases.push(await large(project, count));
  }
  await writeFile(
    join(out, webkitOnly ? "WebKit.json" : "Chromium.json"),
    JSON.stringify({ ...evidence, passed: true }, null, 2) + "\n",
  );
} finally {
  await studio?.close();
  await browser.close();
  server.close();
}
