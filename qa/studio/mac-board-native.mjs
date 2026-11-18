import assert from "node:assert/strict";
import { _electron, expect } from "@playwright/test";
import { cp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { button, closeExports, openExports, saveProject } from "./controls.mjs";
import { canonical, fixtures } from "./fixtures.mjs";
import { createHash } from "node:crypto";
import {
  coordinates,
  displacedRelease,
  moveWithMouse,
  pinboard,
} from "./board-gestures.mjs";
import { unzipSync } from "fflate";

assert.equal(process.platform, "darwin");
assert.equal(process.arch, "arm64");
const executablePath = resolve(process.env.STUDIO_EXEC);
const out = resolve(process.env.BOARD_EVIDENCE || "artifacts/mac-board-tests");
const profile = join(out, "profile");
await mkdir(out, { recursive: true });
const sources = (await fixtures(out)).filter((source) => source.n !== 16);
const twelve = join(out, "Studio-12.mysteryboard");
await cp("examples/universal/unterricht-entwurf.mysteryboard", twelve);
sources.splice(1, 0, { n: 12, path: twelve });
const proof = {
  passed: false,
  sourceCommit: process.env.GITHUB_SHA,
  platform: process.platform,
  arch: process.arch,
  projects: [],
  input:
    "Playwright mouse and wheel events, plus injected pointer event sequences",
};
let app,
  page,
  screenshot = null;
const width = 1280,
  height = 820;
const buttonOnPage = (name) => button(page, name);
async function launch() {
  app = await _electron.launch({
    executablePath,
    args: ["--user-data-dir=" + profile],
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on("filechooser", () => {});
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await app.evaluate(({ BrowserWindow, dialog }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(1280, 820);
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [globalThis.qaOpen],
    });
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: globalThis.qaSave,
    });
    dialog.showMessageBox = async () => ({ response: 1 });
    dialog.showMessageBoxSync = () => 0;
  });
  proof.electron = await app.evaluate(({ app, BrowserWindow }) => ({
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    arch: process.arch,
    platform: process.platform,
    executable: process.execPath,
    bundle: app.getAppPath(),
    sandbox:
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
        .sandbox,
  }));
  assert.equal(proof.electron.version, "0.2.2");
  assert(proof.electron.isPackaged && proof.electron.sandbox);
}
async function close() {
  if (app) {
    await app.close();
    app = null;
  }
}
async function open(path, n) {
  await app.evaluate((_, path) => (globalThis.qaOpen = path), path);
  await buttonOnPage("Mystery öffnen").click();
  await expect(pinboard(page).locator("[data-card]")).toHaveCount(n);
  await buttonOnPage("Alle Karten anzeigen").click();
}
async function fileTarget(path) {
  await app.evaluate((_, path) => (globalThis.qaSave = path), path);
}
async function overview() {
  await buttonOnPage("Alle Karten anzeigen").click();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
}
async function currentCoordinates() {
  return pinboard(page)
    .locator("[data-card]")
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [
          node.dataset.card,
          [Number(node.dataset.x), Number(node.dataset.y)],
        ]),
      ),
    );
}
async function chooseCard(id) {
  // The keyboard path and the mouse path use the same Board selection callback.
  await pinboard(page).locator(`[data-card="${id}"]`).press("Enter");
}
async function makeConnection(from, to, label, shared) {
  await chooseCard(from);
  await expect(
    page.getByRole("status").filter({ hasText: "Jetzt die zweite Karte" }),
  ).toBeVisible();
  await chooseCard(to);
  const dialog = page.getByRole("dialog", {
    name: "Verbindung bearbeiten",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const checked = dialog.getByRole("checkbox");
  await expect(checked).not.toBeChecked();
  await dialog.getByLabel("Beschriftung (freiwillig)").fill(label);
  if (shared) await checked.check();
  await button(dialog, "Übernehmen").click();
  await expect(dialog).toHaveCount(0);
}
try {
  await launch();
  for (const { n, path } of sources) {
    await open(path, n);
    const original = JSON.parse(await readFile(path, "utf8"));
    const project = { cards: n, motions: [] };
    if (n === 5) {
      project.motions.push({
        kind: "release-only",
        ...(await displacedRelease(page, 1)),
      });
      project.motions.push({
        kind: "slow",
        ...(await moveWithMouse(page, 2, { dx: 51, dy: 32, steps: 20 })),
      });
      project.motions.push({
        kind: "fast",
        ...(await moveWithMouse(page, 3, { dx: 85, dy: 32, steps: 1 })),
      });
      await overview();
      project.motions.push({
        kind: "long",
        ...(await moveWithMouse(page, 2, { dx: 320, dy: 110, steps: 8 })),
      });
      await overview();
      const card = await pinboard(page)
        .locator('[data-card="1"] rect')
        .first()
        .boundingBox();
      const board = await pinboard(page).boundingBox();
      const dx = Math.ceil(board.x - (card.x + card.width / 2)) - 3;
      project.motions.push({
        kind: "near edge and release outside board",
        ...(await moveWithMouse(page, 1, {
          dx,
          dy: 0,
          steps: 8,
          offBoard: true,
        })),
      });
      await overview();
      const wheel = await pinboard(page)
        .locator('[data-card="2"] rect')
        .first()
        .boundingBox();
      await page.mouse.move(
        wheel.x + wheel.width / 2,
        wheel.y + wheel.height / 2,
      );
      const oldZoom = await pinboard(page).getAttribute("data-zoom");
      const beforeWheel = await currentCoordinates();
      await page.mouse.wheel(0, -200);
      await expect
        .poll(() => pinboard(page).getAttribute("data-zoom"))
        .not.toBe(oldZoom);
      assert.deepEqual(await currentCoordinates(), beforeWheel);
      project.motions.push({
        kind: "after zoom",
        ...(await moveWithMouse(page, 2, { dx: 26, dy: 21, steps: 3 })),
      });
      await overview();
      const beforeResize = await currentCoordinates();
      project.motions.push({
        kind: "native window resize during pointer gesture",
        ...(await displacedRelease(page, 1, {
          during: async () => {
            await app.evaluate(({ BrowserWindow }) =>
              BrowserWindow.getAllWindows()[0].setContentSize(1250, 800),
            );
            await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1250);
          },
        })),
      });
      assert.notDeepEqual(await currentCoordinates(), beforeResize);
      project.cancelled = await displacedRelease(page, 2, {
        cancel: "pointercancel",
      });
      project.lostCapture = await displacedRelease(page, 2, {
        cancel: "lostpointercapture",
      });
      // Finish the aborted pointer sequence so the next real sequence can start.
      await pinboard(page).dispatchEvent("pointerup", {
        pointerId: 42,
        pointerType: "mouse",
        button: 0,
      });
    }
    for (let i = 0; i < 25; i++) {
      if (i % 5 === 0) await overview();
      const id = ((i * 7) % n) + 1,
        sign = i % 2 ? -1 : 1;
      project.motions.push({
        kind: "stress",
        ...(await displacedRelease(page, id, {
          dx: sign * (14 + (i % 13)),
          dy: sign * (8 + (i % 11)),
        })),
      });
    }
    const final = await currentCoordinates();
    await expect(page.locator(".studio-unsaved")).toBeVisible();
    const saved = join(out, `Bewegungen-${n}.mysteryboard`);
    await fileTarget(saved);
    await saveProject(page, true);
    const document = JSON.parse(await readFile(saved, "utf8"));
    assert.equal(document.content.version, original.content.version);
    assert.equal(document.contentHash, original.contentHash);
    assert.deepEqual(
      Object.fromEntries(
        document.author.board.map(({ id, x, y }) => [id, [x, y]]),
      ),
      final,
    );
    await close();
    await launch();
    await open(saved, n);
    assert.deepEqual(await currentCoordinates(), final);
    project.afterProcessRestart = await currentCoordinates();
    project.contentHash = document.contentHash;
    proof.projects.push(project);
    await buttonOnPage("Zur Projektübersicht").click();
  }
  await open(join(out, "Bewegungen-5.mysteryboard"), 5);
  await buttonOnPage("Verbindungen bearbeiten").click();
  await makeConnection(1, 2, "Planung bleibt intern", false);
  await makeConnection(3, 4, "Beobachtung als Starthilfe", true);
  await makeConnection(4, 5, "Wird entfernt", false);
  let edges = pinboard(page).locator("[data-edge]");
  await expect(edges).toHaveCount(3);
  const privateArrow = pinboard(page).getByRole("button", {
    name: /Planung bleibt intern/,
  });
  await privateArrow.press("Enter");
  const edgeDialog = page.getByRole("dialog", {
    name: "Verbindung bearbeiten",
  });
  await edgeDialog.getByRole("combobox").selectOption("2");
  await button(edgeDialog, "Übernehmen").click();
  await expect(privateArrow.locator("line").last()).toHaveAttribute(
    "marker-start",
    /^url/,
  );
  await pinboard(page)
    .getByRole("button", { name: /Wird entfernt/ })
    .press("Enter");
  await button(edgeDialog, "Verbindung löschen").click();
  await expect(edges).toHaveCount(2);
  await buttonOnPage("Verbindungsmodus beenden").click();
  await overview();
  const line = privateArrow.locator("line").last();
  const x = await line.getAttribute("x1");
  await moveWithMouse(page, 1, {
    dx: 56,
    dy: 9,
    steps: 5,
    during: async () => {
      await expect(line).toHaveAttribute("x1", x);
    },
    beforeRelease: async () => {
      await expect(line).not.toHaveAttribute("x1", x);
      await page.screenshot({ path: join(out, "Pfeil-waehrend-Ziehen.png") });
    },
  });
  assert.notEqual(await line.getAttribute("x1"), x);
  screenshot = join(out, "Autorenpinnwand-Pfeile.png");
  await page.screenshot({ path: screenshot });
  const saved = join(out, "Autor-mit-Pfeilen.mysteryboard");
  await fileTarget(saved);
  await saveProject(page, true);
  const project = JSON.parse(await readFile(saved, "utf8"));
  assert.equal(project.author.edges[0].label, "Planung bleibt intern");
  assert.equal(
    project.content.initial.edges[0].label,
    "Beobachtung als Starthilfe",
  );
  await close();
  await launch();
  await open(saved, 5);
  await expect(pinboard(page).locator("[data-edge]")).toHaveCount(2);
  const scorm = join(out, "Starthilfe-SCORM.zip");
  await fileTarget(scorm);
  await openExports(page);
  await expect(
    page.getByText("Starthilfen für Lernende (1)", { exact: true }),
  ).toBeVisible();
  const confirmation = page.getByRole("checkbox", {
    name: "Ich habe die vorgegebenen Verbindungen geprüft und möchte sie an die Lernenden weitergeben.",
    exact: true,
  });
  const scormButton = buttonOnPage("Für itslearning exportieren");
  const pngButton = buttonOnPage("Als Bild exportieren");
  const reviewed = page.getByRole("region", {
    name: "Starthilfen kontrollieren",
  });
  await expect(reviewed).toContainText(
    "Dieses Mystery enthält bereits vorgegebene Verbindungen für Lernende.",
  );
  await expect(reviewed).toContainText("Beobachtung als Starthilfe");
  await expect(reviewed).not.toContainText("Planung bleibt intern");
  await expect(confirmation).not.toBeChecked();
  await expect(scormButton).toBeDisabled();
  await expect(pngButton).toBeDisabled();
  // Even programmatic dispatch at the disabled actions produces no file.
  await scormButton.dispatchEvent("click");
  await pngButton.dispatchEvent("click");
  assert.equal(
    await stat(scorm)
      .then(() => true)
      .catch(() => false),
    false,
  );
  const saveWithoutConfirm = join(
    out,
    "Projekt-ohne-Exportfreigabe.mysteryboard",
  );
  await fileTarget(saveWithoutConfirm);
  await saveProject(page, true);
  await stat(saveWithoutConfirm);
  await openExports(page);
  await expect(scormButton).toBeDisabled();
  await page.screenshot({ path: join(out, "Export-Starthilfen.png") });
  const openingPreview = app.waitForEvent("window");
  await buttonOnPage("Schüleransicht prüfen").click();
  const preview = await openingPreview;
  await preview.getByLabel("Teamname oder Vornamen").fill("Vorschau");
  await button(preview, "Beginnen").click();
  await expect(preview.locator("[data-card]")).toHaveCount(5);
  await expect(preview.locator("[data-edge]")).toHaveCount(1);
  await expect(preview.locator("[data-edge]")).toHaveAttribute(
    "aria-label",
    /Beobachtung als Starthilfe/,
  );
  const previewTask = JSON.parse(
    Buffer.from(
      JSON.parse(await preview.locator("#mysteryboard-launch").textContent())
        .task,
      "base64",
    ).toString(),
  );
  await preview.screenshot({ path: join(out, "Native-Schuelervorschau.png") });
  await preview.close();
  await confirmation.check();
  await expect(scormButton).toBeEnabled();
  await expect(pngButton).toBeEnabled();
  await fileTarget(scorm);
  await scormButton.click();
  await expect
    .poll(async () =>
      stat(scorm)
        .then((f) => f.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  const files = unzipSync(new Uint8Array(await readFile(scorm)));
  const html = Buffer.from(files["app.html"]).toString();
  const launchData = JSON.parse(
    html.match(
      /<script id="mysteryboard-launch" type="application\/json">([\s\S]+?)<\/script>/,
    )[1],
  );
  const task = JSON.parse(Buffer.from(launchData.task, "base64").toString());
  assert.deepEqual(previewTask, task);
  assert.deepEqual(task.content.initial.edges, project.content.initial.edges);
  assert(!JSON.stringify(task).includes("Planung bleibt intern"));
  assert(!Object.hasOwn(task, "author"));
  await closeExports(page);
  await openExports(page);
  await expect(confirmation).not.toBeChecked();
  await expect(pngButton).toBeDisabled();
  await confirmation.check();
  const png = join(out, "Aufgabe-mit-Starthilfe.png");
  await fileTarget(png);
  await pngButton.click();
  await expect
    .poll(() =>
      stat(png)
        .then((f) => f.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  await closeExports(page);
  await pinboard(page)
    .getByRole("button", { name: /Beobachtung als Starthilfe/ })
    .press("Enter");
  const changeEdge = page.getByRole("dialog", {
    name: "Verbindung bearbeiten",
  });
  await changeEdge
    .getByLabel("Beschriftung (freiwillig)")
    .fill("Erneut zu prüfende Starthilfe");
  await changeEdge.getByRole("combobox").selectOption("2");
  await button(changeEdge, "Übernehmen").click();
  await openExports(page);
  await expect(reviewed).toContainText("Erneut zu prüfende Starthilfe");
  await expect(confirmation).not.toBeChecked();
  await expect(scormButton).toBeDisabled();
  await closeExports(page);
  proof.publication = {
    blockedWithoutConfirmation: true,
    newConfirmationAfterEdit: true,
    saveWithoutConfirmation: true,
    previewMatchesScorm: true,
    confirmedPng: png,
  };
  proof.edges = {
    project: saved,
    scorm,
    teacherEdges: project.author.edges,
    studentEdges: task.content.initial.edges,
    authorScreenshot: screenshot,
  };
  await buttonOnPage("Zur Projektübersicht").click();
  await open(resolve("qa/studio/evidence/legacy/Studio-0.2.0.mysteryboard"), 5);
  await fileTarget(join(out, "Altaufgabe-neu-exportiert.zip"));
  await openExports(page);
  await expect(confirmation).toHaveCount(0);
  await expect(scormButton).toBeEnabled();
  await buttonOnPage("Für itslearning exportieren").click();
  await expect
    .poll(async () =>
      stat(join(out, "Altaufgabe-neu-exportiert.zip"))
        .then((file) => file.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  await buttonOnPage("Zur Projektübersicht").click();
  const legacy021 = resolve(
    "qa/studio/evidence/player-021/Autor-mit-Pfeilen.mysteryboard",
  );
  const originalBytes = await readFile(legacy021);
  await open(legacy021, 5);
  assert.deepEqual(await readFile(legacy021), originalBytes);
  const previous = join(out, "Altprojekt-021-SCORM.zip");
  await fileTarget(previous);
  await openExports(page);
  await confirmation.check();
  await scormButton.click();
  await expect
    .poll(() =>
      stat(previous)
        .then((f) => f.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  const hidden = JSON.parse(originalBytes);
  hidden.author.hiddenCards = [4];
  const visibleEdge = {
    id: 99,
    from: 1,
    to: 3,
    direction: 0,
    label: "Sichtbar ohne Richtung",
  };
  hidden.content.initial.edges.push(visibleEdge);
  hidden.contentHash = createHash("sha256")
    .update(canonical(hidden.content))
    .digest("hex");
  const hiddenPath = join(out, "Verdeckte-Karte.mysteryboard");
  await writeFile(hiddenPath, canonical(hidden));
  await buttonOnPage("Zur Projektübersicht").click();
  await open(hiddenPath, 5);
  await openExports(page);
  await expect(reviewed).toContainText("Sichtbar ohne Richtung");
  await expect(reviewed).not.toContainText("Beobachtung als Starthilfe");
  await expect(reviewed).not.toContainText("Planung bleibt intern");
  await expect(
    page.getByText("Starthilfen zu ausgeblendeten Karten werden ausgelassen."),
  ).toBeVisible();
  await confirmation.check();
  const filtered = join(out, "Gefilterte-Starthilfe.zip");
  await fileTarget(filtered);
  await scormButton.click();
  await expect
    .poll(() =>
      stat(filtered)
        .then((f) => f.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  const filteredHtml = Buffer.from(
    unzipSync(new Uint8Array(await readFile(filtered)))["app.html"],
  ).toString();
  const filteredLaunch = JSON.parse(
    filteredHtml.match(
      /<script id="mysteryboard-launch" type="application\/json">([\s\S]+?)<\/script>/,
    )[1],
  );
  const filteredTask = JSON.parse(
    Buffer.from(filteredLaunch.task, "base64").toString(),
  );
  assert.equal(filteredTask.content.cards.length, 4);
  assert.deepEqual(filteredTask.content.initial.edges, [visibleEdge]);
  proof.publication.hiddenCardsMatchRealExport = true;
  proof.passed = true;
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: join(out, "Fehler.png") }).catch(() => {});
  proof.error = String(error);
  throw error;
} finally {
  await writeFile(
    join(out, "Mac-Pinnwand-Tests.json"),
    JSON.stringify(proof, null, 2) + "\n",
  );
  await close();
}
