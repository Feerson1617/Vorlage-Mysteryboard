import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { _electron, chromium, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
import { button } from "./controls.mjs";

const [phase, dir, reference, material] = process.argv.slice(2);
const before = phase === "before",
  out = resolve(dir),
  native = !!process.env.STUDIO_EXEC;
await mkdir(out, { recursive: true });
const server = await host(out);
let app, browser, page;
const target = join(out, "Probe.zip");
const project = JSON.parse(await readFile(reference));
const measurements = {
  phase,
  environment: native
    ? "installierte Apple-Silicon-App"
    : "gebaute Browseroberfläche",
  scenarios: {},
  screens: [],
};
let actions = [],
  scenario;
function begin(key) {
  console.log(phase, measurements.environment, "Szenario", key);
  scenario = measurements.scenarios[key] = {
    actions: [],
    dialogs: 0,
    settings: 0,
    maximumDepth: 0,
  };
  actions = scenario.actions;
}
async function action(
  label,
  operation,
  { dialog = false, setting = false, depth = 0 } = {},
) {
  console.log(phase, label);
  await operation();
  actions.push(label);
  scenario.dialogs += Number(dialog);
  scenario.settings += Number(setting);
  scenario.maximumDepth = Math.max(depth, scenario.maximumDepth);
}
const click = (name, options) =>
  action(name, () => button(page, name).click(), options);
const text = (name, options) =>
  action(name, () => page.getByText(name, { exact: true }).click(), options);
const input = (label, value, options) =>
  action(
    label,
    () => page.getByLabel(label, { exact: true }).fill(value),
    options,
  );
const setting = { setting: true };
const dialog = { dialog: true, depth: 1 };
const manage = async () => {
  await click("Mystery gestalten");
  await click("Niveaus verwalten", { dialog: true, depth: 2 });
};
const apply = () => click("Niveau bearbeiten");
async function inspect(name) {
  for (const [w, h] of [
    [1024, 645],
    [1280, 800],
    [1440, 900],
    [1567, 959],
  ]) {
    if (app)
      await app.evaluate(
        ({ BrowserWindow }, [w, h]) => {
          const win = BrowserWindow.getAllWindows()[0];
          win.setContentSize(w, h, false);
        },
        [w, h],
      );
    else await page.setViewportSize({ width: w, height: h });
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const metric = await page.evaluate(() => {
      const box = (e) => {
        if (!e) return null;
        const { x, y, width, height } = e.getBoundingClientRect();
        return { x, y, width, height };
      };
      const buttons = [...document.querySelectorAll("button")].filter(
        (e) =>
          e.checkVisibility() &&
          e.offsetHeight &&
          !e.closest("details:not([open])"),
      );
      const toolbar = document.querySelector(".studio-main-toolbar nav");
      return {
        actual: [innerWidth, innerHeight],
        board: box(document.querySelector(".studio-board svg.board")),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        toolbar: toolbar
          ? [...toolbar.querySelectorAll("button")]
              .filter((e) => e.offsetWidth)
              .map((e) => ({ name: e.textContent.trim(), box: box(e) }))
          : [],
        options: buttons.map((e) =>
          (e.getAttribute("aria-label") || e.textContent).trim(),
        ),
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    assert.equal(metric.horizontalOverflow, false);
    const file =
      name + "-" + w + "x" + h + "-" + metric.actual.join("x") + ".png";
    await page.screenshot({ path: join(out, file) });
    measurements.screens.push({
      scene: name,
      requested: [w, h],
      ...metric,
      exact: w === metric.actual[0] && h === metric.actual[1],
      file,
    });
  }
}
try {
  if (native) {
    app = await _electron.launch({
      executablePath: process.env.STUDIO_EXEC,
      args: ["--user-data-dir=" + join(out, "profile")],
    });
    const info = await app.evaluate(
      ({ app, dialog }, paths) => {
        // The functional close/cancel tests run separately. Only the synthetic UX
        // projects are discarded when the measurement window closes or is replaced.
        dialog.showMessageBox = async (_win, opts) => {
          const discard = opts.buttons?.indexOf("Änderungen verwerfen") ?? -1;
          if (discard < 0)
            throw Error("Unerwarteter nativer Dialog: " + opts.message);
          return { response: discard, checkboxChecked: false };
        };
        dialog.showOpenDialog = async (_w, o) => ({
          canceled: false,
          filePaths: [
            o.title === "Unterrichtsmaterial auswählen" ? paths[1] : paths[0],
          ],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths[2],
        });
        return [app.isPackaged, app.getVersion(), process.arch];
      },
      [resolve(reference), resolve(material), target],
    );
    assert.deepEqual(info, [true, before ? "0.2.8" : "0.2.9", "arm64"]);
    page = await app.firstWindow();
  } else {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.exposeFunction("getDocument", async (kind) => {
      const p = kind === "material" ? material : reference;
      return { name: basename(p), data: [...(await readFile(p))] };
    });
    await page.exposeFunction("saveResult", async (data) => {
      await writeFile(target, Buffer.from(data));
      return { name: "Probe.zip" };
    });
    await page.addInitScript(() => {
      const open = async (kind) => {
        const f = await window.getDocument(kind);
        return { name: f.name, bytes: Uint8Array.from(f.data) };
      };
      window.mysteryStudio = {
        openProject: () => open("project"),
        chooseMaterial: () => open("material"),
        recentProjects: async () => [],
        detachProject: async () => {},
        projectState: async () => {},
        onSaved: () => {},
        saveExport: (b) => window.saveResult([...b]),
      };
    });
    await page.goto(server.origin + "/studio/dist/studio/index.html");
  }
  page.on("dialog", (d) => {
    actions.push("Bestätigen: " + d.message().split("\n")[0]);
    scenario.dialogs++;
    void d.accept();
  });
  begin("A");
  await click("Neues Mystery erstellen", dialog);
  await input("Lehrkraftkürzel", "QA");
  await click("Mystery erstellen");
  await click("Importieren", { dialog: true, depth: 1 });
  await expect(button(page, "Weiter zur Übernahme")).toBeVisible({
    timeout: 60000,
  });
  await click("Nächste Karte");
  await click("Weiter zur Übernahme");
  await action("Material geprüft", () =>
    page.getByLabel(/Ich habe Texte/).check(),
  );
  await click("Karten übernehmen");
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(2);
  await input("Mystery-Titel", "Wasser");
  await click("Exportieren", dialog);
  await inspect("Einzelexport");
  await click("Für itslearning exportieren", { dialog: true, depth: 2 });
  await expect
    .poll(async () =>
      readFile(target).then(
        (b) => !!unzipSync(b)["imsmanifest.xml"],
        () => false,
      ),
    )
    .toBe(true);
  if (await button(page, "Schließen").isVisible())
    await button(page, "Schließen").click();
  begin("C");
  await click("Mystery gestalten");
  await click(
    before ? "Hilfen und Nummernfarben bearbeiten" : "Hilfen konfigurieren",
    { depth: 2 },
  );
  await input("Hilfetext", "Vergleicht die beiden Beobachtungen.", setting);
  await click("Hilfe übernehmen");
  if (!(await button(page, "Bearbeitungsfreigabe").isVisible()))
    await click("Mystery gestalten");
  await click("Bearbeitungsfreigabe", { depth: 2 });
  await click(
    "Alle Karten für Lernende bearbeitbar machen (2 Änderungen)",
    setting,
  );
  if (!before) await text("Gestaltung", { depth: 2 });
  await click("Darstellung", { depth: before ? 2 : 3 });
  await action(
    "Schrift",
    () => page.getByLabel("Schrift", { exact: true }).selectOption("serif"),
    setting,
  );
  await click("Zur Pinnwand");
  await click("Verbindungen bearbeiten");
  for (const id of [1, 2])
    await action(
      "Karte " + id,
      () =>
        page.locator('.studio-board [data-card="' + id + '"]').press("Enter"),
      { dialog: id === 2, depth: 1 },
    );
  await action(
    "Als Starthilfe freigeben",
    () => page.getByRole("dialog").getByRole("checkbox").check(),
    setting,
  );
  await click("Übernehmen");
  await click("Verbindungsmodus beenden");
  await button(page, "Zur Projektübersicht").click();
  begin("B");
  await click("Mystery öffnen", dialog);
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(5);
  await inspect("Pinnwand");
  await manage();
  await inspect("Niveaus");
  await click("Niveau duplizieren");
  await apply();
  const start = actions.length;
  async function switchLevel(l) {
    if (before) {
      await manage();
      await action(
        "Niveau auswählen",
        () => page.getByLabel("Niveau auswählen").selectOption(l.id),
        { depth: 2 },
      );
      await apply();
    } else if (await page.getByLabel("Aktuelles Niveau").isVisible())
      await action("Aktuelles Niveau", () =>
        page.getByLabel("Aktuelles Niveau").selectOption(l.id),
      );
    else await click(l.name);
  }
  await switchLevel(project.levels[0]);
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(2);
  scenario.levelSwitchActions = actions.length - start;
  if (before) {
    for (const l of [...project.levels, { name: "Kopie" }]) {
      if (l.id !== project.levels[0].id) {
        if (l.id) await switchLevel(l);
        else {
          await manage();
          await action("Kopie auswählen", () =>
            page.getByLabel("Niveau auswählen").selectOption({ index: 4 }),
          );
          await apply();
        }
      }
      await click("Mystery gestalten");
      await action(
        "Speicherung ausschalten",
        () =>
          page
            .getByLabel("Zwischensicherung für dieses Niveau")
            .selectOption("off"),
        setting,
      );
      await click("Zur Pinnwand");
    }
  } else {
    await manage();
    await text("Speicherung im Projekt", { depth: 3 });
    await action(
      "Projektweite Voreinstellung",
      () => page.getByLabel("Voreinstellung für Niveaus").selectOption("off"),
      setting,
    );
    await click("Auf alle Niveaus anwenden");
    await apply();
  }
  await click("Exportieren", dialog);
  await inspect("Sammlungsexport");
  await click("Alle Niveaus für itslearning exportieren", {
    dialog: true,
    depth: 2,
  });
  await expect
    .poll(async () => {
      const z = unzipSync(await readFile(target)),
        levels = Object.keys(z).filter((n) => n.startsWith("level-"));
      return (
        levels.length === 5 &&
        levels.every(
          (k) =>
            JSON.parse(new TextDecoder().decode(z[k])).content.recovery ===
            "off",
        )
      );
    })
    .toBe(true);
  for (const s of Object.values(measurements.scenarios))
    s.count = s.actions.length;
  // Separate risk probe. Exclude these deliberate discarded edits from the measured workflows.
  scenario = { dialogs: 0, settings: 0, maximumDepth: 0 };
  actions = [];
  if (await button(page, "Schließen").isVisible())
    await button(page, "Schließen").click();
  await manage();
  const title = page.getByLabel("Projekttitel", { exact: true }),
    original = await title.inputValue();
  await title.fill("Entwurf zum Verwerfen");
  await button(page, "Schließen").click();
  const confirmed = actions.some((a) => a.includes("verwerfen"));
  assert.equal(confirmed, !before);
  if (!(await button(page, "Niveaus verwalten").isVisible()))
    await button(page, "Mystery gestalten").click();
  await button(page, "Niveaus verwalten").click();
  await expect(title).toHaveValue(original);
  measurements.discardConfirmation = confirmed;
  await writeFile(
    join(out, "Autoren-" + phase + ".json"),
    JSON.stringify(measurements, null, 2),
  );
} catch (error) {
  if (page && !page.isClosed()) {
    console.error(
      (
        await page
          .locator("body")
          .innerText({ timeout: 3000 })
          .catch(() => "")
      ).slice(-3000),
    );
    await page
      .screenshot({ path: join(out, "Fehler.png"), timeout: 5000 })
      .catch(() => {});
  }
  throw error;
} finally {
  await app?.close();
  await browser?.close();
  server.close();
}
