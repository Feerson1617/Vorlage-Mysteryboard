import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { _electron, chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { button, openExports, closeExports, saveProject } from "./controls.mjs";
import { host } from "./web-host.mjs";
import { fixtures } from "./fixtures.mjs";
import { releaseOnly, cardPosition } from "./student-release.mjs";
const out = resolve(process.argv[2]),
  native = !!process.env.STUDIO_EXEC;
await mkdir(out, { recursive: true });
execFileSync("python3", ["qa/studio/fixtures-028.py", out]);
const server = await host(out);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const project = join(out, "Wasser.mysteryboard"),
  scorm = join(out, "Wasser-SCORM.zip"),
  names = ["Fördern", "ESA", "MSA", "AHR"];
const canonical = (v) =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? "[" + v.map(canonical).join(",") + "]"
      : "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
    : JSON.stringify(v);
const hash = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const permission =
  "Lernende dürfen Überschrift und Text dieser Karte bearbeiten.";
let app,
  teacher,
  openPath = "",
  savePath = "",
  material = null,
  calls = 0;
const saveJSON = (name, d) =>
  writeFile(join(out, name), JSON.stringify(d, null, 2));
async function start() {
  if (native) {
    app = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + join(out, "profile")],
    });
    const info = await app.evaluate(({ app, dialog }) => {
      globalThis.nativeChooser = dialog.showOpenDialog.bind(dialog);
      dialog.showOpenDialog = async (_win, opts) => {
        if (["Unterrichtsmaterial auswählen","Mystery als Niveau importieren"].includes(opts.title)) {
          if (globalThis.openNativePanel)
            return globalThis.nativeChooser(_win, {
              ...opts,
              defaultPath: globalThis.chooserDirectory,
            });
          globalThis.materialCalls = (globalThis.materialCalls || 0) + 1;
          return {
            canceled: !globalThis.material,
            filePaths: globalThis.material ? [globalThis.material] : [],
          };
        }
        return { canceled: false, filePaths: [globalThis.project] };
      };
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: globalThis.target,
      });
      return [app.isPackaged, app.getVersion(), process.arch];
    });
    assert.deepEqual(info, [true, (process.env.STUDIO_VERSION || "0.2.9"), "arm64"]);
    teacher = await app.firstWindow();
  } else {
    teacher = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await teacher.exposeFunction("openFixture", async (kind) => {
      const path = kind === "material" ? material : openPath;
      if (kind === "material") calls++;
      return path
        ? {
            name: basename(path),
            data: (await readFile(path)).toString("base64"),
          }
        : null;
    });
    await teacher.exposeFunction("writeFixture", async (buf) => {
      await writeFile(savePath, Buffer.from(buf));
      return { name: basename(savePath) };
    });
    await teacher.addInitScript(() => {
      const read = async (kind) => {
        const f = await window.openFixture(kind);
        return f
          ? { name: f.name, bytes: Uint8Array.fromBase64(f.data) }
          : null;
      };
      window.mysteryStudio = {
        openProject: () => read("project"),
        chooseMaterial: () => read("material"),
        recentProjects: async () => [],
        projectState: async () => {},
        detachProject: async () => {},
        onSaved: () => {},
        saveExport: (bytes) => window.writeFixture(Array.from(bytes)),
        saveProject: (bytes) => window.writeFixture(Array.from(bytes)),
      };
    });
    await teacher.goto(server.origin + "/studio/dist/studio/index.html");
  }
  teacher.on("dialog", (d) => d.accept().catch(() => {}));
}
async function target(path) {
  savePath = path;
  if (app)
    await app.evaluate((_, v) => {
      globalThis.target = v;
    }, path);
}
async function pick(path) {
  material = path;
  if (app)
    await app.evaluate((_, v) => {
      globalThis.material = v;
    }, path);
  await button(teacher, "Importieren").click();
}
async function nativePick(path,level=false) {
  await app.evaluate(
    ({ BrowserWindow }, directory) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.focus();
      globalThis.importSheet = false;
      win.once("sheet-begin", () => {
        globalThis.importSheet = true;
      });
      win.once("sheet-end", () => {
        globalThis.importSheet = false;
      });
      globalThis.chooserDirectory = directory;
      globalThis.openNativePanel = true;
    },
    path ? dirname(path) : undefined,
  );
  await button(teacher, level?"Mystery als Niveau importieren":"Importieren").click();
  const attached = () => app.evaluate(() => globalThis.importSheet);
  await expect.poll(attached, { timeout: 10000 }).toBe(true);

  execFileSync("swift", [
    "qa/studio/picker-028.swift",
    path ? "choose" : "cancel",
    join(out, level?"Niveaudatei-macOS.png":"Dateiauswahl-macOS.png"),
    level?"Fachniveau":"Wasser",
  ]);
  await expect.poll(attached, { timeout: 15000 }).toBe(false);
  await app.evaluate(() => {
    globalThis.openNativePanel = false;
  });
}
async function closeTeacher() {
  if (app) {
    await app.close();
    app = null;
  } else await teacher.close();
}
const board = () => teacher.locator(".studio-board [data-card]");
async function openDesign() {
  await button(teacher, "Mystery gestalten").click();
}
async function levels() {
  await openDesign();
  await button(teacher, "Niveaus verwalten").click();
}
async function apply() {
  await button(teacher, "Niveau bearbeiten").click();
}
async function add(title, body, editable, image = false) {
  await button(teacher, "Karte hinzufügen").click();
  const dialog = teacher.getByRole("dialog");
  await dialog.getByLabel("Kartenüberschrift").fill(title);
  await dialog.getByLabel("Kartentext", { exact: true }).fill(body);
  if (editable) await dialog.getByLabel(permission).check();
  if (image)
    await dialog
      .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
      .setInputFiles(resolve("tests/fixtures/document-import/bild-1.png"));
  await button(dialog, "Karte übernehmen").click();
}
async function teacherWorkflow() {
  await start();
  await button(teacher, "Unterrichtsmaterial importieren").click();
  await teacher.getByLabel("Lehrkraftkürzel").fill("QA");
  await button(teacher, "Mystery erstellen").click();
  await button(teacher, "Abbrechen").click();
  if (native) await nativePick(null);
  else await pick(null);
  await expect(button(teacher, "Importieren")).toBeEnabled();
  await writeFile(join(out, "Defekt.png"), "Fehler");
  await pick(join(out, "Defekt.png"));
  await expect(teacher.getByRole("alert")).toBeVisible();
  if (native) {
    const dir = await app.evaluate(({app}) => app.getPath("downloads"));
    await mkdir(dir, { recursive: true });
    const selected = join(dir, "Wasser.docx");
    await copyFile(join(out, "Wasser.docx"), selected, 1); // COPYFILE_EXCL on the ephemeral runner
    await nativePick(selected);
  } else await pick(join(out, "Wasser.docx"));
  await expect(button(teacher, "Weiter zur Übernahme")).toBeVisible({
    timeout: 60000,
  });
  await teacher.screenshot({ path: join(out, "Import-028.png") });
  await button(teacher, "Weiter zur Übernahme").click();
  await teacher.getByLabel(/Ich habe Texte/).check();
  await button(teacher, "Karten übernehmen").click();
  await expect(board()).toHaveCount(2);
  await teacher
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Wasser Basis");
  await openDesign();
  await button(teacher, "Bearbeitungsfreigabe").click();
  await button(
    teacher,
    "Alle Karten für Lernende bearbeitbar machen (2 Änderungen)",
  ).click();
  await button(teacher, "Zur Pinnwand").click();
  await levels();
  await teacher.getByLabel("Projekttitel").fill("Wohin fließt der Regen?");
  await button(teacher,"Niveauoptionen").click();
  await teacher.getByLabel("Niveaubezeichnung").fill(names[0]);
  await apply();
  await levels();
  await button(teacher, "Niveau duplizieren").click();
  await teacher.getByLabel("Niveaubezeichnung").fill(names[1]);
  await apply();
  await teacher
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Wasser Wege");
  await add("Ein Gully", "Folgt dem Regenwasser vom Schulhof zum Bach.", false);
  await levels();
  await button(teacher, "Niveau hinzufügen").click();
  await teacher.getByLabel("Niveaubezeichnung").fill(names[2]);
  await apply();
  await teacher
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Wasser Bilanz");
  for (const [i, t] of [
    "Niederschlag",
    "Versickerung",
    "Abfluss",
    "Vergleich",
  ].entries())
    await add(
      t,
      [
        "Eine Messreihe erfasst Regen über eine Stunde.",
        "Ein Bodenprofil zeigt luftgefüllte Poren.",
        "Der Pegel steigt zeitversetzt.",
        "Begründet den Unterschied zwischen den Standorten.",
      ][i],
      i === 0,
      i === 1,
    );
  await openDesign();
  await teacher.getByText("Gestaltung",{exact:true}).click();
  await button(teacher,"Darstellung").click();
  await teacher.getByLabel("Gestaltungsvorlage").selectOption("contrast");
  await teacher.screenshot({ path: join(out, "Gestaltung-028.png") });
  await button(teacher, "Zur Pinnwand").click();
  const advanced = JSON.parse(
    await readFile(
      "qa/studio/evidence/player-021/Autor-mit-Pfeilen.mysteryboard",
      "utf8",
    ),
  );
  advanced.content.title = "Wasser im Einzugsgebiet";
  advanced.content.help = {
    method: "Prüft Gegenhypothesen und begründet Kausalbeziehungen.",
  };
  advanced.content.recovery = "session";
  advanced.content.cards.forEach((card, i) => {
    card.title = [
      "Messstation",
      "Bodenprobe",
      "Versiegelung",
      "Abflussganglinie",
      "Modellgrenzen",
    ][i];
    card.text = [
      "Zwei Stationen messen stündlich den Pegel.",
      "Vergleicht Infiltration bei feuchtem und trockenem Boden.",
      "Bestimmt den Anteil versiegelter Fläche.",
      "Erklärt Verzögerung und Höhe des Scheitelabflusses.",
      "Prüft, ob die Daten alternative Deutungen zulassen.",
    ][i];
    if (i < 2) card.studentEditable = true;
  });
  advanced.contentHash = hash(advanced.content);
  // Keep screencapture output outside the displayed directory. NSOpenPanel may
  // reorder its rows by date added between recognition and the actual click.
  const selectionDirectory = join(out, "Niveauimport");
  await mkdir(selectionDirectory, { recursive: true });
  const path = join(selectionDirectory, "Fachniveau.mysteryboard");
  await writeFile(path, JSON.stringify(advanced));
  await levels();
  if(native){
    await nativePick(null,true);
    await nativePick(path,true);
  } else {
    material=path;
    await button(teacher,"Mystery als Niveau importieren").click();
  }
  await expect(teacher.getByLabel("Niveaubezeichnung")).toHaveValue(
    advanced.content.title,
  );
  await teacher.getByLabel("Niveaubezeichnung").fill(names[3]);
  await teacher.screenshot({ path: join(out, "Niveauverwaltung-028.png") });
  await apply();
  await expect(board()).toHaveCount(5);
  await openDesign();
  await teacher.getByText("Speicheroptionen",{exact:true}).click();
  await teacher
    .getByLabel("Zwischensicherung für dieses Niveau")
    .selectOption("extended");
  await expect(teacher.getByText(/Nur mit schulischer Freigabe/)).toBeVisible();
  await button(teacher, "Zur Pinnwand").click();
  await openExports(teacher);
  await target(project);
  await saveProject(teacher);
  const saved = JSON.parse(await readFile(project, "utf8"));
  assert.deepEqual(
    saved.levels.map((l) => l.name),
    names,
  );
  assert.deepEqual(
    saved.levels.map((l) => l.draft.content.cards.length),
    [2, 3, 4, 5],
  );
  await closeTeacher();
  await start();
  openPath = project;
  if (app)
    await app.evaluate((_, v) => {
      globalThis.project = v;
    }, project);
  await button(teacher, "Mystery öffnen").click();
  await expect(board()).toHaveCount(5);
  await openExports(teacher);
  const checkbox = teacher.getByRole("checkbox");
  if (await checkbox.count()) await checkbox.check();
  await target(join(out, "Einzeln.zip"));
  await button(teacher, "Für itslearning exportieren").click();
  await expect
    .poll(async () =>
      readFile(savePath).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true);
  await openExports(teacher);
  await target(scorm);
  await button(teacher, "Alle Niveaus für itslearning exportieren").click();
  await expect
    .poll(async () =>
      readFile(scorm).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true);
  const bytes = unzipSync(await readFile(scorm));
  assert.equal(Object.keys(bytes).length, 8);
  await mkdir(join(out, "sco"), { recursive: true });
  for (const [name, value] of Object.entries(bytes)) {
    assert(!name.includes("/"));
    await writeFile(join(out, "sco", name), value);
  }
  // Exercise the shared import path inside one populated level, leaving
  // the already exported classroom example intact.
  const [large] = await fixtures(join(out, "material"), [60]);
  await closeExports(teacher);
  await teacher
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Ungesicherte Teständerung");
  await pick(large.path);
  await expect(board()).toHaveCount(60);
  await expect(teacher.locator(".studio-unsaved")).toBeVisible();
  await pick(join(out, "Wasser.docx"));
  await expect(button(teacher, "Weiter zur Übernahme")).toBeVisible();
  await button(teacher, "Zur Pinnwand").click();
  await expect(board()).toHaveCount(60);
  const data = [...(await readFile(join(out, "Wasser.docx")))];
  await teacher.locator("main.author-editor").evaluate((el, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(bytes)], "Wasser.docx"));
    el.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, data);
  await expect(button(teacher, "Weiter zur Übernahme")).toBeVisible();
  await button(teacher, "Weiter zur Übernahme").click();
  await teacher.getByLabel("Karten zu diesem Mystery hinzufügen").check();
  await teacher.getByLabel(/Ich habe Texte/).check();
  await button(teacher, "Karten übernehmen").click();
  await expect(board()).toHaveCount(62);
  const checkPath = join(out, "material", "Kontrollsammlung.mysteryboard");
  await target(checkPath);
  await saveProject(teacher, true);
  const checked = JSON.parse(await readFile(checkPath));
  assert.deepEqual(checked.levels.slice(0, 3), saved.levels.slice(0, 3));
  assert.equal(
    checked.levels[3].draft.content.id,
    saved.levels[3].draft.content.id,
  );
  const chooserCalls = app ? undefined : calls;
  await saveJSON("Studio-028.json", {
    installed: native,
    version: (process.env.STUDIO_VERSION || "0.2.9"),
    levels: names,
    chooserCalls,
    teacherWorkflow: true,
    populatedLevelImport: {
      before: 60,
      afterDrop: 62,
      otherLevelsUnchanged: true,
    },
    selector: native
      ? "NSOpenPanel, Quartz, Abbruch und Dateiauswahl"
      : "Browser-Testbrücke",
  });
  await closeTeacher();
  return saved;
}
async function learner(engine, name, saved) {
  const results = {
    engine: engine.version(),
    levels: [],
    moves: 0,
    external: [],
    recoveryMs: [],
    nativeExport: native,
  };
  const context = await engine.newContext({
    viewport:
      name === "Chromium"
        ? { width: 1024, height: 768 }
        : { width: 768, height: 1024 },
    hasTouch: true,
    acceptDownloads: true,
  });
  await context.route(/^https?:/, (route) => {
    const url = route.request().url();
    if (url.startsWith(server.origin + "/")) return route.continue();
    results.external.push(url);
    return route.abort();
  });
  const url = server.origin + "/qa-evidence/sco/launch.html";
  for (const [index, l] of saved.levels.entries()) {
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept().catch(() => {}));
    const fetched = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".json")) fetched.push(r.url());
    });
    await page.goto(url);
    const ui = page.frameLocator("iframe");
    const card = (id) => ui.locator('[data-card="' + id + '"]');
    await expect(button(ui, l.name)).toBeVisible();
    assert.equal(fetched.length, 0);
    if (index === 0)
      await page.screenshot({ path: join(out, name + "-Niveauauswahl.png") });
    await button(ui, l.name).click();
    await ui.getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/).fill("Gruppe 3");
    await button(ui, "Beginnen").click();
    await expect(ui.locator("[data-card]")).toHaveCount(
      l.draft.content.cards.length,
    );
    assert.equal(fetched.length, 1);
    for (let i = 0; i < (index === 0 ? 100 : 1); i++) {
      const move = await releaseOnly(ui, 1, {
        dx: i % 2 === 0 ? 21 : -21,
        dy: 1,
        type: "touch",
      });
      assert.deepEqual(
        move.actual,
        move.target.map((v) => (v === 0 ? 0 : v)),
      );
      results.moves++;
    }
    const pos = await cardPosition(ui, 1);
    await page.reload();
    await expect(card(1)).toBeVisible();
    assert.deepEqual(await cardPosition(ui, 1), pos);
    await card(1).press("Enter");
    await button(ui, "Blau").click();
    await ui.getByLabel("Name für diese Farbe").fill("Wasserweg");
    await button(ui, "Schließen").click();
    await card(1).press("Enter");
    await button(ui, "Mit einer Karte verbinden").click();
    await card(2).press("Enter");
    await ui.getByLabel(/Beschriftung/).fill("erklärt Abfluss");
    await button(ui, "Übernehmen").click();
    const text =
      "Unsere Begründung zu " + l.name + " mit ΔP und zwei Beobachtungen.";
    await card(1).press("Enter");
    await button(ui, "Text bearbeiten").click();
    await ui.getByLabel("Kartentext", { exact: true }).fill(text);
    await page.reload();
    await expect(ui.getByLabel("Kartentext", { exact: true })).toHaveValue(
      text,
    );
    await button(ui, "Änderungen übernehmen").click();
    const frame = page.frames().find((f) => f.url().endsWith("/app.html"));
    await frame.evaluate(() => location.reload()).catch(() => {});
    await expect(card(1)).toContainText("Unsere Begründung");
    await expect(ui.getByRole("dialog")).toBeVisible();
    await button(ui, "Text bearbeiten").click();
    await ui
      .getByLabel("Kartentext", { exact: true })
      .fill(text + " Zweiter Befund.");
    await button(ui, "Änderungen übernehmen").click();
    await button(ui, "Schließen").click();
    await button(ui, "Rückgängig").click();
    await button(ui, "Wiederholen").click();
    const t = Date.now();
    await page.reload();
    await expect(card(1)).toBeVisible();
    results.recoveryMs.push(Date.now() - t);
    assert.deepEqual(await cardPosition(ui, 1), pos);
    await expect(ui.locator(".recovery-status")).toContainText(
      "Automatisch gespeichert",
    );
    if (index === 0)
      await page.screenshot({
        path: join(out, name + "-Wiederhergestellt.png"),
      });
    await button(ui, "Export").click();
    const download = ui.getByRole("link", {
      name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/,
    });
    await expect(download).toBeVisible({ timeout: 60000 });
    const filename = "Gruppe 3_" + l.draft.content.title + ".png";
    await expect(download).toHaveAttribute("download", filename);
    if (index === 0)
      await page.screenshot({ path: join(out, name + "-Export.png") });
    const wait = page.waitForEvent("download");
    await download.click();
    const downloaded = await wait;
    assert(
      [filename, filename.replaceAll(" ", "_")].includes(
        downloaded.suggestedFilename(),
      ),
    );
    const png = join(out, (name === "WebKit" ? "WebKit-" : "") + filename);
    await downloaded.saveAs(png);
    const decoded = join(out, name + "-" + index + "-decoded.json");
    execFileSync("python3", ["qa/touch-saving/verify-png.py", png, decoded]);
    const doc = JSON.parse(await readFile(decoded));
    assert.equal(doc.work.team, "Gruppe 3");
    assert.equal(doc.content.id, saved.id + "." + l.id);
    assert.equal(
      doc.work.textEdits.find((e) => e.id === 1).text,
      text + " Zweiter Befund.",
    );
    assert(doc.work.categories.includes("Wasserweg"));
    assert(doc.work.edges.some((e) => e.label === "erklärt Abfluss"));
    const fresh = await engine.newPage({
      viewport: { width: 1024, height: 768 },
    });
    await fresh.goto(url);
    const freshUI = fresh.frameLocator("iframe");
    await freshUI.getByLabel("Original-PNG öffnen").setInputFiles(png);
    await expect(freshUI.locator("[data-card]")).toHaveCount(
      doc.work.cards.length,
    );
    assert.deepEqual(await cardPosition(freshUI, 1), pos);
    await button(freshUI, "Export").click();
    const reexport = freshUI.getByRole("link", {
      name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/,
    });
    await expect(reexport).toBeVisible({ timeout: 60000 });
    const w = fresh.waitForEvent("download");
    await reexport.click();
    await (await w).saveAs(join(out, "roundtrip.png"));
    execFileSync("python3", [
      "qa/touch-saving/verify-png.py",
      join(out, "roundtrip.png"),
      join(out, "roundtrip.json"),
    ]);
    assert.deepEqual(
      JSON.parse(await readFile(join(out, "roundtrip.json"))),
      doc,
    );
    await fresh.close();
    await page.close();
    if (l.draft.content.recovery === "extended") {
      const reopened = await context.newPage();
      await reopened.goto(url);
      const view = reopened.frameLocator("iframe");
      await expect(view.locator("[data-card]")).toHaveCount(0);
      await view.getByRole("button", { name: /Gruppe 3 · AHR/ }).click();
      await expect(view.locator("[data-card]")).toHaveCount(5);
      await reopened.close();
    }
    results.levels.push({
      name: l.name,
      count: doc.work.cards.length,
      filename,
      hash: doc.contentHash,
    });
  }
  assert.deepEqual(results.external, []);
  await context.close();
  await saveJSON(name + "-028.json", { ...results, passed: true });
}
try {
  const saved = await teacherWorkflow();
  await learner(b, "Chromium", saved);
  const wk = await webkit.launch({
    executablePath: process.env.WEBKIT_PATH || undefined,
  });
  try {
    await learner(wk, "WebKit", saved);
  } finally {
    await wk.close();
  }
} catch (e) {
  console.error(e);
  if (teacher && !teacher.isClosed()) {
    await teacher.screenshot({ path: join(out, "Fehler.png"), timeout:5000 }).catch(() => {});
    console.error(
      (
        await teacher
          .locator("body")
          .innerText({timeout:3000})
          .catch(() => "")
      ).slice(-2300),
    );
  }
  if(app){app.process().kill("SIGKILL");app=null;}
  throw e;
} finally {
  await app?.close().catch(() => {});
  await b.close();
  server.close();
}
