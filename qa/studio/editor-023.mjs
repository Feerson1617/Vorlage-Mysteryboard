import { inspectOriginal } from "./import-024/inspect-original.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { _electron, chromium, expect } from "@playwright/test";
import { unzlibSync, unzipSync } from "fflate";
import { button, closeExports, openExports, saveProject } from "./controls.mjs";
import { fixtures } from "./fixtures.mjs";
import { coordinates, displacedRelease } from "./board-gestures.mjs";
import { host } from "./web-host.mjs";
import { releaseOnly } from "./student-release.mjs";

const out = resolve(process.env.EDITOR_EVIDENCE || "artifacts/studio-023");
const native = Boolean(process.env.STUDIO_EXEC);
const baseline = process.env.EDITOR_BASELINE === "1";
const originals = process.env.EDITOR_ORIGINAL;
const legacy = process.env.EDITOR_LEGACY_DIR;
const fixturesRoot = resolve("qa/studio/evidence/pdf-artwork-023");
const source =
  originals ||
  process.env.EDITOR_NEUTRAL ||
  join(fixturesRoot, "Mehrseitige-Karten.pdf");
const baseCount = originals ? 32 : 7;
const m2Index = originals ? 18 : 6;
const stage = baseline ? "Vorher" : "Nachher";
await mkdir(out, { recursive: true });
const docs = await fixtures(join(out, "projects"), [5, 12, 20, 31, 60]);
const server = await host(out);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const proof = {
  stage,
  native,
  platform: process.platform,
  arch: process.arch,
  cases: [],
};
let app, page, openingPath, savingPath, lastPreview;
let cancelDeletion = true;
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const title = "Quellen und Diagramme";
const publishChoice =
  "Ich habe die vorgegebenen Verbindungen geprüft und möchte sie an die Lernenden weitergeben.";
const teacherBoard = () => page.locator(".studio-board svg.board");
const card = (ui, id) => ui.locator(`[data-card="${id}"]`);
const dialog = () => page.getByRole("dialog");
const taskFromPng = (png) => {
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "mySt") {
      const payload = png.subarray(offset + 8, offset + 8 + size);
      const bytes = unzlibSync(payload.subarray(40));
      assert.equal(bytes.length, payload.readUInt32BE(4));
      assert(
        createHash("sha256")
          .update(bytes)
          .digest()
          .equals(payload.subarray(8, 40)),
      );
      return JSON.parse(Buffer.from(bytes).toString());
    }
    offset += size + 12;
  }
  throw Error("The exported PNG has no embedded task.");
};
const frame = (ui) =>
  ui.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const snapshot = (ui) =>
  ui.locator("svg.board").evaluate((svg) => ({
    cards: Object.fromEntries(
      [...svg.querySelectorAll("[data-card]")].map((item) => [
        item.dataset.card,
        {
          x: Number(item.dataset.x),
          y: Number(item.dataset.y),
          color: item.querySelector(":scope > rect").getAttribute("fill"),
        },
      ]),
    ),
    edges: [...svg.querySelectorAll("[data-edge-label]")].map(
      (edge) => edge.textContent,
    ),
  }));

