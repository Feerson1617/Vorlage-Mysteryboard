import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { chromium, _electron, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
import { button, openExports, closeExports, saveProject } from "./controls.mjs";
import { releaseOnly, cardPosition } from "./student-release.mjs";

const out = resolve(process.argv[2]),
  fixtures = join(out, "inputs");
await mkdir(out, { recursive: true });
execFileSync("python3", ["qa/studio/readiness-fixtures-031.py", fixtures]);
const native = !!process.env.STUDIO_EXEC,
  server = await host(out);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const report = {
  installedMac: false,
  windows: [],
  choices: [],
  outside: [],
  invalid: [],
  players: [],
};
const file = (n) => join(out, n);
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const digest = (b) => createHash("sha256").update(b).digest("hex");
const wait = expect.configure({ timeout: 90000 });
let app, page, target, source;
try {
  if (native) {
    app = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + file("profile")],
    });
    assert.deepEqual(
      await app.evaluate(({ app, dialog }) => {
        globalThis.decisions = [];
        globalThis.questions = [];
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [globalThis.source],
        });
        dialog.showSaveDialog = async () => ({
          canceled: !globalThis.target,
          filePath: globalThis.target,
        });
        dialog.showMessageBox = async (_w, opts) => {
          if (
            opts.message !== "Ungesicherte Änderungen" ||
            !globalThis.decisions.length
          )
            throw Error("Unerwartete native Rückfrage");
          const response = globalThis.decisions.shift();
          globalThis.questions.push({ buttons: opts.buttons, response });
          return { response };
        };
        return [
          app.getVersion(),
          app.isPackaged,
          process.arch,
          process.platform,
        ];
      }),
      [process.env.STUDIO_VERSION || "0.3.2", true, "arm64", "darwin"],
    );
    report.installedMac = true;
    page = await app.firstWindow();
  } else {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.exposeFunction("inputName", () => source);
    await page.exposeFunction("saveBytes", async (data) => {
      await writeFile(target, Buffer.from(data, "base64"));
      return { name: target.split("/").pop() };
    });
    await page.addInitScript(() => {
      const save = (bytes) => window.saveBytes(bytes.toBase64());
      window.mysteryStudio = {
        openProject: async () => {
          const name = await window.inputName();
          return {
            name,
            bytes: new Uint8Array(
              await (
                await fetch("/qa-evidence/inputs/" + name + ".mysteryboard")
              ).arrayBuffer(),
            ),
          };
        },
        recentProjects: async () => [],
        onSaved: () => () => {},
        onCommand: (fn) => {
          (window.listeners ??= new Set()).add(fn);
          return () => window.listeners.delete(fn);
        },
        projectState: async () => {},
        modalState: async () => {},
        detachProject: async () => {},
        replaceWithExchange: async () => true,
        saveProject: save,
        saveExport: save,
      };
    });
    await page.goto(server.origin + "/studio/dist/studio/index.html");
  }
  page.setDefaultTimeout(90000);
  await wait(button(page, "Mystery öffnen")).toBeVisible();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  const click = (n) => button(page, n).click();
  const review = page.getByRole("dialog", { name: "KI-Material prüfen" });
  const title = page.getByLabel("Mystery-Titel", { exact: true });
  async function destination(name) {
    target = name ? file(name) : null;
    if (native)
      await app.evaluate((_, v) => {
        globalThis.target = v;
      }, target);
  }
  async function open(name) {
    console.log("Prüfe Datei", name);
    source = name;
    if (native)
      await app.evaluate(
        (_, s) => {
          globalThis.source = s;
        },
        join(fixtures, name + ".mysteryboard"),
      );
    if (await button(page, "Mystery öffnen").isVisible())
      await click("Mystery öffnen");
    else if (native) {
      await wait
        .poll(() =>
          app.evaluate(
            ({ Menu }) =>
              Menu.getApplicationMenu().getMenuItemById("project-open").enabled,
          ),
        )
        .toBe(true);
      await app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().getMenuItemById("project-open").click(),
      );
    } else
      await page.evaluate(() => window.listeners.forEach((fn) => fn("open")));
  }
  const take = () => click("Als Projekt übernehmen");
  async function choose(index) {
    await app.evaluate((_, v) => globalThis.decisions.push(v), index);
    await take();
    await wait(review).toHaveCount(0);
  }
  for (const [n, pattern] of [
    ["Fehlend", /Karte 1/],
    ["Referenz", /studentHints/],
    ["Unbekannt", /neu/],
    ["Defekt", /JSON/],
  ]) {
    await open(n);
    await wait(page.getByRole("alert")).toContainText(pattern);
    await click("Fehlerhinweise kopieren");
    if (native) {
      const copied = await app.evaluate(({ clipboard }) =>
        clipboard.readText(),
      );
      assert.match(copied, pattern);
    }
    await click("Schließen");
    report.invalid.push(n);
  }
  for (const n of ["Doppelt", "Versteckt"]) {
    await open(n);
    await wait(review).toContainText("Korrekturen vor dem Export");
    await wait(button(review, "Als Projekt übernehmen")).toBeDisabled();
    await review.getByRole("checkbox").check();
    if (n === "Doppelt") await click("Abbrechen");
    else await take();
  }
  await wait(title).toBeVisible();
  if (native) {
    await title.fill("Meine ungesicherte Vorbereitung");
    for (const response of [0, 2]) {
      await destination(null);
      await open("Doppelt");
      await review.getByRole("checkbox").check();
      await choose(response);
      await wait(title).toHaveValue("Meine ungesicherte Vorbereitung");
      await wait(
        page.getByText("Ungesicherte Änderungen", { exact: false }).first(),
      ).toBeVisible();
    }
    await destination("Bewahrtes-Projekt.mysteryboard");
    await open("Doppelt");
    await review.getByRole("checkbox").check();
    await choose(2);
    assert.equal(
      (await json(target)).content.title,
      "Meine ungesicherte Vorbereitung",
    );
    assert.deepEqual((await json(target)).author.hiddenCards, [1, 2, 3]);
    await destination("Duplikat.mysteryboard");
    await saveProject(page);
    const previous = await readFile(target);
    await title.fill("Noch nicht auf Platte");
    await open("Fehlend");
    await wait(page.getByRole("alert")).toContainText("Karte 1");
    await click("Schließen");
    await open("Versteckt");
    await click("Abbrechen");
    assert.deepEqual(await readFile(target), previous);
    await destination(null);
    await saveProject(page);
    assert.equal(
      (await json(file("Duplikat.mysteryboard"))).content.title,
      "Noch nicht auf Platte",
    );
    await title.fill("Bewusst verwerfen");
    await open("Niveaus-12");
  } else await open("Niveaus-12");
  await wait(review.locator("li")).toHaveCount(12);
  for (const [w, h] of native
    ? [
        [820, 600],
        [1200, 800],
      ]
    : [
        [820, 600],
        [1440, 900],
      ]) {
    if (native)
      await app.evaluate(
        ({ BrowserWindow }, [w, h]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(w, h),
        [w, h],
      );
    else await page.setViewportSize({ width: w, height: h });
    const metrics = await review.evaluate((d) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
      };
      return {
        width: innerWidth,
        height: innerHeight,
        consent: visible(d.querySelector("footer label")),
        action: visible(d.querySelector("footer .primary")),
        opens: d.querySelectorAll("details[open]").length,
      };
    });
    assert(metrics.consent && metrics.action && metrics.opens === 0);
    report.windows.push(metrics);
    await page.screenshot({ path: file("Importpruefung-" + w + ".png") });
  }
  await review.locator("summary").last().click();
  await wait(review.locator("details[open]")).toContainText("Speicherung");
  await wait(button(review, "Als Projekt übernehmen")).toBeDisabled();
  await review.getByRole("checkbox").check();
  if (native) {
    await choose(1);
    report.choices = await app.evaluate(() => globalThis.questions);
    assert.deepEqual(
      report.choices.map((q) => q.response),
      [0, 2, 2, 1],
    );
    assert(
      report.choices.every(
        (q) =>
          q.buttons.join("|") ===
          "Abbrechen|Änderungen verwerfen|Projekt speichern",
      ),
    );
  } else await take();
  await wait(page.locator(".studio-board [data-card]")).toHaveCount(100);
  if (native) await app.evaluate(() => globalThis.decisions.push(1));
  await open("Gross");
  await wait(review).toContainText("Technisch exportbereit");
  await take();
  await wait(page.locator(".studio-board [data-card]")).toHaveCount(3);
  await destination("Gross-Projekt.mysteryboard");
  await saveProject(page);
  const draft = await json(target);
  report.projectBytes = (await stat(target)).size;
  assert.equal(report.projectBytes, 9618026);
  const archive = "KI-Gross-SCORM.zip";
  await destination(archive);
  await openExports(page);
  await click("Für itslearning exportieren");
  await wait
    .poll(async () =>
      stat(target).then(
        (s) => s.size,
        () => 0,
      ),
    )
    .toBeGreaterThan(0);
  await closeExports(page);
  const zipped = await readFile(target),
    entries = unzipSync(zipped),
    task = JSON.parse(Buffer.from(entries["task.json"]));
  assert.equal(entries["task.json"].length, 9617958);
  assert.deepEqual(task.content, draft.content);
  assert.equal(task.contentHash, draft.contentHash);
  const sources = (await json(join(fixtures, "Gross.mysteryboard"))).project
    .content.cards;
  for (const [i, k] of task.content.cards.entries())
    assert.equal(k.image, sources[i].image);
  report.taskBytes = entries["task.json"].length;
  report.base64Bytes = 4 * Math.ceil(report.taskBytes / 3);
  report.playerBytes = entries["app.html"].length;
  report.archiveSha256 = digest(zipped);
  assert(report.playerBytes < 10_000_000);
  const dir = file("player");
  await mkdir(dir, { recursive: true });
  for (const [k, v] of Object.entries(entries)) {
    assert(!k.includes("/"));
    await writeFile(join(dir, k), v);
  }
  const launch = async () => {
    const p = await browser.newPage();
    p.setDefaultTimeout(90000);
    p.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(server.origin + "/"))
        report.outside.push(r.url());
    });
    p.on("dialog", (d) => d.accept().catch(() => {}));
    await p.goto(server.origin + "/qa-evidence/player/launch.html");
    return [p, p.frameLocator("iframe")];
  };
  const [p, u] = await launch();
  await u.getByLabel("Gruppenname", { exact: true }).fill("Team Schichten");
  await button(u, "Beginnen").click();
  for (const k of task.content.cards) {
    await u.locator('[data-card="' + k.id + '"]').press("Enter");
    const img = u
      .getByRole("dialog")
      .getByAltText(k.imageAlt, { exact: true })
      .first();
    await wait(img).toBeVisible();
    await wait
      .poll(() => img.evaluate((el) => [el.naturalWidth, el.naturalHeight]))
      .toEqual([1000, 800]);
    assert.equal(await img.getAttribute("src"), k.image);
    report.players.push({
      id: k.id,
      pixels: [1000, 800],
      sha256: digest(Buffer.from(k.image.split(",")[1], "base64")),
    });
    if (k.id === 1)
      await p.screenshot({ path: file("Schueler-Bildmaterial.png") });
    await button(u, "Schließen").click();
  }
  const move = await releaseOnly(u, 1, { dx: 26, dy: 12, type: "touch" });
  assert.deepEqual(move.actual, move.target);
  const pos = await cardPosition(u, 1);
  await button(u, "Export").click();
  const link = u.getByRole("link", { name: "PNG herunterladen" });
  const png = "Team Schichten_Farbige Schichtmodelle.png";
  await wait(link).toHaveAttribute("download", png);
  const dl = p.waitForEvent("download");
  await link.click();
  await (await dl).saveAs(file(png));
  execFileSync("python3", [
    "qa/touch-saving/verify-png.py",
    file(png),
    file("decoded.json"),
  ]);
  const restored = await json(file("decoded.json"));
  assert.deepEqual(restored.content, task.content);
  assert.equal(restored.work.team, "Team Schichten");
  await p.close();
  const [fresh, v] = await launch();
  await button(v, "Original-PNG öffnen").click();
  await v.getByLabel("Schüler-Sicherung").setInputFiles(file(png));
  await wait(v.locator("[data-card]")).toHaveCount(3);
  assert.deepEqual(await cardPosition(v, 1), pos);
  await fresh.close();
  assert.deepEqual(report.outside, []);
  report.pngSha256 = digest(await readFile(file(png)));
  await writeFile(
    file("Exportbereitschaft.json"),
    JSON.stringify(report, null, 2),
  );
} catch (e) {
  if (page) await page.screenshot({ path: file("Fehler.png") }).catch(() => {});
  throw e;
} finally {
  if (app) await app.close().catch(() => {});
  await browser.close();
  server.close();
}
