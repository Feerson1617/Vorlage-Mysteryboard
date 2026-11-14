import { test, expect, type Browser, type TestInfo } from "@playwright/test";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname, join, relative } from "node:path";
import { unzipSync } from "fflate";
import { execFileSync } from "node:child_process";
import {
  button,
  rootPage,
  openUniversal,
  importMystery,
  getFile,
  createTwelve,
  type UI,
} from "./authoring-helpers";
import {
  encodeDocument,
  type Student,
  type Task,
} from "../../src/core/documents";

test.use({ hasTouch: true });
const useScorm = process.env.CLASSROOM_SCORM === "1";
async function classroom(
  browser: Browser,
  info: TestInfo,
  viewport: { width: number; height: number },
  suffix: string,
) {
  const context = await browser.newContext({ hasTouch: true, viewport }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const requests: string[] = [];
  context.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      requests.push(r.url());
  });
  let ui: UI = page;
  if (useScorm) {
    const folder = info.outputPath("scorm-" + suffix);
    await mkdir(folder, { recursive: true });
    const files = unzipSync(
      await readFile("artifacts/MysteryBoard-Universal-SCORM-1.2.zip"),
    );
    for (const [name, bytes] of Object.entries(files))
      await writeFile(join(folder, name), bytes);
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const calls: unknown[][] = [];
      (window as any).__scormCalls = calls;
      (window as any).API = Object.fromEntries(
        [
          "LMSInitialize",
          "LMSFinish",
          "LMSSetValue",
          "LMSGetValue",
          "LMSCommit",
        ].map((name) => [
          name,
          (...args: unknown[]) => {
            calls.push([name, ...args]);
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
    ui = page.frames().find((f) => f.url().endsWith("/app.html"))!;
    expect(ui).toBeTruthy();
  } else await openUniversal(page);
  await context.setOffline(true);
  return {
    context,
    page,
    ui,
    async finish() {
      expect(requests).toEqual([]);
      if (useScorm) {
        const calls = await page.evaluate(() => (window as any).__scormCalls);
        expect(calls).toEqual([["LMSInitialize", ""]]);
        await page.evaluate(() =>
          window.dispatchEvent(
            new PageTransitionEvent("pagehide", { persisted: false }),
          ),
        );
        const finished = await page.evaluate(
          () => (window as any).__scormCalls,
        );
        expect(finished).toEqual([
          ["LMSInitialize", ""],
          ["LMSFinish", ""],
        ]);
        await info.attach("scorm-calls-" + suffix, {
          body: JSON.stringify(finished),
          contentType: "application/json",
        });
      }
      await context.close();
    },
  };
}
async function snapshot(ui: UI) {
  return ui.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((n) => [
      n.getAttribute("data-card"),
      n.getAttribute("data-x"),
      n.getAttribute("data-y"),
      n.querySelector("rect")?.getAttribute("fill"),
    ]),
    edges: [...document.querySelectorAll("[data-edge]")].map(
      (n) => n.outerHTML,
    ),
    team: document.querySelector(".team-summary")?.textContent,
  }));
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
async function connect(ui: UI, from: number, to: number, label: string) {
  await ui.locator(`[data-number="${from}"]`).tap();
  await button(ui, "Mit einer Karte verbinden").tap();
  await ui.locator(`[data-number="${to}"]`).tap();
  await ui
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill(label);
  await ui
    .getByRole("combobox", { name: "Richtung", exact: true })
    .selectOption("1");
  await button(ui, "Übernehmen").tap();
}
async function gestures(ui: UI) {
  const page = rootPage(ui),
    session = await page.context().newCDPSession(page),
    board = ui.locator("svg.board");
  const b = (await board.boundingBox())!,
    before = await snapshot(ui),
    z = Number(await board.getAttribute("data-zoom"));
  const point = (id: number, x: number, y: number) => ({ id, x, y });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      point(1, b.x + b.width / 2 - 45, b.y + b.height / 2),
      point(2, b.x + b.width / 2 + 45, b.y + b.height / 2),
    ],
  });
  for (let i = 1; i <= 5; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        point(1, b.x + b.width / 2 - 45 - i * 10, b.y + b.height / 2),
        point(2, b.x + b.width / 2 + 45 + i * 10, b.y + b.height / 2),
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(Number(await board.getAttribute("data-zoom"))).toBeGreaterThan(
    z * 1.3,
  );
  expect(await snapshot(ui)).toEqual(before);
  await expect(ui.getByRole("dialog")).toHaveCount(0);
  await button(ui, "Übersicht").tap();
  const transform = await board.locator(":scope > g").getAttribute("transform");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(1, b.x + 7, b.y + 7)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [point(1, b.x + 40, b.y + 35)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(await board.locator(":scope > g").getAttribute("transform")).not.toBe(
    transform,
  );
  expect(await snapshot(ui)).toEqual(before);
  await button(ui, "Übersicht").tap();
  const c = (await ui.locator('[data-card="1"]').boundingBox())!;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(1, c.x + c.width / 2, c.y + c.height / 2)],
  });
  for (let i = 1; i <= 4; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        point(1, c.x + c.width / 2 + i * 5, c.y + c.height / 2 + i * 3),
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await snapshot(ui)).cards).not.toEqual(before.cards);
  await expect(ui.getByRole("dialog")).toHaveCount(0);
  await session.detach();
}
async function printPdf(
  browser: Browser,
  ui: UI,
  info: TestInfo,
  task: Task,
  tag: string,
) {
  const before = await snapshot(ui);
  await button(ui, "Menü").tap();
  await button(ui, "Druckfassung / PDF").tap();
  await expect(button(ui, "Drucken / PDF speichern")).toBeEnabled({
    timeout: 60000,
  });
  const frame = await ui
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle()
    .then((h) => h!.contentFrame());
  expect(frame).toBeTruthy();
  const page = await browser.newPage();
  await page.context().setOffline(true);
  await page.setContent(await frame!.content());
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
  });
  const path = info.outputPath(tag + ".pdf");
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  await page.close();
  const text = execFileSync("pdftotext", ["-raw", path, "-"], {
    encoding: "utf8",
  }).replace(/\s+/g, " ");
  for (const c of task.content.cards) expect(text).toContain(c.title);
  expect(text).toContain(task.content.title);
  expect(text).toContain("Zusammenhang eins");
  await info.attach(tag, { path, contentType: "application/pdf" });
  if (process.env.AUTHORING_EXAMPLES_DIR) {
    await mkdir(process.env.AUTHORING_EXAMPLES_DIR, { recursive: true });
    await copyFile(
      path,
      join(process.env.AUTHORING_EXAMPLES_DIR, tag + ".pdf"),
    );
  }
  await frame!.evaluate(() => {
    (window as any).__printCalls = 0;
    window.print = () => {
      (window as any).__printCalls++;
    };
  });
  expect(await frame!.evaluate(() => (window as any).__printCalls)).toBe(0);
  await button(ui, "Drucken / PDF speichern").tap();
  expect(await frame!.evaluate(() => (window as any).__printCalls)).toBe(1);
  await rootPage(ui).screenshot({
    path: info.outputPath(tag + "-preview.png"),
  });
  await button(ui, "Schließen").tap();
  expect(await snapshot(ui)).toEqual(before);
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
])
  test(`Unterrichtskreislauf ${viewport.width}x${viewport.height}: Autor → ${useScorm ? "SCORM" : "Blanko-HTML"} → Touch → PDF → selbsttragende PNG`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const teacher = await classroom(browser, info, viewport, "teacher");
    await createTwelve(teacher.ui);
    await button(teacher.ui, "Entwurf sichern").tap();
    const draft = await getFile(
      teacher.ui,
      info,
      `unterricht-${viewport.width}-entwurf.mysteryboard`,
    );
    await teacher.finish();
    const reopened = await classroom(browser, info, viewport, "reopened");
    await importMystery(reopened.ui, draft.bytes);
    await expect(reopened.ui.locator(".author-card-list li")).toHaveCount(12);
    await button(reopened.ui, "Schülerversion erstellen").tap();
    const exported = await getFile(
      reopened.ui,
      info,
      `unterricht-${viewport.width}-aufgabe.mysteryboard`,
    );
    if (exported.document.kind !== "task") throw new Error();
    const task = exported.document;
    await reopened.finish();
    const learner = await classroom(browser, info, viewport, "learner");
    await importMystery(learner.ui, exported.bytes);
    await learner.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Gruppe Neu");
    await button(learner.ui, "Beginnen").tap();
    await expect(learner.ui.locator("[data-card]")).toHaveCount(12);
    expect(
      await learner.ui.locator("[data-number] text").allTextContents(),
    ).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "V10",
      "V11",
      "V12",
    ]);
    const baseline = await project(
      learner.ui,
      info,
      `unterricht-${viewport.width}-start`,
    );
    if (baseline.document.kind !== "student") throw new Error();
    const ordered = baseline.document.work.cards
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((c) => c.id);
    expect(ordered).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (const id of [1, 3, 10]) {
      await learner.ui.locator(`[data-number="${id}"]`).tap();
      await expect(learner.ui.getByRole("dialog")).toHaveCount(1);
      await button(learner.ui, "Schließen").tap();
    }
    await gestures(learner.ui);
    await learner.ui.locator('[data-number="4"]').tap();
    await button(learner.ui, "Blau").tap();
    await learner.ui
      .getByRole("textbox", {
        name: "Name für diese Farbe (freiwillig)",
        exact: true,
      })
      .fill("Eigene Begründung");
    await button(learner.ui, "Schließen").tap();
    await connect(learner.ui, 1, 2, "Zusammenhang eins");
    await connect(learner.ui, 3, 4, "Zusammenhang zwei");
    const edited = await snapshot(learner.ui);
    await button(learner.ui, "Rückgängig").tap();
    await button(learner.ui, "Rückgängig").tap();
    expect((await snapshot(learner.ui)).edges).toHaveLength(0);
    await button(learner.ui, "Wiederholen").tap();
    await button(learner.ui, "Wiederholen").tap();
    expect(await snapshot(learner.ui)).toEqual(edited);
    await button(learner.ui, "Menü").tap();
    await button(learner.ui, "Hilfe").tap();
    await expect(
      learner.ui.getByText("1. Denkimpuls", { exact: true }),
    ).toBeVisible();
    await expect(button(learner.ui, "Weitere Hilfe anzeigen")).toHaveCount(0);
    await button(learner.ui, "Hilfe schließen").tap();
    await printPdf(
      browser,
      learner.ui,
      info,
      task,
      `unterricht-${viewport.width}-druck`,
    );
    const saved = await png(
      learner.ui,
      info,
      `unterricht-${viewport.width}-schueler`,
    );
    expect(saved.document.kind).toBe("student");
    if (saved.document.kind !== "student") throw new Error();
    expect(saved.document.content).toEqual(task.content);
    expect(saved.document.work.team).toBe("Gruppe Neu");
    expect(saved.document.work.categories[2]).toBe("Eigene Begründung");
    expect(saved.document.work.edges).toHaveLength(2);
    await learner.finish();
    const fresh = await classroom(browser, info, viewport, "fresh");
    await importMystery(fresh.ui, saved.bytes, "arbeit.png");
    await expect(fresh.ui.locator("[data-card]")).toHaveCount(12);
    const roundtrip = await project(
      fresh.ui,
      info,
      `unterricht-${viewport.width}-wiederhergestellt`,
    );
    expect(roundtrip.document).toEqual(saved.document);
    await connect(fresh.ui, 5, 6, "Nach Wiederherstellung ergänzt");
    const continued = await png(
      fresh.ui,
      info,
      `unterricht-${viewport.width}-weiterarbeit`,
    );
    if (continued.document.kind !== "student") throw new Error();
    expect(continued.document.work.edges).toHaveLength(3);
    await fresh.page.screenshot({
      path: info.outputPath("vollstaendig-wiederhergestellt.png"),
    });
    await fresh.finish();
  });