async function configure() {
  if (native) {
    assert.equal(process.platform, "darwin");
    assert.equal(process.arch, "arm64");
    app = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + join(out, `profile-${stage}`)],
      timeout: 60000,
    });
    page = await app.firstWindow();
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [globalThis.qaOpen],
      });
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: globalThis.qaSave,
      });
      globalThis.qaCancelDeletion = true;
      globalThis.qaConfirmations = [];
      const decision = (...args) => {
        const message = args.at(-1)?.message ?? "";
        const response =
          (globalThis.qaCancelDeletion &&
            message.includes("wirklich löschen")) ||
          message === "Ungesicherte Änderungen"
            ? 1
            : 0;
        globalThis.qaConfirmations.push({ message, response });
        return { response, checkboxChecked: false };
      };
      dialog.showMessageBox = async (...args) => decision(...args);
      dialog.showMessageBoxSync = (...args) => decision(...args).response;
    });
    proof.app = await app.evaluate(({ app }) => ({
      version: app.getVersion(),
      packaged: app.isPackaged,
    }));
    assert.deepEqual(proof.app, {
      version: process.env.EDITOR_VERSION || (baseline ? "0.2.2" : "0.2.3"),
      packaged: true,
    });
  } else {
    page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.exposeFunction("qaOpen", async () => ({
      name: basename(openingPath),
      encoded: (await readFile(openingPath)).toString("base64"),
    }));
    await page.exposeFunction("qaSave", async (bytes) =>
      writeFile(savingPath, Buffer.from(bytes)),
    );
    await page.exposeFunction("qaPreview", (bytes) => {
      lastPreview = JSON.parse(Buffer.from(bytes).toString());
    });
    await page.addInitScript(() => {
      window.mysteryStudio = {
        openProject: async () => {
          const d = await window.qaOpen();
          return { name: d.name, bytes: Uint8Array.fromBase64(d.encoded) };
        },
        openRecent: async () => null,
        recentProjects: async () => [],
        saveProject: async (bytes) => {
          await window.qaSave([...bytes]);
          return { name: "Testprojekt.mysteryboard" };
        },
        saveExport: async (bytes) => window.qaSave([...bytes]),
        previewTask: async (bytes) => window.qaPreview([...bytes]),
        projectState: async () => {},
        detachProject: async () => {},
        onSaved: () => () => {},
      };
    });
    await page.goto(server.origin + "/studio/dist/studio/index.html");
  }
  page.setDefaultTimeout(20000);
  page.on("dialog", async (d) => {
    try {
      if (cancelDeletion && d.message().includes("wirklich löschen"))
        await d.dismiss();
      else await d.accept();
    } catch (error) {
      // Electron can close its native modal before Chromium handles the reply.
      // The following UI assertions still have to observe the requested outcome.
      if (!native || !String(error).includes("No dialog is showing"))
        throw error;
      console.log("Renderer confirmation already closed:", d.message());
    }
  });
}

