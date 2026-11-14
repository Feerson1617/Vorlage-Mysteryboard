import {
  test,
  expect,
  type Browser,
  type TestInfo,
  type Locator,
} from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { unzipSync } from "fflate";
import source from "../../examples/universal/content.json" with { type: "json" };
import { taskDocument, encodeDocument } from "../../src/core/documents";
import {
  button,
  rootPage,
  openUniversal,
  importMystery,
  getFile,
  createTwelve,
  type UI,
} from "./authoring-helpers";
test.use({ hasTouch: true });
async function scorm(browser: Browser, info: TestInfo, name: string) {
  const folder = info.outputPath(name);
  await mkdir(folder, { recursive: true });
  for (const [n, b] of Object.entries(
    unzipSync(await readFile("artifacts/MysteryBoard-Universal-SCORM-1.2.zip")),
  ))
    await writeFile(join(folder, n), b);
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      external.push(r.url());
  });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const calls: unknown[][] = [];
    (window as any).__calls = calls;
    (window as any).API = Object.fromEntries(
      [
        "LMSInitialize",
        "LMSFinish",
        "LMSGetValue",
        "LMSSetValue",
        "LMSCommit",
      ].map((n) => [
        n,
        (...args: unknown[]) => {
          calls.push([n, ...args]);
          return "true";
        },
      ]),
    );
  });
  await page.goto(
    "http://localhost:5174/" +
      relative(process.cwd(), join(folder, "launch.html")),
  );
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("button", { name: "Mystery bearbeiten", exact: true }),
  ).toBeVisible();
  const ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
  await context.setOffline(true);
  return {
    context,
    page,
    ui,
    async finish() {
      expect(external).toEqual([]);
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
async function project(ui: UI, info: TestInfo, name: string) {
  await button(ui, "Menü").tap();
  await button(ui, "Projektdatei sichern").tap();
  const saved = await getFile(ui, info, name + ".mysteryboard");
  await button(ui, "Schließen").tap();
  return saved;
}
async function png(ui: UI, info: TestInfo, name: string) {
  await button(ui, "Menü").tap();
  await button(ui, "Kleineres Sicherungsbild").tap();
  await expect(
    ui.getByRole("link", { name: "Sicherungsbild herunterladen", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const saved = await getFile(
    ui,
    info,
    name + ".png",
    "Sicherungsbild herunterladen",
  );
  await button(ui, "Schließen").tap();
  return saved;
}
async function connect(ui: UI | Locator, a: number, b: number, label: string) {
  await ui.locator(`[data-number="${a}"]`).tap();
  await button(ui, "Mit einer Karte verbinden").tap();
  await ui.locator(`[data-number="${b}"]`).tap();
  await ui
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill(label);
  await button(ui, "Übernehmen").tap();
}
async function gestures(ui: UI) {
  const page = rootPage(ui),
    session = await page.context().newCDPSession(page),
    board = ui.locator("svg.board"),
    rect = (await board.boundingBox())!,
    z = Number(await board.getAttribute("data-zoom"));
  const point = (id: number, x: number, y: number) => ({ id, x, y });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      point(1, rect.x + rect.width / 2 - 40, rect.y + rect.height / 2),
      point(2, rect.x + rect.width / 2 + 40, rect.y + rect.height / 2),
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      point(1, rect.x + rect.width / 2 - 80, rect.y + rect.height / 2),
      point(2, rect.x + rect.width / 2 + 80, rect.y + rect.height / 2),
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(Number(await board.getAttribute("data-zoom"))).toBeGreaterThan(
    z * 1.3,
  );
  await button(ui, "Übersicht").tap();
  await ui.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  const card = ui.locator('[data-card="1"]'),
    c = (await card.boundingBox())!,
    old = await card.getAttribute("data-x");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(1, c.x + c.width / 2, c.y + c.height / 2)],
  });
  for (let i = 1; i <= 4; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        point(1, c.x + c.width / 2 + i * 6, c.y + c.height / 2 + i * 3),
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(await card.getAttribute("data-x")).not.toBe(old);
  await expect(ui.getByRole("dialog")).toHaveCount(0);
  await session.detach();
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
])
  test(`Grafischer Hilfe-Unterrichtskreislauf ${viewport.width}: erstellen, echte Vorschau, SCORM, PNG, Revision`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext({ hasTouch: true, viewport }),
      page = await ctx.newPage();
    await openUniversal(page);
    await createTwelve(page);
    await button(page, "Hilfen bearbeiten").tap();
    await page
      .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
      .selectOption("1");
    await page
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill(
        "Welche Ursachen könnt ihr mit den Karten begründen? Prüft eure Vermutungen.",
      );
    await page
      .getByRole("checkbox", {
        name: "Kartennummern als Hilfe markieren",
        exact: true,
      })
      .check();
    await page
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("causes");
    for (const select of await page
      .locator(".help-card-assignments select")
      .all())
      await expect(select).toHaveValue("");
    for (const [id, group] of [
      [1, "group1"],
      [3, "group1"],
      [2, "group2"],
      [4, "group3"],
    ] as const)
      await page
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(group);
    await page
      .getByRole("textbox", { name: "Name Gruppe 1", exact: true })
      .fill("Ausgangsbedingungen");
    await page
      .getByRole("combobox", { name: "Farbe Gruppe 1", exact: true })
      .selectOption("#7b4da8");
    await page.screenshot({
      path: info.outputPath("editor-zuordnungen.png"),
      fullPage: true,
    });
    await button(page, "Hilfe aus Schülersicht ansehen").tap();
    const preview = page.getByRole("dialog", {
      name: "Hilfe aus Schülersicht",
      exact: true,
    });
    await expect(
      preview.getByRole("dialog", { name: "Hilfe", exact: true }),
    ).toContainText("Welche Ursachen");
    await button(preview, "Weitere Hilfe anzeigen").tap();
    await expect(preview.locator('[data-number="1"] circle')).toHaveAttribute(
      "fill",
      "#7b4da8",
    );
    await expect(preview.locator('[data-number="5"] circle')).toHaveAttribute(
      "fill",
      "#334f40",
    );
    await expect(preview.locator("#orientation-legend")).toContainText(
      "Karten 1, 3",
    );
    await page.screenshot({
      path: info.outputPath("echte-schuelervorschau.png"),
    });
    await button(preview, "Hilfe schließen").tap();
    await connect(preview, 1, 2, "Nur in der Vorschau");
    await button(preview, "Zurück zu den Hilfen").tap();
    await expect(
      page.getByRole("textbox", { name: "Hilfetext", exact: true }),
    ).toHaveValue(
      "Welche Ursachen könnt ihr mit den Karten begründen? Prüft eure Vermutungen.",
    );
    await button(page, "Hilfe übernehmen").tap();
    await button(page, "Entwurf sichern").tap();
    const draft = await getFile(
      page,
      info,
      `hilfe-ursachen-${viewport.width}-entwurf.mysteryboard`,
    );
    await ctx.close();
    const c2 = await browser.newContext({ hasTouch: true, viewport }),
      p2 = await c2.newPage();
    await openUniversal(p2);
    await importMystery(p2, draft.bytes);
    await button(p2, "Hilfen bearbeiten").tap();
    await expect(
      p2.getByRole("textbox", { name: "Name Gruppe 1", exact: true }),
    ).toHaveValue("Ausgangsbedingungen");
    await expect(
      p2.getByRole("combobox", { name: "Hilfe für Karte 3", exact: true }),
    ).toHaveValue("group1");
    await button(p2, "Hilfe übernehmen").tap();
    await button(p2, "Schülerversion erstellen").tap();
    const exported = await getFile(
      p2,
      info,
      `hilfe-ursachen-${viewport.width}.mysteryboard`,
    );
    await button(p2, "Schließen").tap();
    expect(exported.document.content.help).toEqual(draft.document.content.help);
    expect(exported.document.content.initial.edges).toEqual([]);
    // Second template is configured manually, never automatically by thirds.
    await button(p2, "Hilfen bearbeiten").tap();
    await p2
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("conflicts");
    await button(p2, "Vorlage wechseln").tap();
    for (const [id, g] of [
      [1, "group1"],
      [5, "group1"],
      [3, "group2"],
      [8, "group3"],
    ] as const)
      await p2
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(g);
    await button(p2, "Hilfe übernehmen").tap();
    await button(p2, "Schülerversion erstellen").tap();
    const conflicts = await getFile(
      p2,
      info,
      `hilfe-konflikte-${viewport.width}.mysteryboard`,
    );
    expect(
      conflicts.document.content.help?.categories?.map((g) => g.cardIds),
    ).toEqual([[1, 5], [3], [8]]);
    await c2.close();
    const learner = await scorm(browser, info, "lernende");
    await importMystery(learner.ui, exported.bytes);
    await learner.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Hilfegruppe");
    await button(learner.ui, "Beginnen").tap();
    await expect(learner.ui.locator(".learning-help")).toHaveCount(0);
    await gestures(learner.ui);
    await connect(learner.ui, 1, 2, "Erster Zusammenhang");
    await connect(learner.ui, 3, 4, "Zweiter Zusammenhang");
    await learner.ui.locator('[data-number="4"]').tap();
    await button(learner.ui, "Blau").tap();
    await learner.ui
      .getByRole("textbox", {
        name: "Name für diese Farbe (freiwillig)",
        exact: true,
      })
      .fill("Eigene Farbe");
    await button(learner.ui, "Schließen").tap();
    const before = await project(
      learner.ui,
      info,
      `hilfe-${viewport.width}-vorher`,
    );
    const undo = await button(learner.ui, "Rückgängig").isEnabled();
    await button(learner.ui, "Menü").tap();
    await button(learner.ui, "Hilfe").tap();
    await expect(
      learner.ui.getByRole("dialog", { name: "Hilfe", exact: true }),
    ).toContainText("Welche Ursachen");
    await button(learner.ui, "Weitere Hilfe anzeigen").tap();
    await expect(
      learner.ui.locator('[data-number="3"] circle'),
    ).toHaveAttribute("fill", "#7b4da8");
    await expect(learner.ui.locator('[data-card="4"] > rect')).toHaveAttribute(
      "fill",
      "#e0e9f1",
    );
    await learner.page.screenshot({
      path: info.outputPath("scorm-aktive-hilfe.png"),
    });
    await button(learner.ui, "Hilfe schließen").tap();
    expect(await button(learner.ui, "Rückgängig").isEnabled()).toBe(undo);
    const active = await png(learner.ui, info, `hilfe-${viewport.width}-aktiv`);
    expect(active.document).toEqual(before.document);
    await button(learner.ui, "Menü").tap();
    await button(learner.ui, "Hilfe").tap();
    await button(learner.ui, "Orientierung ausblenden").tap();
    await button(learner.ui, "Hilfe schließen").tap();
    const hidden = await png(
      learner.ui,
      info,
      `hilfe-${viewport.width}-schueler`,
    );
    expect(hidden.bytes).toEqual(active.bytes);
    await learner.finish();
    const fresh = await scorm(browser, info, "frisch");
    await importMystery(fresh.ui, hidden.bytes, "stand.png");
    const restored = await project(
      fresh.ui,
      info,
      `hilfe-${viewport.width}-wiederhergestellt`,
    );
    expect(restored.document).toEqual(before.document);
    await connect(fresh.ui, 5, 6, "Weitergearbeitet");
    await fresh.finish();
    const revision = await scorm(browser, info, "revision");
    await importMystery(revision.ui, exported.bytes);
    await button(revision.ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
    await revision.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
    await button(revision.ui, "Lehrkräftemodus öffnen").tap();
    await button(revision.ui, "Karte hinzufügen").tap();
    await revision.ui
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill("Neue Karte");
    await revision.ui
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill("Neue Information");
    await button(revision.ui, "Karte übernehmen").tap();
    revision.page.once("dialog", (d) => d.accept());
    await button(revision.ui, "Karte 1 löschen").tap();
    await button(revision.ui, "Hilfen bearbeiten").tap();
    await revision.ui
      .getByRole("textbox", { name: "Name Gruppe 1", exact: true })
      .fill("Präzisierte Bedingungen");
    await button(revision.ui, "Hilfe übernehmen").tap();
    await button(revision.ui, "Schülerversion erstellen").tap();
    const newer = await getFile(
      revision.ui,
      info,
      `hilfe-${viewport.width}-revision.mysteryboard`,
    );
    expect(newer.document.content.version).not.toBe(
      exported.document.content.version,
    );
    expect(
      newer.document.content.help?.categories?.find((g) => g.id === "group1")
        ?.cardIds,
    ).toEqual([2]);
    await revision.finish();
    const old = await scorm(browser, info, "alt-und-neu");
    await importMystery(old.ui, newer.bytes);
    await old.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Neue Fassung");
    await button(old.ui, "Beginnen").tap();
    await button(old.ui, "Menü").tap();
    await button(old.ui, "Hilfe").tap();
    await button(old.ui, "Weitere Hilfe anzeigen").tap();
    await expect(old.ui.locator("#orientation-legend")).toContainText(
      "Präzisierte Bedingungen",
    );
    await button(old.ui, "Hilfe schließen").tap();
    await button(old.ui, "Menü").tap();
    await button(old.ui, "Fortsetzen").tap();
    await old.ui.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
      name: "alt.png",
      mimeType: "image/png",
      buffer: hidden.bytes,
    });
    const oldRestored = await project(
      old.ui,
      info,
      `hilfe-${viewport.width}-alte-fassung`,
    );
    expect(oldRestored.document).toEqual(before.document);
    await old.finish();
  });

