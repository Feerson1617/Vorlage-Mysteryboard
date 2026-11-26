import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { _electron, chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { button, openExports, closeExports } from "./controls.mjs";
import { host } from "./web-host.mjs";
import { pinboard, moveWithMouse, coordinates } from "./board-gestures.mjs";
const out = resolve(process.argv[2]);
await mkdir(out, { recursive: true });
const path = (n) => join(out, n),
  json = async (n) => JSON.parse(await readFile(path(n)));
const title = "Küsten im Wandel";
const image =
  "data:image/png;base64," +
  (await readFile("tests/fixtures/document-import/bild-1.png")).toString(
    "base64",
  );
const edge = (id, from, to, label) => ({ id, from, to, label, direction: 1 });
const levels = ["Basis", "Küsten im Wandel Überprüfung"].map((name, i) => ({
  name,
  content: {
    title: "Salzwiesen " + name,
    instructions: "Erklärt die Veränderung am Ufer.",
    cards: [
      { id: 1, title: "Interne Planungsnotiz", text: "Nur für Lehrkräfte" },
      {
        id: 2,
        title: "Sturmflut",
        text: "Starkwind treibt Wasser an die Küste.",
        image,
        imageAlt: "Prüfabbildung",
      },
      { id: 3, title: "Salzwiese", text: "Pflanzen bremsen die Strömung." },
      {
        id: 4,
        title: "Erklärung",
        text: "",
        studentEditable: true,
        group: "extension",
      },
    ],
    help: { method: "Vergleicht Strömung und Ablagerung." },
  },
  author: { hiddenCards: [1], edges: [edge(2, 1, 2, "PRIVATE-MODELL")] },
  studentHints: [edge(1, 2, 3, "Wirkung prüfen")],
}));
const ai = {
  format: "MysteryBoardAI",
  formatVersion: 1,
  kind: "project",
  project: { kind: "collection", title, levels },
};
const input = "Küsten-Austausch.mysteryboard";
await writeFile(path(input), JSON.stringify(ai));
const single = {
  ...ai,
  project: {
    kind: "single",
    content: { ...levels[0].content, title: "Dünen & Küsten" },
  },
};
await writeFile(path("Einzel.txt"), JSON.stringify(single));
const app = await _electron.launch({
  executablePath: process.env.STUDIO_EXEC,
  args: ["--user-data-dir=" + path("profile")],
});
const server = await host(out),
  page = await app.firstWindow();
const click = (n) => button(page, n).click();
const file = async (n) =>
  app.evaluate((_, v) => (globalThis.pick = v), path(n));
const dest = async (n) =>
  app.evaluate(
    (_, v) => {
      globalThis.saveName = v;
    },
    n === null ? null : n === true ? true : path(n),
  );
const review = page.getByRole("dialog", { name: "KI-Material prüfen" });
const metrics = { routes: [], players: [], files: [] };
try {
  assert.deepEqual(
    await app.evaluate(({ app, dialog }, out) => {
      globalThis.decisions = [];
      globalThis.output = out;
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [globalThis.pick],
      });
      dialog.showSaveDialog = async (_w, o) => ({
        canceled: globalThis.saveName === null,
        filePath:
          globalThis.saveName === true
            ? globalThis.output + "/" + o.defaultPath
            : globalThis.saveName,
      });
      const answer = (...args) => {
        const options = args.at(-1);
        if (options.message === "Ungesicherte Änderungen")
          return globalThis.decisions.shift() ?? 1;
        return globalThis.cancelBoardAction ? 1 : 0;
      };
      dialog.showMessageBox = async (...args) => ({
        response: answer(...args),
      });
      dialog.showMessageBoxSync = (...args) => answer(...args);
      return [process.arch, app.isPackaged, app.getVersion()];
    }, out),
    ["arm64", true, "0.3.2"],
  );
  let cancelBoard = false;
  page.on("dialog", (d) =>
    (cancelBoard ? d.dismiss() : d.accept()).catch(() => {}),
  );
  await file(input);
  await click("Mystery öffnen");
  await expect(review).toBeVisible();
  await click("Abbrechen");
  metrics.routes.push("öffnen");
  await click("Unterrichtsmaterial importieren");
  await page.getByLabel("Lehrkraftkürzel").fill("LK");
  await click("Mystery erstellen");
  await click("Mystery-Datei auswählen");
  await expect(review).toBeVisible();
  await click("Abbrechen");
  metrics.routes.push("Material");
  await click("Importieren");
  await expect(review).toBeVisible();
  await click("Als Projekt übernehmen");
  metrics.routes.push("Pinnwand");
  const board = pinboard(page),
    cards = board.locator("[data-card]");
  await expect(cards).toHaveCount(3);
  await expect(board.locator("[data-edge]")).toHaveCount(1);
  await dest(null);
  await click("Speichern");
  await expect(page.locator(".studio-unsaved")).toBeVisible();
  await dest("Küsten-Projekt.mysteryboard");
  await click("Speichern");
  await expect(button(page, "Speichern")).toBeDisabled();
  await expect(page.locator(".studio-project-status")).toHaveText(
    "Alle Änderungen gespeichert",
  );
  const save = async () => {
    await click("Speichern");
    await expect(button(page, "Speichern")).toBeDisabled();
    return json("Küsten-Projekt.mysteryboard");
  };
  const initial = await json("Küsten-Projekt.mysteryboard");
  await moveWithMouse(page, 1, { dx: 48, dy: 25, steps: 4 });
  async function connect(a, b, label) {
    await click("Verbindungen bearbeiten");
    await board.locator('[data-card="' + a + '"]').press("Enter");
    await board.locator('[data-card="' + b + '"]').press("Enter");
    await page.getByLabel("Beschriftung (freiwillig)").fill(label);
    await click("Übernehmen");
    await click("Verbindungsmodus beenden");
  }
  await connect(2, 3, "Sediment bleibt liegen");
  const student = await save(),
    expected = student.levels[0].draft.content.initial.cards
      .filter((c) => c.id !== 1)
      .map((c) => [c.x, c.y]);
  assert.deepEqual(await coordinates(board, 1), expected[0]);
  const privateButton = page.getByRole("button", {
    name: /^Musterlösung \(privat\)/,
  });
  await privateButton.click();
  await expect(cards).toHaveCount(4);
  await moveWithMouse(page, 2, { dx: 33, dy: 21, steps: 4 });
  await connect(1, 4, "PRIVATE-ERGÄNZUNG");
  await page.screenshot({ path: path("Musterlösung.png") });
  const priv = await save();
  assert.deepEqual(
    priv.levels[0].draft.content,
    student.levels[0].draft.content,
  );
  await openExports(page);
  const checkHints = page.getByRole("dialog").getByRole("checkbox");
  if (await checkHints.count()) await checkHints.check();
  const openingPreview = app.waitForEvent("window");
  await click("Schüleransicht prüfen");
  const preview = await openingPreview;
  await preview.getByLabel("Gruppenname", { exact: true }).fill("Vorschau");
  await button(preview, "Beginnen").click();
  await expect(preview.locator("[data-card]")).toHaveCount(3);
  await expect(preview.locator("[data-edge]")).toHaveCount(2);
  for (const [index, pos] of expected.entries())
    assert.deepEqual(await coordinates(preview, index + 1), pos);
  await expect(preview.locator("svg.board")).not.toContainText("PRIVATE-");
  await preview.close();
  await closeExports(page);
  const boardAction = async (name) => {
    const d = page.locator(".studio-board-actions");
    if (!(await d.evaluate((d) => d.open))) await d.locator("summary").click();
    await button(d, name).click();
  };
  cancelBoard = true;
  await app.evaluate(() => {
    globalThis.cancelBoardAction = true;
  });
  const beforeCancel = await coordinates(board, 2);
  await boardAction("Kartenanordnung nach Nummern");
  await boardAction("Sämtliche Verbindungen löschen");
  await expect(board.locator("[data-edge]")).toHaveCount(4);
  assert.deepEqual(await coordinates(board, 2), beforeCancel);
  await expect(button(page, "Speichern")).toBeDisabled();
  cancelBoard = false;
  await app.evaluate(() => {
    globalThis.cancelBoardAction = false;
  });
  await boardAction("Sämtliche Verbindungen löschen");
  await expect(board.locator("[data-edge]")).toHaveCount(2);
  await boardAction("Löschen rückgängig");
  await click("Schülerstart");
  await boardAction("Sämtliche Verbindungen löschen");
  await expect(board.locator("[data-edge]")).toHaveCount(0);
  await boardAction("Löschen rückgängig");
  await boardAction("Kartenanordnung nach Nummern");
  const reset = await save();
  assert.equal(reset.levels[0].draft.content.startLayout.mode, "ordered");
  await moveWithMouse(page, 1, { dx: 30, dy: 16, steps: 4 });
  const sorted = await save();
  assert.deepEqual(sorted.levels[0].draft.author, priv.levels[0].draft.author);
  assert.deepEqual(
    sorted.levels[0].draft.content.initial.edges,
    priv.levels[0].draft.content.initial.edges,
  );
  assert.deepEqual(sorted.levels[1], initial.levels[1]);
  const details = page.locator(".studio-board-actions");
  if (await details.evaluate((el) => el.open))
    await details.locator("summary").click();
  await page.screenshot({ path: path("Schülerstart.png") });
  await privateButton.click();
  const writeZip = async (label, name, rename) => {
    await openExports(page);
    const ch = page.getByRole("dialog").getByRole("checkbox");
    if (await ch.count()) await ch.check();
    await dest(rename ?? true);
    await click(label);
    await expect
      .poll(
        () =>
          stat(path(rename ?? name)).then(
            (f) => f.size,
            () => 0,
          ),
        { timeout: 30000 },
      )
      .toBeGreaterThan(1000);
    await closeExports(page);
    const entries = unzipSync(await readFile(path(rename ?? name)));
    assert(entries["imsmanifest.xml"]);
    metrics.files.push(rename ?? name);
    return entries;
  };
  const all = await writeZip(
    "Alle Niveaus für itslearning exportieren",
    "Küsten_im_Wandel_SCORM_alle_Niveaus.zip",
  );
  if (await page.getByLabel("Aktuelles Niveau").isVisible())
    await page.getByLabel("Aktuelles Niveau").selectOption(sorted.levels[1].id);
  else await click(levels[1].name);
  await writeZip(
    "Für itslearning exportieren",
    "Küsten_im_Wandel_SCORM_Überprüfung.zip",
  );
  await click("Speichern");
  await expect(button(page, "Speichern")).toBeDisabled();
  const finalProject = await json("Küsten-Projekt.mysteryboard");
  assert.deepEqual(finalProject.levels, sorted.levels);
  assert.equal(finalProject.active, finalProject.levels[1].id);
  await click("Zur Startseite");
  await file("Küsten-Projekt.mysteryboard");
  await click("Mystery öffnen");
  await expect(page.getByLabel("Aktuelles Niveau")).toHaveValue(
    sorted.levels[1].id,
  );
  await click("Zur Startseite");
  await page.locator("main").evaluate((el, v) => {
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(v)], "Datei.txt"));
    el.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: dt }),
    );
  }, single);
  await expect(review).toBeVisible();
  await click("Als Projekt übernehmen");
  metrics.routes.push("Drop");
  await writeZip("Für itslearning exportieren", "Dünen_Küsten_SCORM.zip");
  await writeZip(
    "Für itslearning exportieren",
    "Dünen_Küsten_SCORM.zip",
    "Eigene Ausgabe.zip",
  );
  const dir = path("player");
  await mkdir(dir, { recursive: true });
  for (const [n, b] of Object.entries(all)) {
    assert(!Buffer.from(b).includes("PRIVATE-"));
    await writeFile(join(dir, n), b);
  }
  const published = JSON.parse(
    Buffer.from(all["level-" + sorted.levels[0].id + ".json"]),
  );
  const positions = sorted.levels[0].draft.content.initial.cards
    .slice(1)
    .map((c) => [c.x, c.y]);
  assert.deepEqual(
    published.content.initial.cards.map((c) => [c.x, c.y]),
    positions,
  );
  assert.deepEqual(
    published.content.initial.edges.map(({ from, to, label, direction }) => [
      from,
      to,
      label,
      direction,
    ]),
    [
      [1, 2, "Wirkung prüfen", 1],
      [2, 3, "Sediment bleibt liegen", 1],
    ],
  );
  assert.deepEqual(
    published.content.cards.map((c) => c.title),
    ["Sturmflut", "Salzwiese", "Erklärung"],
  );
  assert.equal(published.content.cards[0].image, image);
  assert.equal(published.content.cards[2].studentEditable, true);
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      const p = await browser.newPage();
      await p.goto(server.origin + "/qa-evidence/player/launch.html");
      const u = p.frameLocator("iframe");
      await u.getByRole("button", { name: /^Basis/ }).click();
      await u.getByLabel("Gruppenname", { exact: true }).fill("Team Küste");
      await button(u, "Beginnen").click();
      await expect(u.locator("[data-card]")).toHaveCount(3);
      await expect(u.locator("[data-edge]")).toHaveCount(2);
      for (const [i, pos] of positions.entries())
        assert.deepEqual(await coordinates(u, i + 1), pos);
      await p.screenshot({
        path: path("Schülerplayer-" + engine.name() + ".png"),
      });
      metrics.players.push(engine.name());
    } finally {
      await browser.close();
    }
  }
  await writeFile(path("Abnahme-032.json"), JSON.stringify(metrics, null, 2));
} catch (error) {
  await page.screenshot({ path: path("Fehler-032.png") }).catch(() => {});
  console.error((await page.locator("body").innerText()).slice(0, 2500));
  throw error;
} finally {
  server.close();
  await app.close();
}