async function setSize(width, height) {
  if (app)
    await app.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0].setContentSize(...size),
      [width, height],
    );
  else await page.setViewportSize({ width, height });
  await frame(page);
}
async function open(file) {
  openingPath = file;
  if (app) await app.evaluate((_, path) => (globalThis.qaOpen = path), file);
  await button(page, "Mystery öffnen").click();
}
async function target(file) {
  savingPath = join(out, file);
  if (app)
    await app.evaluate((_, path) => (globalThis.qaSave = path), savingPath);
  return savingPath;
}
async function back() {
  await closeExports(page);
  await button(page, "Zur Projektübersicht").click();
  await expect(button(page, "Mystery öffnen")).toBeVisible();
}
async function previousProject() {
  const path = join(legacy, "Autor-mit-Pfeilen.mysteryboard");
  const before = await readFile(path);
  await open(path);
  await expect(teacherBoard().locator("[data-card]")).toHaveCount(5);
  const exported = await exportScorm("Altstand-022-SCORM.zip", true);
  assert.deepEqual(exported.decoded.content, JSON.parse(before).content);
  assert((await readFile(path)).equals(before));
  const sco = join(out, "legacy-022");
  await mkdir(sco, { recursive: true });
  for (const [name, bytes] of Object.entries(exported.entries))
    await writeFile(join(sco, name), bytes);
  const restored = await browser.newPage();
  try {
    await restored.goto(server.origin + "/qa-evidence/legacy-022/launch.html");
    const ui = restored.frameLocator("iframe");
    await button(ui, "Fortsetzen").click();
    await ui
      .getByLabel("Schüler-Sicherung")
      .setInputFiles(join(legacy, "Schuelerarbeit-Original.png"));
    await expect(ui.locator("[data-card]")).toHaveCount(5);
    await expect(ui.locator("[data-edge-label]")).toHaveText(
      "Unser erklärter Zusammenhang",
    );
  } finally {
    await restored.close();
  }
  await back();
  proof.legacy022ProjectAndPng = true;
}
async function loadPdf(file) {
  await button(page, "Neues Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel").fill("QA");
  await button(page, "Mystery erstellen").click();
  await page.getByLabel("Mystery-Datei", { exact: true }).setInputFiles(file);
  await expect(button(page, "Weiter zur Übernahme")).toBeVisible({
    timeout: 60000,
  });
}
async function selectProposal(index, pageNumber) {
  if (
    (await page.getByLabel("PDF-Seite", { exact: true }).inputValue()) !==
    String(pageNumber)
  )
    await page
      .getByLabel("PDF-Seite", { exact: true })
      .selectOption(String(pageNumber));
  await button(page, `Bereich ${index} auswählen`).click();
}
async function exportScorm(label, confirm = false) {
  const path = await target(label);
  await openExports(page);
  if (confirm) {
    await expect(button(page, "Für itslearning exportieren")).toBeDisabled();
    await page.getByLabel(publishChoice).check();
  }
  await button(page, "Für itslearning exportieren").click();
  let entries;
  await expect
    .poll(
      async () => {
        try {
          entries = unzipSync(new Uint8Array(await readFile(path)));
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
  const launch =
    /<script id="mysteryboard-launch" type="application\/json">([^<]+)<\/script>/.exec(
      html,
    )[1];
  const decoded = JSON.parse(
    Buffer.from(JSON.parse(launch).task, "base64").toString(),
  );
  return { decoded, entries };
}
async function teach(id) {
  await card(page, id).press("Enter");
  await expect(dialog()).toBeVisible();
}
async function saveCard() {
  await button(dialog(), "Karte übernehmen").click();
  await expect(dialog()).toHaveCount(0);
}
async function connect(from, to, label, share) {
  await card(page, from).press("Enter");
  await card(page, to).press("Enter");
  await dialog().getByLabel("Beschriftung (freiwillig)").fill(label);
  if (share) await dialog().getByRole("checkbox").check();
  await button(dialog(), "Übernehmen").click();
}

try {
  await configure();
  for (const { n, path } of docs) {
    await open(path);
    await expect(teacherBoard().locator("[data-card]")).toHaveCount(n);
    for (const [w, h] of [
      [1280, 820],
      [1000, 720],
      [800, 620],
    ]) {
      await setSize(w, h);
      await button(page, "Alle Karten anzeigen").click();
      await frame(page);
      const box = await teacherBoard().boundingBox();
      const visible = await teacherBoard()
        .locator("[data-card] > rect")
        .evaluateAll((rects) => {
          const board = rects[0].closest("svg").getBoundingClientRect();
          return rects.filter((rect) => {
            const b = rect.getBoundingClientRect();
            return (
              b.x >= board.x - 1 &&
              b.right <= board.right + 1 &&
              b.y >= board.y - 1 &&
              b.bottom <= board.bottom + 1
            );
          }).length;
        });
      if (!baseline) assert.equal(visible, n, `${n} cards in ${w}x${h}`);
      proof.cases.push({ n, w, h, boardHeight: box.height, visible });
      if (w === 1280 || n === 31)
        await page.screenshot({
          path: join(out, `${stage}-${n}-${w}x${h}.png`),
        });
    }
    if (!baseline && n === 31) {
      const before = await snapshot(page),
        zoom = Number(await teacherBoard().getAttribute("data-zoom"));
      await button(page, "Pinnwand vergrößern").click();
      await expect
        .poll(async () =>
          Number(await teacherBoard().getAttribute("data-zoom")),
        )
        .toBeGreaterThan(zoom);
      const normal = await teacherBoard().boundingBox();
      await button(page, "Pinnwand maximieren").click();
      await expect(button(page, "Fokusmodus beenden")).toBeVisible();
      const maximized = await teacherBoard().boundingBox();
      assert(maximized.height > normal.height + 30);
      assert.deepEqual(await snapshot(page), before);
      await page.screenshot({ path: join(out, "Fokus-31.png") });
      await page.keyboard.press("Escape");
      await expect(button(page, "Pinnwand maximieren")).toBeVisible();
    }
    await back();
  }
  if (baseline) {
    proof.passed = true;
  } else {
    await setSize(1280, 820);
    if (legacy) await previousProject();
    if (!originals) {
      for (const [name, count, images] of [
        ["Bildkarten.pdf", 2, 2],
        ["Gemischte-Karten.pdf", 4, 1],
      ]) {
        await loadPdf(join(fixturesRoot, name));
        await expect(page.locator("[data-pdf-region]")).toHaveCount(count);
        assert.equal(
          (await page.getByText(/Bildkarte von Seite 1/).count()) > 0,
          images > 0,
        );
        await button(page, "Weiter zur Übernahme").click();
        await page.getByLabel(/Ich habe Texte, Grenzen, Bilder/).check();
        await button(page, "Karten übernehmen").click();
        await expect(teacherBoard().locator("[data-card]")).toHaveCount(count);
        await target(name.replace(".pdf", ".mysteryboard"));
        await saveProject(page);
        await back();
      }
    }
    if (originals)
      assert.equal(
        createHash("sha256")
          .update(await readFile(source))
          .digest("hex"),
        "07efd68057712f082819456c099a971f335c035f70b70076cda79c35bf914693",
      );
    await loadPdf(source);
    if (originals && process.env.EDITOR_IMPORT_AUDIT)
      await inspectOriginal(page, out);
    if (process.env.EDITOR_IMPORT_AUDIT) {
      await page.locator(".import-audit summary").click();
      await page.screenshot({
        path: join(out, "Vollstaendigkeitskontrolle.png"),
      });
      await page.locator(".import-audit summary").click();
    }
    if (!originals)
      await expect(
        page.getByText("Grafiken ohne sichere Kartenzuordnung prüfen", {
          exact: true,
        }),
      ).toBeVisible();
    let correctedImage;
    if (process.env.EDITOR_NEUTRAL) {
      await selectProposal(3, 2);
      await page
        .getByText("Grafiken ohne sichere Kartenzuordnung prüfen", {
          exact: true,
        })
        .click();
      await button(page, "Grafik 1 auf Seite 2 markieren").click();
      await button(page, "Ausschnitt der aktuellen Karte zuordnen").click();
      const corrected = page.locator(".import-cards img").first();
      await expect(corrected).toBeVisible();
      correctedImage = await corrected.getAttribute("src");
      await expect(
        page.getByText("Grafiken ohne sichere Kartenzuordnung prüfen", {
          exact: true,
        }),
      ).toHaveCount(0);
      await page.screenshot({
        path: join(out, "Korrigierte-Bildzuordnung.png"),
      });
      await button(page, "Zur einfachen Ansicht").click();
    }
    await selectProposal(m2Index, 2);
    const graphic = page.locator(".import-cards img").first();
    await expect(graphic).toBeVisible();
    const artwork = await graphic.getAttribute("src");
    assert.match(artwork, /^data:image\//);
    const mime = /^data:image\/(\w+);base64,/.exec(artwork)[1];
    await writeFile(
      join(out, `Uebernommene-Bildkarte.${mime}`),
      Buffer.from(artwork.split(",")[1], "base64"),
    );
    const rendered = await graphic.evaluate((img) => [
      img.naturalWidth,
      img.naturalHeight,
    ]);
    assert(rendered[0] > 800 && rendered[1] > 1200);
    assert(Math.abs(rendered[0] / rendered[1] - 0.7) < 0.04);
    await expect(page.getByLabel("Kartentext", { exact: true })).toHaveValue(
      "",
    );
    await page.screenshot({ path: join(out, "PDF-Bildkarte.png") });
    await selectProposal(baseCount, 3);
    await button(page, "Als Aufgabenstellung übernehmen").click();
    await button(page, "Weiter zur Übernahme").click();
    await page.getByLabel("Mystery-Titel").last().fill(title);
    const instructions = await page
      .getByLabel("Aufgabenstellung", { exact: true })
      .inputValue();
    assert.match(instructions, /Ziel/);
    await page.getByLabel(/Ich habe Texte, Grenzen, Bilder/).check();
    await button(page, "Karten übernehmen").click();
    await expect(teacherBoard().locator("[data-card]")).toHaveCount(
      baseCount - 1,
    );
    await button(page, "Importmeldung schließen").click();
    await teach(1);
    await dialog().getByLabel("Eigene Farbe").fill("#153754");
    await dialog()
      .getByRole("textbox", { name: /^Kartentext/ })
      .fill("Aktualisierter Faktencheck.");
    await expect(dialog().locator(".studio-card-color-preview")).toHaveCSS(
      "background-color",
      "rgb(21, 55, 84)",
    );
    await expect(dialog().locator(".studio-card-color-preview")).toHaveCSS(
      "color",
      "rgb(255, 255, 255)",
    );
    await saveCard();
    await teach(3);
    await button(dialog(), "Grün").click();
    await saveCard();
    const colored = (await exportScorm("Nur-Farben.zip")).decoded;
    assert.equal(colored.content.cards[0].backgroundColor, "#153754");
    assert.equal(colored.content.cards[2].backgroundColor, "#e0ebe4");
    assert(colored.content.initial.cards.every((item) => item.color === 0));
    await teach(3);
    await button(dialog(), "Standardfarbe").click();
    await saveCard();
    await teach(2);
    const removed = colored.content.cards[1];
    await button(dialog(), "Karte löschen").click();
    await expect(dialog()).toBeVisible();
    await expect(teacherBoard().locator("[data-card]")).toHaveCount(
      baseCount - 1,
    );
    cancelDeletion = false;
    if (app)
      await app.evaluate(() => {
        globalThis.qaCancelDeletion = false;
      });
    await button(dialog(), "Karte löschen").click();
    await expect(dialog()).toHaveCount(0);
    await expect(teacherBoard().locator("[data-card]")).toHaveCount(
      baseCount - 2,
    );
    if (app) {
      const confirmations = await app.evaluate(
        () => globalThis.qaConfirmations,
      );
      assert.deepEqual(
        confirmations
          .filter(({ message }) => message.includes("wirklich löschen"))
          .map(({ response }) => response),
        [1, 0],
      );
      assert(
        !confirmations.some(({ message }) =>
          message.startsWith("Karten dieser Scan-Seite neu aufteilen?"),
        ),
      );
    }
    const reduced = (await exportScorm("Nach-Loeschung.zip")).decoded;
    assert.equal(reduced.content.cards.length, baseCount - 2);
    assert(!reduced.content.cards.some((c) => c.text === removed.text));
    assert.equal(reduced.content.cards[1].backgroundColor, undefined);
    await teach(2);
    await button(dialog(), "Blau").click();
    await saveCard();
    assert.deepEqual(
      (await displacedRelease(page, 1)).actual,
      await coordinates(teacherBoard(), 1),
    );
    const positions = (await snapshot(page)).cards;
    await button(page, "Verbindungen bearbeiten").click();
    await connect(1, 2, "Freigegebene Starthilfe", true);
    await connect(2, 3, "Interne Lehrkraftverbindung", false);
    await button(page, "Verbindungsmodus beenden").click();
    await button(page, "Mystery gestalten").click();
    await button(page, "Startanordnung").click();
    await page
      .getByLabel("Meine aktuelle Kartenanordnung als Startansicht übernehmen")
      .check();
    await button(page, "Mystery gestalten").click();
    const projectPath = await target("Gestaltetes-Projekt.mysteryboard");
    await saveProject(page);
    const project = await read(projectPath);
    assert.equal(project.content.startLayout.mode, "explicit");
    assert.equal(project.content.instructions, instructions);
    for (const state of project.content.initial.cards)
      assert.deepEqual(
        [state.x, state.y],
        [positions[state.id].x, positions[state.id].y],
      );
    assert.equal(project.author.edges.length, 1);
    assert.equal(project.content.initial.edges.length, 1);
    await back();
    await open(projectPath);
    await expect(teacherBoard().locator("[data-card]")).toHaveCount(
      baseCount - 2,
    );
    await openExports(page);
    const previewOpened = app?.waitForEvent("window");
    await button(page, "Schüleransicht prüfen").click();
    let previewSnapshot;
    if (previewOpened) {
      const preview = await previewOpened;
      await preview.getByLabel("Teamname oder Vornamen").fill("Vorschau");
      await button(preview, "Beginnen").click();
      await expect(preview.locator("[data-card]")).toHaveCount(baseCount - 2);
      previewSnapshot = await snapshot(preview);
      await preview.screenshot({ path: join(out, "Schueler-Vorschau.png") });
      await preview.close();
    }
    const exported = await exportScorm("Gestaltete-Aufgabe-SCORM.zip", true);
    const repeated = await exportScorm("Wiederholter-Export.zip", true);
    assert.deepEqual(exported.decoded, repeated.decoded);
    const task = exported.decoded.content;
    if (!native) assert.deepEqual(lastPreview, exported.decoded);
    assert.deepEqual(task, project.content);
    assert.equal(task.cards[0].text, "Aktualisierter Faktencheck.");
    assert.equal(task.cards[m2Index - 2].image, artwork);
    if (correctedImage) {
      assert.equal(task.cards[1].image, correctedImage);
      proof.manualImageRetained = true;
    }
    assert.equal(task.cards[m2Index - 2].text, "");
    assert(!JSON.stringify(task).includes("Interne Lehrkraftverbindung"));
    const pngPath = await target("Gestaltete-Aufgabe.png");
    await openExports(page);
    await expect(button(page, "Als Bild exportieren")).toBeDisabled();
    await page.getByLabel(publishChoice).check();
    await button(page, "Als Bild exportieren").click();
    await expect
      .poll(
        async () => {
          const data = await readFile(pngPath).catch(() => null);
          return data?.toString("ascii", data.length - 8, data.length - 4);
        },
        {
          timeout: 30000,
        },
      )
      .toBe("IEND");
    assert.deepEqual(taskFromPng(await readFile(pngPath)), exported.decoded);
    const sco = join(out, "launch");
    await mkdir(sco, { recursive: true });
    for (const [name, bytes] of Object.entries(exported.entries))
      await writeFile(join(sco, name), bytes);
    const learner = await browser.newPage({
      viewport: { width: 1120, height: 820 },
      hasTouch: true,
    });
    const external = [];
    await learner.route("**/*", (route) => {
      const url = route.request().url();
      if (/^https?:/.test(url) && !url.startsWith(server.origin + "/")) {
        external.push(url);
        return route.abort();
      }
      return route.continue();
    });
    await learner.goto(server.origin + "/qa-evidence/launch/launch.html");
    const ui = learner.frameLocator("iframe");
    await ui.getByLabel("Teamname oder Vornamen").fill("Team QA");
    await button(ui, "Beginnen").click();
    await expect(ui.locator("[data-card]")).toHaveCount(baseCount - 2);
    const state = await snapshot(ui);
    if (previewSnapshot) assert.deepEqual(state, previewSnapshot);
    for (const saved of task.initial.cards)
      assert.deepEqual(
        [state.cards[saved.id].x, state.cards[saved.id].y],
        [saved.x, saved.y],
      );
    assert.deepEqual(state.edges, ["Freigegebene Starthilfe"]);
    assert.equal(state.cards[1].color, "#153754");
    assert.equal(state.cards[2].color, "#e0e9f1");
    await learner.screenshot({ path: join(out, "SCORM-Schueleransicht.png") });
    await button(ui, "Aufgabe").click();
    await expect(ui.getByRole("dialog")).toContainText("Ziel");
    await button(ui.getByRole("dialog"), "Schließen").click();
    await card(ui, m2Index - 1).press("Enter");
    const pupilGraphic = ui.getByRole("dialog").locator("img");
    await expect(pupilGraphic).toBeVisible();
    await expect(pupilGraphic).toHaveAttribute("src", artwork);
    const pupilImagePixels = await pupilGraphic.evaluate(async (img) => {
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
    assert.deepEqual(pupilImagePixels, rendered);
    await learner.screenshot({ path: join(out, "SCORM-Bildkarte.png") });
    await button(ui.getByRole("dialog"), "Schließen").click();
    await card(ui, 1).press("Enter");
    await expect(ui.getByRole("dialog")).toContainText(
      "Aktualisierter Faktencheck.",
    );
    await button(ui.getByRole("dialog"), "Gelb").click();
    await expect(card(ui, 1).locator(":scope > rect")).toHaveAttribute(
      "fill",
      "#f3e8ce",
    );
    await button(ui.getByRole("dialog"), "Ohne Farbe").click();
    await expect(card(ui, 1).locator(":scope > rect")).toHaveAttribute(
      "fill",
      "#153754",
    );
    await button(ui.getByRole("dialog"), "Schließen").click();
    const move = await releaseOnly(ui, 1, { dx: 29, dy: 15, type: "touch" });
    assert.deepEqual(move.actual, move.target);
    await button(ui, "Rückgängig").click();
    assert.deepEqual(await snapshot(ui), state);
    assert.deepEqual(external, []);
    if (process.env.EDITOR_IMPORT_AUDIT) {
      const moved = await releaseOnly(ui, 1, { dx: 21, dy: 17, type: "touch" });
      assert.deepEqual(moved.actual, moved.target);
      const work = await snapshot(ui);
      await button(ui, "Menü").click();
      await button(ui, "Kleineres Sicherungsbild").click();
      const pending = learner.waitForEvent("download");
      await ui
        .getByRole("link", { name: "Sicherungsbild herunterladen" })
        .click();
      const file = await pending;
      assert.match(file.suggestedFilename(), /^Team[ _]QA_.+\.png$/);
      const png = join(out, "Schuelerarbeit.png");
      await file.saveAs(png);
      await learner.close();
      const fresh = await browser.newPage();
      await fresh.goto(server.origin + "/qa-evidence/launch/launch.html");
      const restored = fresh.frameLocator("iframe");
      await button(restored, "Fortsetzen").click();
      await restored.getByLabel("Schüler-Sicherung").setInputFiles(png);
      await expect(restored.locator("[data-card]")).toHaveCount(
        task.cards.length,
      );
      assert.deepEqual(await snapshot(restored), work);
      await card(restored, m2Index - 1).press("Enter");
      await expect(restored.getByRole("dialog").locator("img")).toHaveAttribute(
        "src",
        artwork,
      );
      await fresh.close();
      proof.studentPngRestored = true;
    } else await learner.close();
    Object.assign(proof, {
      source: basename(source),
      sha256: createHash("sha256")
        .update(await readFile(source))
        .digest("hex"),
      proposals: baseCount,
      published: task.cards.length,
      rendered,
      pupilImagePixels,
      actualPositions: state.cards,
      external,
      taskPngMatchesScorm: true,
      passed: true,
    });
  }
  await writeFile(
    join(out, `Editor-${stage}.json`),
    JSON.stringify(proof, null, 2) + "\n",
  );
} catch (error) {
  await page?.screenshot({ path: join(out, "Fehler.png") }).catch(() => {});
  throw error;
} finally {
  await app?.close();
  await browser.close();
  server.close();
}