test("Ergänzung: KI-Aufgabe erneut bearbeiten, Medien ersetzen, neue Version exportieren und alte Schülerarbeit unvermischt öffnen", async ({
  browser,
}, info) => {
  test.setTimeout(180000);
  const viewport = { width: 1024, height: 768 };
  const initial = await readFile("examples/universal/ki-beispiel.mysteryboard");
  const first = await classroom(browser, info, viewport, "ki-author");
  await importMystery(first.ui, initial);
  await button(first.ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await first.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("KI");
  await button(first.ui, "Lehrkräftemodus öffnen").tap();
  await expect(first.ui.locator(".author-card-list li")).toHaveCount(12);
  await button(first.ui, "Schülerversion erstellen").tap();
  const base = await getFile(
    first.ui,
    info,
    "ki-erste-schuelerversion.mysteryboard",
  );
  if (base.document.kind !== "task") throw new Error();
  await first.finish();
  const old = await classroom(browser, info, viewport, "old-learner");
  await importMystery(old.ui, base.bytes);
  await old.ui
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Team alte Fassung");
  await button(old.ui, "Beginnen").tap();
  await connect(old.ui, 1, 2, "Alte Beziehung");
  const oldSave = await png(old.ui, info, "ki-alte-schuelerarbeit");
  await old.finish();
  const edit = await classroom(browser, info, viewport, "ki-revision");
  await importMystery(edit.ui, base.bytes);
  await button(edit.ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await edit.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(edit.ui, "Lehrkräftemodus öffnen").tap();
  await edit.ui
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Überarbeitete zwölf Beobachtungen");
  await button(edit.ui, "Karte hinzufügen").tap();
  await edit.ui
    .getByLabel("Kartenüberschrift", { exact: true })
    .fill("Neue Pflichtkarte");
  await edit.ui
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .fill("Neue Beobachtung aus der Revision.");
  await edit.ui
    .getByRole("combobox", { name: "Kartengruppe", exact: true })
    .selectOption("required");
  await button(edit.ui, "Karte übernehmen").tap();
  await button(edit.ui, "Karte 3 bearbeiten").tap();
  await edit.ui
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .fill("Überarbeiteter Originaltext 3.");
  await button(edit.ui, "Karte übernehmen").tap();
  await button(edit.ui, "Karte 1 bearbeiten").tap();
  await edit.ui
    .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
    .setInputFiles(resolve("examples/universal/diagramm-3.webp"));
  await expect(edit.ui.locator(".media-view > img")).toHaveAttribute(
    "src",
    /^data:image\/webp/,
  );
  await edit.ui
    .getByLabel("Bildbeschreibung (optional)", { exact: true })
    .fill("Ersetztes breites Diagramm");
  await button(edit.ui, "Karte übernehmen").tap();
  edit.page.once("dialog", (d) => d.accept());
  await button(edit.ui, "Karte 6 löschen").tap();
  await expect(edit.ui.locator(".author-card-list li")).toHaveCount(12);
  await button(edit.ui, "Entwurf sichern").tap();
  const draft = await getFile(
    edit.ui,
    info,
    "ki-ueberarbeiteter-entwurf.mysteryboard",
  );
  await button(edit.ui, "Schließen").tap();
  await button(edit.ui, "Schülerversion erstellen").tap();
  const revised = await getFile(
    edit.ui,
    info,
    "ki-neue-schuelerversion.mysteryboard",
  );
  if (revised.document.kind !== "task") throw new Error();
  const task = revised.document;
  expect(task.content.version).not.toBe(base.document.content.version);
  expect(task.contentHash).not.toBe(base.document.contentHash);
  expect(task.content.id).toBe(base.document.content.id);
  expect(task.content.cards[0].image).not.toBe(
    base.document.content.cards[0].image,
  );
  expect(task.content.cards[2].text).toBe("Überarbeiteter Originaltext 3.");
  expect(task.content.cards.at(-1)!.group).toBe("required");
  expect(task.content.help!.method).toBe(base.document.content.help!.method);
  expect(task.content.help!.categories![2].cardIds).toEqual([3, 8]);
  expect(draft.document.content).toEqual(task.content);
  await edit.finish();
  const student = await classroom(browser, info, viewport, "revision-learner");
  await importMystery(student.ui, revised.bytes);
  await student.ui
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Neue Gruppe");
  await button(student.ui, "Beginnen").tap();
  await expect(student.ui.locator("[data-card]")).toHaveCount(12);
  expect(
    await student.ui.locator("[data-number] text").allTextContents(),
  ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "V9", "V10", "V11", "12"]);
  await student.ui.locator('[data-number="1"]').tap();
  await button(student.ui, "Bild vergrößern").tap();
  await student.ui
    .getByRole("slider", { name: "Bildvergrößerung", exact: true })
    .fill("3");
  await expect(student.ui.locator(".media-scroll img")).toHaveAttribute(
    "src",
    task.content.cards[0].image!,
  );
  const media = student.ui.locator(".media-scroll");
  await media.scrollIntoViewIfNeeded();
  const geometry = await media.evaluate((element) => {
    const image = element.querySelector("img")!;
    const box = image.getBoundingClientRect();
    element.scrollLeft = 80;
    return {
      scrollable: element.scrollWidth > element.clientWidth * 2,
      moved: element.scrollLeft,
      ratio: box.width / box.height,
      naturalRatio: image.naturalWidth / image.naturalHeight,
    };
  });
  expect(geometry.scrollable).toBe(true);
  expect(geometry.moved).toBe(80);
  expect(geometry.ratio).toBeCloseTo(geometry.naturalRatio, 2);
  await media.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await student.page.screenshot({
    path: info.outputPath("medien-vergroesserung.png"),
  });
  await button(student.ui, "Schließen").tap();
  await gestures(student.ui);
  await connect(student.ui, 1, 2, "Zusammenhang eins");
  await button(student.ui, "Menü").tap();
  await button(student.ui, "Hilfe").tap();
  await button(student.ui, "Weitere Hilfe anzeigen").tap();
  await expect(
    student.ui.getByText("2. Nummernorientierung", { exact: true }),
  ).toBeVisible();
  await button(student.ui, "Hilfe schließen").tap();
  await printPdf(browser, student.ui, info, task, "ki-neue-version-druck");
  const newSave = await png(student.ui, info, "ki-neue-schuelerarbeit");
  if (newSave.document.kind !== "student") throw new Error();
  expect(newSave.document.content).toEqual(task.content);
  await student.finish();
  const fresh = await classroom(browser, info, viewport, "revision-fresh");
  await importMystery(fresh.ui, newSave.bytes, "neu.png");
  await expect(fresh.ui.locator("[data-card]")).toHaveCount(12);
  const restored = await project(
    fresh.ui,
    info,
    "ki-neue-version-wiederhergestellt",
  );
  expect(restored.document).toEqual(newSave.document);
  await button(fresh.ui, "Menü").tap();
  await button(fresh.ui, "Fortsetzen").tap();
  await fresh.ui.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name: "alt.png",
    mimeType: "image/png",
    buffer: oldSave.bytes,
  });
  await expect(
    fresh.ui.getByLabel("Team: Team alte Fassung", { exact: true }),
  ).toBeVisible();
  const restoredOld = await project(
    fresh.ui,
    info,
    "ki-alte-version-unvermischt",
  );
  expect(restoredOld.document).toEqual(oldSave.document);
  expect(restoredOld.document.content.cards[0].image).toBe(
    base.document.content.cards[0].image,
  );
  expect(restoredOld.document.content.version).toBe(
    base.document.content.version,
  );
  await fresh.finish();
});