test("Lokale Hilfe: Fehler, Vorlagenwechsel, eigene Gruppen, Löschen, Tastatur und Abbruch erhalten Eingaben", async ({
  page,
}, info) => {
  await openUniversal(page);
  await importMystery(page, Buffer.from(encodeDocument(taskDocument(source))));
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await button(page, "Hilfen bearbeiten").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Hilfen für Lernende", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("combobox", { name: "Hilfe für Karte 1", exact: true }),
  ).toHaveValue("conditions");
  await page
    .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
    .selectOption("causes");
  await button(page, "Beibehalten").tap();
  await expect(
    page.getByRole("combobox", { name: "Hilfe für Karte 1", exact: true }),
  ).toHaveValue("conditions");
  await page
    .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
    .selectOption("causes");
  await button(page, "Vorlage wechseln").tap();
  await button(page, "Hilfe übernehmen").tap();
  await expect(page.getByRole("alert")).toContainText("Bitte prüft");
  await expect(
    page.getByText(
      "Dieser Gruppe ist noch keine Karte zugeordnet. Ordnet eine Karte zu oder entfernt die Gruppe.",
      { exact: true },
    ),
  ).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
    .selectOption("custom");
  await expect(
    page.getByRole("combobox", { name: "Hilfe für Karte 1", exact: true }),
  ).toHaveValue("conditions");
  await page
    .getByRole("textbox", { name: "Name Gruppe 1", exact: true })
    .fill("");
  await page
    .getByRole("combobox", { name: "Farbe Gruppe 2", exact: true })
    .selectOption("#2166ac");
  await button(page, "Hilfe übernehmen").tap();
  await expect(
    page.getByText("Bitte gebt dieser Gruppe einen Namen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bitte wählt für jede Gruppe eine andere lesbare Farbe.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(button(page, "Entwurf sichern")).toBeDisabled();
  page.once("dialog", (d) => d.dismiss());
  await button(page, "Abbrechen").tap();
  await expect(
    page.getByRole("textbox", { name: "Name Gruppe 1", exact: true }),
  ).toHaveValue("");
  page.once("dialog", (d) => d.accept());
  await button(page, "Abbrechen").tap();
  await button(page, "Entwurf sichern").tap();
  const original = await getFile(page, info, "hilfe-unveraendert.mysteryboard");
  expect(original.document.content.help).toEqual(
    taskDocument(source).content.help,
  );
  await button(page, "Schließen").tap();
  await button(page, "Hilfen bearbeiten").tap();
  await button(page, "Gruppe 1 entfernen").tap();
  await button(page, "Beibehalten").tap();
  await expect(
    page.getByRole("textbox", { name: "Name Gruppe 1", exact: true }),
  ).toHaveValue("Rahmenbedingungen");
  await button(page, "Gruppe 1 entfernen").tap();
  await button(page, "Gruppe entfernen bestätigen").tap();
  await expect(
    page.getByRole("combobox", { name: "Hilfe für Karte 1", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("checkbox", {
      name: "Kartennummern als Hilfe markieren",
      exact: true,
    })
    .uncheck();
  await button(page, "Hilfe übernehmen").tap();
  await button(page, "Schülerversion erstellen").tap();
  const disabled = await getFile(
    page,
    info,
    "hilfe-ausgeschaltet.mysteryboard",
  );
  expect(disabled.document.content.help?.categories).toBeUndefined();
  expect(disabled.document.content.help?.method).toBe(source.help.method);
  await button(page, "Schließen").tap();
  await button(page, "Hilfen bearbeiten").tap();
  await page
    .getByRole("checkbox", {
      name: "Kartennummern als Hilfe markieren",
      exact: true,
    })
    .check();
  for (let i = 1; i <= 6; i++) {
    await button(page, "Gruppe hinzufügen").tap();
    await page
      .getByRole("textbox", { name: `Name Gruppe ${i}`, exact: true })
      .fill(`Eigene Gruppe ${i}`);
    await page
      .getByRole("combobox", { name: `Hilfe für Karte ${i}`, exact: true })
      .selectOption(`group${i}`);
  }
  await expect(button(page, "Gruppe hinzufügen")).toBeDisabled();
  await button(page, "Hilfe übernehmen").tap();
  await button(page, "Schülerversion erstellen").tap();
  const own = await getFile(
    page,
    info,
    "hilfe-sechs-eigene-gruppen.mysteryboard",
  );
  expect(own.document.content.help?.categories).toHaveLength(6);
  expect(own.document.content.help?.categories?.map((g) => g.cardIds)).toEqual([
    [1],
    [2],
    [3],
    [4],
    [5],
    [6],
  ]);
});

test("Erstbedienung bei 320 Pixeln: sichtbare Funktionsnamen führen in 14 Handlungen bis zum Download", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openUniversal(page);
  const raw = structuredClone(source);
  delete (raw as { help?: unknown }).help;
  await importMystery(page, Buffer.from(encodeDocument(taskDocument(raw))));
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  const actions: string[] = [];
  const act = async (name: string, action: () => Promise<unknown>) => {
    await action();
    actions.push(name);
  };
  await act("Hilfen bearbeiten", () =>
    button(page, "Hilfen bearbeiten").tap(),
  );
  await act("Denkimpuls wählen", () =>
    page
      .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
      .selectOption("0"),
  );
  await act("Text individuell ändern", () =>
    page
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill(
        "Welche Beobachtung könnt ihr schon erklären? Begründet mit den Karten.",
      ),
  );
  await act("Nummernhilfe einschalten", () =>
    page
      .getByRole("checkbox", {
        name: "Kartennummern als Hilfe markieren",
        exact: true,
      })
      .check(),
  );
  await act("Ursachen und Wirkungen wählen", () =>
    page
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("causes"),
  );
  for (const id of [1, 2, 3])
    await act(`Karte ${id} zuordnen`, () =>
      page
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(`group${id}`),
    );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const sizes = await page
    .locator(".help-editor button,.help-editor select")
    .evaluateAll((nodes) =>
      nodes
        .map((n) => ({
          label: n.getAttribute("aria-label") || n.textContent,
          rect: n.getBoundingClientRect(),
        }))
        .filter((n) => n.rect.width > 0)
        .map((n) => ({
          label: n.label,
          width: n.rect.width,
          height: n.rect.height,
        })),
    );
  expect(sizes.every((n) => n.width >= 48 && n.height >= 48)).toBe(true);
  await act("Schüleransicht ansehen", () =>
    button(page, "Hilfe aus Schülersicht ansehen").tap(),
  );
  const preview = page.getByRole("dialog", {
    name: "Hilfe aus Schülersicht",
    exact: true,
  });
  await act("Zweite Hilfe aufrufen", () =>
    button(preview, "Weitere Hilfe anzeigen").tap(),
  );
  await page.screenshot({ path: info.outputPath("schuelervorschau-320.png") });
  await act("Zu Hilfen zurückkehren", () =>
    button(preview, "Zurück zu den Hilfen").tap(),
  );
  await act("Hilfe übernehmen", () => button(page, "Hilfe übernehmen").tap());
  await act("Schülerversion erstellen", () =>
    button(page, "Schülerversion erstellen").tap(),
  );
  await act("Datei herunterladen", () =>
    getFile(page, info, "erstbedienung-hilfe.mysteryboard"),
  );
  expect(actions).toHaveLength(14);
  await info.attach("bedienhandlungen", {
    body: JSON.stringify(
      {
        count: actions.length,
        actions,
        note: "Automatisierter sichtbarer Bedienweg, keine empirische Nutzerstudie.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await writeFile(
    info.outputPath("bedienhandlungen.json"),
    JSON.stringify({ count: actions.length, actions, sizes }, null, 2),
  );
});

for (const format of ["HTML", "SCORM"])
  test(`Hilfekategorien bleiben im mysteriespezifischen ${format}-Build grafisch bearbeitbar`, async ({
    page,
  }, info) => {
    let ui: UI = page;
    if (format === "HTML")
      await page.goto(
        "http://localhost:5174/artifacts/tests/MysteryBoard-Editierbares-Beispiel.html",
      );
    else {
      const folder = info.outputPath("specific");
      await mkdir(folder, { recursive: true });
      for (const [n, b] of Object.entries(
        unzipSync(
          await readFile(
            "artifacts/tests/MysteryBoard-Editierbares-Beispiel-SCORM.zip",
          ),
        ),
      ))
        await writeFile(join(folder, n), b);
      await page.goto(
        "http://localhost:5174/" +
          relative(process.cwd(), join(folder, "launch.html")),
      );
      await expect(
        page
          .frameLocator("iframe")
          .getByRole("button", {
            name: "Lehrkräftemodus – Mystery bearbeiten",
            exact: true,
          }),
      ).toBeVisible();
      ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
    }
    await page.context().setOffline(true);
    await button(ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
    await ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
    await button(ui, "Lehrkräftemodus öffnen").tap();
    await button(ui, "Hilfen bearbeiten").tap();
    await expect(
      ui.getByRole("combobox", { name: "Hilfe für Karte 1", exact: true }),
    ).toHaveValue("conditions");
    await ui
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill("Auch diese Ausgabe bleibt bearbeitbar.");
    await button(ui, "Hilfe übernehmen").tap();
    await button(ui, "Schülerversion erstellen").tap();
    const saved = await getFile(
      ui,
      info,
      `spezifisch-hilfe-${format}.mysteryboard`,
    );
    expect(saved.document.content.help?.method).toBe(
      "Auch diese Ausgabe bleibt bearbeitbar.",
    );
    expect(saved.document.content.help?.categories).toEqual(
      taskDocument(source).content.help?.categories,
    );
    expect(saved.document.content.version).not.toBe(source.version);
  });
