import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { chromium, _electron, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { templateText } from "../../studio/exchange/template.ts";
import { host } from "./web-host.mjs";
import { button, openExports, closeExports, saveProject } from "./controls.mjs";
import { releaseOnly, cardPosition } from "./student-release.mjs";

const out = resolve(process.argv[2]),
  native = !!process.env.STUDIO_EXEC;
await mkdir(out, { recursive: true });
const server = await host(out),
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
let app,
  page,
  target,
  input,
  actions = [],
  activeLog,
  external = [];
const file = (n) => join(out, n);
const json = async (n) => JSON.parse(await readFile(file(n), "utf8"));
async function start() {
  if (native) {
    app = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + file("profile")],
    });
    const info = await app.evaluate(({ app, dialog }) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: globalThis.destination,
      });
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [globalThis.source],
      });
      return [app.isPackaged, process.arch, app.getVersion()];
    });
    assert.deepEqual(info, [true, "arm64", "0.3.0"]);
    page = await app.firstWindow();
  } else {
    page = await browser.newPage();
    await page.exposeFunction("choose", async () => ({
      name: basename(input),
      bytes: [...(await readFile(input))],
    }));
    await page.exposeFunction("write", async (b) => {
      await writeFile(target, Buffer.from(b));
      return { name: basename(target) };
    });
    await page.exposeFunction("blank", async () => {
      await writeFile(target, templateText());
      return true;
    });
    await page.addInitScript(() => {
      window.mysteryStudio = {
        saveTemplate: window.blank,
        openProject: async () => {
          const f = await window.choose();
          return { ...f, bytes: Uint8Array.from(f.bytes) };
        },
        saveProject: (b) => window.write([...b]),
        saveExport: (b) => window.write([...b]),
        recentProjects: async () => [],
        projectState: async () => {},
        detachProject: async () => {},
        onSaved: () => {},
      };
    });
    await page.goto(server.origin + "/studio/dist/studio/index.html");
  }
  page.on("dialog", (d) => d.accept().catch(() => {}));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(server.origin + "/"))
      external.push(r.url());
  });
  await page.exposeFunction("recordAction", (label) => {
    if (activeLog) activeLog.push(label);
  });
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest("button,summary");
        if (el)
          window.recordAction(
            (el.getAttribute("aria-label") || el.textContent).trim(),
          );
      },
      true,
    );
    document.addEventListener(
      "change",
      (e) => {
        if (e.target.labels)
          window.recordAction(
            e.target.labels[0]?.innerText ||
              e.target.getAttribute("aria-label") ||
              e.target.tagName,
          );
      },
      true,
    );
  });
}
async function stop() {
  if (app) {
    await app.close();
    app = null;
  } else await page.close();
}
async function dest(name) {
  target = file(name);
  if (app) await app.evaluate((_, v) => (globalThis.destination = v), target);
}
async function source(name) {
  input = file(name);
  if (app) await app.evaluate((_, v) => (globalThis.source = v), input);
}
const click = (n) => button(page, n).click();
const snap = (n) => page.screenshot({ path: file(n + ".png") });
async function saved(name) {
  await expect
    .poll(async () =>
      stat(file(name)).then(
        (f) => f.size,
        () => 0,
      ),
    )
    .toBeGreaterThan(0);
}
async function save(name) {
  await dest(name);
  await saveProject(page);
  await saved(name);
}
async function exportZip(name, label) {
  await openExports(page);
  await dest(name);
  await click(label);
  await saved(name);
  await closeExports(page);
}
async function paste(text) {
  await click("KI-Text einfügen");
  await page.getByLabel("JSON aus dem KI-Chat").fill(text);
  await click("Material prüfen");
}
async function reviewCollection() {
  const d = page.getByRole("dialog", { name: "KI-Material prüfen" });
  await expect(d.locator("li")).toHaveCount(4);
  await expect(button(d, "Als Projekt übernehmen")).toBeDisabled();
  await snap("KI-Importpruefung");
  await d.getByRole("checkbox").check();
  await click("Als Projekt übernehmen");
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(3);
}
async function compareConfiguration() {
  // Both paths begin with the same authored source material and end at the same four-level SCORM.
  await start();
  const names = ["Basis", "Aufbau", "Transfer", "Forschung"];
  const original = (await json("KI-Einzel-Austausch.mysteryboard")).project
    .content;
  const title = "Vergleich der Gefäße";
  const levels = names.map((name) => ({
    name,
    content: { ...original, title: "Gefäße " + name },
  }));
  const input = {
    format: "MysteryBoardAI",
    formatVersion: 1,
    kind: "project",
    project: { kind: "collection", title, defaultRecovery: "session", levels },
  };
  await writeFile(
    file("Vergleich-Austausch.mysteryboard"),
    JSON.stringify(input),
  );
  const logs = { manual: [], exchange: [] };
  const manage = async () => {
    await click("Mystery gestalten");
    await click("Niveaus verwalten");
  };
  activeLog = logs.manual;
  await source("KI-Einzel.mysteryboard");
  await click("Mystery öffnen");
  for (const [i, name] of names.entries()) {
    await manage();
    if (i === 0) {
      await page.getByLabel("Projekttitel").fill(title);
      await click("Niveauoptionen");
    } else await click("Niveau duplizieren");
    await page.getByLabel("Niveaubezeichnung").fill(name);
    await click("Niveau bearbeiten");
    await page
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Gefäße " + name);
  }
  await exportZip(
    "Vergleich-Manuell.zip",
    "Alle Niveaus für itslearning exportieren",
  );
  activeLog = null;
  await save("Vergleich-Manuell.mysteryboard");
  await click("Zur Projektübersicht");
  activeLog = logs.exchange;
  await source("Vergleich-Austausch.mysteryboard");
  await click("Mystery öffnen");
  await click("Als Projekt übernehmen");
  await exportZip(
    "Vergleich-Austausch.zip",
    "Alle Niveaus für itslearning exportieren",
  );
  activeLog = null;
  const project = await json("Vergleich-Manuell.mysteryboard");
  for (const [i, l] of project.levels.entries()) {
    assert.equal(l.name, names[i]);
    assert.equal(l.draft.content.title, levels[i].content.title);
  }
  const contents = async (name) =>
    Object.entries(unzipSync(await readFile(file(name))))
      .filter(([key]) => key.startsWith("level-"))
      .map(([, b]) => {
        const { id, version, ...c } = JSON.parse(Buffer.from(b)).content;
        return c;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  assert.deepEqual(
    await contents("Vergleich-Manuell.zip"),
    await contents("Vergleich-Austausch.zip"),
  );
  assert(logs.manual.length > logs.exchange.length);
  await save("Vergleich-Importiert.mysteryboard");
  // Deliberate validation probes are outside both action counts.
  await manage();await click("Niveauoptionen");
  await page.getByLabel("Niveaubezeichnung").fill(names[1]);
  await expect(page.getByRole("alert")).toContainText("Mehrere Niveaus heißen gleich");
  await page.getByLabel("Niveaubezeichnung").fill(names[0]);await click("Niveau bearbeiten");
  await saveProject(page);await stop();
  return logs;
}
async function run() {
  await start();
  await snap("KI-Projektuebersicht");
  for (const ext of ["mysteryboard", "txt"]) {
    const n = "MysteryBoard-KI-Vorlage." + ext;
    await dest(n);
    await click("KI-Blankovorlage exportieren");
    await click(
      ext === "txt" ? "TXT-Alternative speichern" : "Blankovorlage speichern",
    );
    await saved(n);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  assert.deepEqual(
    await readFile(file("MysteryBoard-KI-Vorlage.txt")),
    await readFile(file("MysteryBoard-KI-Vorlage.mysteryboard")),
  );
  assert.equal((await json("MysteryBoard-KI-Vorlage.txt")).kind, "template");
  execFileSync("python3", ["qa/studio/exchange-fixtures-030.py", out]);
  const single = "KI-Einzel-Austausch.mysteryboard",
    multi = "KI-Niveaus-Austausch.mysteryboard";
  await paste("{");
  await expect(page.getByRole("alert")).toContainText("JSON");
  await page
    .getByLabel("JSON aus dem KI-Chat")
    .fill(await readFile(file(single), "utf8"));
  await click("Material prüfen");
  await expect(
    page.getByRole("dialog", { name: "KI-Material prüfen" }),
  ).toContainText("3 Karten");
  await click("Als Projekt übernehmen");
  await save("KI-Einzel.mysteryboard");
  await exportZip("KI-Einzel-SCORM.zip", "Für itslearning exportieren");
  // The regular save target and prior project must survive a cancelled import.
  if (native) {
    const bounds=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];const dimensions=w.getBounds();w.setContentSize(800,600);return dimensions;});
    const longTitle="Warum erwärmen sich zwei zunächst gleich temperierte Gefäße am selben Standort unterschiedlich?";
    const input=page.getByLabel("Mystery-Titel",{exact:true});
    await input.fill(longTitle);await input.focus();
    const full=page.locator(".studio-full-title");await expect(full).toBeVisible();await expect(full).toHaveText(longTitle);
    assert(await full.evaluate(el=>el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth+1));
    await snap("KI-Langer-Titel");await app.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows()[0].setBounds(b),bounds);
    await input.fill("Entwurf vor Import");
    await source(multi);
    await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().getMenuItemById("project-open").click(),
    );
    await expect(
      page.getByRole("dialog", { name: "KI-Material prüfen" }),
    ).toBeVisible();
    await click("Abbrechen");
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Entwurf vor Import",
    );
    await page
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Gefäße im Schatten");
    await saveProject(page);
    assert.equal(
      (await json("KI-Einzel.mysteryboard")).content.title,
      "Gefäße im Schatten",
    );
  }
  await click("Zur Projektübersicht");
  activeLog = actions;
  await source(multi);
  await click("Mystery öffnen");
  await reviewCollection();
  activeLog = null;
  await save("KI-Niveaus.mysteryboard");
  await stop();
  await start();
  await source("KI-Niveaus.mysteryboard");
  await click("Mystery öffnen");
  const c = await json("KI-Niveaus.mysteryboard"),
    raw = (await json(multi)).project;
  for (const [i, l] of c.levels.entries()) {
    assert.equal(l.name, raw.levels[i].name);
    assert.deepEqual(l.draft.content.cards, raw.levels[i].content.cards);
    assert.deepEqual(l.draft.content.help, raw.levels[i].content.help);
    assert.deepEqual(
      l.draft.author.edges ?? [],
      raw.levels[i].author?.edges ?? [],
    );
    assert.deepEqual(
      l.draft.content.initial.edges,
      raw.levels[i].studentHints ?? [],
    );
    assert.equal(
      l.draft.content.recovery,
      raw.levels[i].content.recovery ?? raw.defaultRecovery,
    );
  }
  await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    c.levels[0].draft.content.title,
  );
  if (native) {
    await openExports(page);
    const opened = app.waitForEvent("window");
    await click("Schüleransicht prüfen");
    const preview = await opened;
    await expect(
      preview.getByLabel("Gruppenname", { exact: true }),
    ).toBeVisible();
    await preview.close();
    await closeExports(page);
  }
  activeLog = actions;
  await exportZip(
    "KI-Niveaus-SCORM.zip",
    "Alle Niveaus für itslearning exportieren",
  );
  activeLog = null;
  await snap("KI-Pinnwand");
  await stop();
  const comparison = await compareConfiguration();
  const files = unzipSync(await readFile(file("KI-Niveaus-SCORM.zip")));
  await mkdir(file("scorm"), { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    assert(!name.includes("/"));
    assert(!Buffer.from(bytes).includes(Buffer.from("Privatbefund-QA")));
    await writeFile(file("scorm/" + name), bytes);
  }
  const players = [];
  for (const [i, l] of c.levels.entries()) {
    const task = JSON.parse(Buffer.from(files["level-" + l.id + ".json"]));
    assert.deepEqual(task.content.cards, l.draft.content.cards);
    assert.deepEqual(task.content.help, l.draft.content.help);
    const p = await browser.newPage();
    p.on("dialog", (d) => d.accept().catch(() => {}));
    p.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(server.origin + "/"))
        external.push(r.url());
    });
    await p.goto(server.origin + "/qa-evidence/scorm/launch.html");
    const u = p.frameLocator("iframe"),
      b = (n) => button(u, n),
      card = (id) => u.locator('[data-card="' + id + '"]');
    await u.getByRole("button", { name: new RegExp("^" + l.name) }).click();
    await u.getByLabel("Gruppenname", { exact: true }).fill("Team Ufer");
    await b("Beginnen").click();
    await expect(card(1)).toBeVisible();
    await card(1).press("Enter");
    await expect(b("Text bearbeiten")).toHaveCount(0);
    await b("Schließen").click();
    const move = await releaseOnly(u, 1, { dx: 27, dy: 13, type: "touch" });
    assert.deepEqual(move.actual, move.target);
    await card(1).press("Enter");
    await b("Mit einer Karte verbinden").click();
    await card(3).press("Enter");
    await u.getByLabel(/Beschriftung/).fill("unser Vergleich");
    await b("Übernehmen").click();
    await card(3).press("Enter");
    await b("Text bearbeiten").click();
    await u
      .getByLabel("Kartentext", { exact: true })
      .fill("Unsere Erklärung zur Messung");
    await b("Änderungen übernehmen").click();
    await b("Schließen").click();
    await b("Hilfe").click();
    await expect(u.getByRole("dialog")).toBeVisible();
    if (task.content.help?.method)
      await expect(u.getByRole("dialog")).toContainText(
        task.content.help.method,
      );
    if (task.content.help?.categories) {
      await b("Weitere Hilfe anzeigen").click();
      await expect(u.getByRole("dialog")).toContainText("Beobachten");
    }
    await b("Hilfe schließen").click();
    const pos = await cardPosition(u, 1);
    if (i > 0) {
      await p.reload();
      await expect(card(3)).toContainText("Unsere Erklärung");
      assert.deepEqual(await cardPosition(u, 1), pos);
    }
    await b("Export").click();
    const link = u.getByRole("link", { name: "PNG herunterladen" });
    await expect(link).toBeVisible({ timeout: 60000 });
    const name = "Team Ufer_" + task.content.title + ".png";
    await expect(link).toHaveAttribute("download", name);
    const pending = p.waitForEvent("download");
    await link.click();
    await (await pending).saveAs(file(name));
    const decode = (dest) => {
      execFileSync("python3", [
        "qa/touch-saving/verify-png.py",
        file(name),
        file(dest),
      ]);
      return json(dest);
    };
    const d = await decode("PNG-Inhalt.json");
    assert.equal(d.work.team, "Team Ufer");
    assert.equal(d.work.textEdits[0].text, "Unsere Erklärung zur Messung");
    assert(d.work.edges.some((e) => e.label === "unser Vergleich"));
    if (i === 0) {
      await b("Schließen").click();
      await card(3).press("Enter");
      await b("Text bearbeiten").click();
      await u
        .getByLabel("Kartentext", { exact: true })
        .fill("Neuere Arbeit ohne Speicherung");
      await b("Änderungen übernehmen").click();
      await b("Schließen").click();
      const pick = async () => {
        await b("Menü").click();
        await b("Original-PNG öffnen").click();
        await u.getByLabel("Schüler-Sicherung").setInputFiles(file(name));
      };
      await pick();
      await b("Bisherige Arbeit behalten").click();
      await expect(card(3)).toContainText("Neuere Arbeit");
      await pick();
      await b("Ausgewählte PNG öffnen").click();
      await expect(card(3)).toContainText("Unsere Erklärung");
      const f = p.frames().find((f) => f.url().endsWith("/app.html"));
      assert.deepEqual(
        await f.evaluate(() =>
          Object.keys(sessionStorage).filter((k) =>
            k.startsWith("mysteryboard.028."),
          ),
        ),
        [],
      );
      await p.reload();
      await expect(u.getByRole("button", { name: /^Entdecken/ })).toBeVisible();
      await expect(card(1)).toHaveCount(0);
    }
    const fresh = await browser.newPage();
    await fresh.goto(server.origin + "/qa-evidence/scorm/launch.html");
    const v = fresh.frameLocator("iframe");
    await v.getByLabel("Original-PNG öffnen").setInputFiles(file(name));
    await expect(v.locator('[data-card="3"]')).toContainText(
      "Unsere Erklärung",
    );
    assert.deepEqual(await cardPosition(v, 1), pos);
    await button(v, "Menü").click();
    await button(v, "Original-PNG öffnen").click();
    await v.getByLabel("Schüler-Sicherung").setInputFiles(file(name));
    await expect(v.getByRole("dialog")).toHaveCount(0);
    players.push({
      name: l.name,
      mode: task.content.recovery,
      hash: task.contentHash,
      png: name,
    });
    await fresh.close();
    await p.close();
  }
  assert.deepEqual(external, []);
  await writeFile(
    file("Austausch-Pruefung.json"),
    JSON.stringify(
      {
        version: "0.3.0",
        installedAppleSilicon: native,
        players,
        comparison,
        external,
        importAndExportActions: actions,
        remainingManualConfiguration: 0,
      },
      null,
      2,
    ),
  );
}
try {
  await run();
} finally {
  if (app) await app.close();
  await browser.close();
  server.close();
}
