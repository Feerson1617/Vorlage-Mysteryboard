import { test, expect, type Browser, type TestInfo } from "@playwright/test";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import source from "../../examples/universal/content.json" with { type: "json" };
import {
  taskDocument,
  encodeDocument,
  type Student,
} from "../../src/core/documents";
import { draftFromContent } from "../../src/core/authoring";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
  rootPage,
  type UI,
} from "./authoring-helpers";
import { scorm, gestures, connect } from "./help-runtime-helpers";
import { classroom, downloadClassroom } from "./pdf-region-helpers";
test.use({ hasTouch: true });

const title = "Strömungen und Küsten – Übungsaufgabe",
  team = "Team Nordseeküste";
const task = () => taskDocument({ ...source, title });
async function output(info: TestInfo, path: string, name: string) {
  if (process.env.TOUCH_EVIDENCE_DIR) {
    await mkdir(process.env.TOUCH_EVIDENCE_DIR, { recursive: true });
    await copyFile(path, join(process.env.TOUCH_EVIDENCE_DIR, name));
  }
  await info.attach(name, { path });
}
async function trace(ui: UI) {
  await ui.evaluate(() => {
    const w = window as any;
    if (w.__savingEvents) return;
    w.__savingEvents = [];
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "click",
    ])
      window.addEventListener(
        type,
        (event) => {
          const e = event as PointerEvent,
            n = e.target as Element;
          const item = {
            type,
            id: e.pointerId,
            pointerType: e.pointerType,
            x: e.clientX,
            y: e.clientY,
            detail: e.detail,
            target:
              n
                .closest("button, [data-card], svg.board")
                ?.getAttribute("aria-label") ||
              n.closest("button")?.textContent ||
              n.tagName,
            prevented: false,
            time: performance.now(),
          };
          w.__savingEvents.push(item);
          queueMicrotask(() => {
            item.prevented = e.defaultPrevented;
          });
        },
        true,
      );
  });
}
async function save(ui: UI, info: TestInfo, name: string, compact = false) {
  if (compact) {
    await button(ui, "Menü").tap();
    await expect(button(ui, "Projektdatei sichern")).toHaveCount(0);
    await button(ui, "Kleineres Sicherungsbild").tap();
  } else await button(ui, "Sichern").tap();
  try {
    await expect(
      ui.getByRole("dialog", { name: "Arbeitsstand sichern", exact: true }),
    ).toBeVisible();
  } catch (error) {
    const trace = info.outputPath(name + "-pointer-click.json");
    await writeFile(
      trace,
      JSON.stringify(
        await ui.evaluate(() => (window as any).__savingEvents),
        null,
        2,
      ),
    );
    await output(info, trace, name + "-pointer-click.json");
    throw error;
  }
  const link = ui.getByRole("link", {
    name: "Sicherungsbild herunterladen",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 60000 });
  const url = await link.getAttribute("href");
  expect(
    await ui.evaluate(
      async (url) => (await fetch(url!)).headers.get("content-type"),
      url,
    ),
  ).toBe("image/png");
  const file = await getFile(
    ui,
    info,
    name + ".png",
    "Sicherungsbild herunterladen",
  );
  expect(file.filename).toBe(`${team}_${title}.png`);
  expect(file.bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const path = info.outputPath(name + ".png"),
    independent = info.outputPath(name + "-unabhaengig.json");
  const result = JSON.parse(
    execFileSync(
      "python3",
      ["qa/touch-saving/verify-png.py", path, independent],
      { encoding: "utf8" },
    ),
  );
  expect(JSON.parse(await readFile(independent, "utf8"))).toEqual(
    file.document,
  );
  await writeFile(
    info.outputPath(name + "-pruefung.json"),
    JSON.stringify({ ...result, actualDownloadName: file.filename }, null, 2),
  );
  await output(info, path, name + ".png");
  await output(info, independent, name + "-unabhaengig.json");
  await output(
    info,
    info.outputPath(name + "-pruefung.json"),
    name + "-pruefung.json",
  );
  await button(ui, "Schließen").tap();
  return file;
}
async function state(ui: UI) {
  return ui.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((n) => ({
      id: Number(n.getAttribute("data-card")),
      x: Number(n.getAttribute("data-x")),
      y: Number(n.getAttribute("data-y")),
      fill: n.querySelector("rect")!.getAttribute("fill"),
    })),
    edges: [...document.querySelectorAll("[data-edge]")].map((n) => ({
      id: Number(n.getAttribute("data-edge")),
      label: document.querySelector(
        `[data-edge-label="${n.getAttribute("data-edge")}"]`,
      )?.textContent,
      direction: Number(
        document
          .querySelector(`[data-arrowhead="${n.getAttribute("data-edge")}"]`)
          ?.getAttribute("data-direction") || 0,
      ),
    })),
    team: document.querySelector(".team-summary")?.textContent,
  }));
}
async function moveSecond(ui: UI) {
  const page = rootPage(ui),
    session = await page.context().newCDPSession(page),
    b = (await ui.locator('[data-card="2"] > rect').boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + Math.min(15, b.height / 3);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: x + 21, y: y + 13 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await ui.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
async function makeClassroom(browser: Browser, info: TestInfo, name: string) {
  const context = await browser.newContext({ hasTouch: true }),
    page = await context.newPage();
  await openUniversal(page);
  await importMystery(
    page,
    Buffer.from(encodeDocument(draftFromContent(task().content, "QA"))),
  );
  const bytes = await downloadClassroom(page, info, name + ".zip");
  await output(info, info.outputPath(name + ".zip"), name + ".zip");
  await context.close();
  return bytes;
}
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
])
  for (const mode of ["html", "universal-scorm", "classroom-scorm"] as const)
    test(`PNG-Schülersicherung ${mode} ${viewport.width}: echter Downloadname, MBX3, neue Sitzung und Weiterarbeit`, async ({
      browser,
    }, info) => {
      test.setTimeout(180000);
      const name = `${mode}-${viewport.width}`,
        zip =
          mode === "classroom-scorm"
            ? await makeClassroom(
                browser,
                info,
                "Unterrichtsbeispiel-" + viewport.width + "-SCORM-1.2",
              )
            : null;
      const start = async (suffix: string) => {
        if (zip)
          return classroom(browser, info, zip, title, viewport, name + suffix);
        if (mode === "universal-scorm")
          return scorm(browser, info, name + suffix, viewport);
        const context = await browser.newContext({ hasTouch: true, viewport }),
          page = await context.newPage();
        await openUniversal(page);
        const requests: string[] = [];
        context.on("request", (r) => {
          if (
            /^https?:/.test(r.url()) &&
            !r.url().startsWith("http://localhost:5174/")
          )
            requests.push(r.url());
        });
        return {
          context,
          page,
          ui: page as UI,
          finish: async () => {
            expect(requests).toEqual([]);
            await context.close();
          },
        };
      };
      const first = await start("-erste-sitzung"),
        ui = first.ui;
      await trace(ui);
      if (!zip) await importMystery(ui, Buffer.from(encodeDocument(task())));
      await ui.getByLabel("Teamname oder Vornamen", { exact: true }).fill(team);
      await button(ui, "Beginnen").tap();
      await gestures(ui);
      await moveSecond(ui);
      await connect(ui, 1, 2, "beeinflusst die Beobachtung");
      await connect(ui, 3, 4, "wird geprüft");
      await ui.locator('[data-edge-label="2"]').tap();
      await ui
        .getByRole("combobox", { name: "Richtung", exact: true })
        .selectOption("2");
      await button(ui, "Übernehmen").tap();
      await button(ui, "Menü").tap();
      await expect(button(ui, "Projektdatei sichern")).toHaveCount(0);
      await button(ui, "Hilfe").tap();
      await expect(
        ui.getByRole("dialog", { name: "Hilfe", exact: true }),
      ).toBeVisible();
      await button(ui, "Weitere Hilfe anzeigen").tap();
      await button(ui, "Hilfe schließen").tap();
      const before = await state(ui);
      const image = await save(ui, info, name + "-Original"),
        document = image.document as Student;
      expect(document.kind).toBe("student");
      expect(document.content).toEqual(task().content);
      expect(document.work.team).toBe(team);
      expect(
        document.work.cards.map((c) => ({ id: c.id, x: c.x, y: c.y })),
      ).toEqual(before.cards.map(({ id, x, y }) => ({ id, x, y })));
      expect(document.work.edges.map((e) => e.direction)).toEqual([1, 2]);
      expect(document.work.cards.find((c) => c.id === 1)!.x).not.toBe(
        document.content.initial.cards.find((c) => c.id === 1)!.x,
      );
      expect(document.work.cards.find((c) => c.id === 2)!.x).not.toBe(
        document.content.initial.cards.find((c) => c.id === 2)!.x,
      );
      expect((await save(ui, info, name + "-Kompakt", true)).document).toEqual(
        document,
      );
      const shot = info.outputPath(name + "-sichtbare-pfeile.png");
      await ui.locator("svg.board").screenshot({ path: shot });
      await output(info, shot, name + "-sichtbare-pfeile.png");
      await first.finish();
      const fresh = await start("-neue-sitzung");
      await trace(fresh.ui);
      if (zip) {
        await button(fresh.ui, "Fortsetzen").tap();
        await fresh.ui
          .getByLabel("Mystery-Datei", { exact: true })
          .setInputFiles({
            name: image.filename,
            mimeType: "image/png",
            buffer: image.bytes,
          });
      } else await importMystery(fresh.ui, image.bytes, image.filename);
      await expect(fresh.ui.locator("[data-card]")).toHaveCount(
        document.work.cards.length,
      );
      expect(await state(fresh.ui)).toEqual(before);
      expect(
        (await save(fresh.ui, info, name + "-Wiederhergestellt")).document,
      ).toEqual(document);
      await gestures(fresh.ui);
      const continued = (await save(fresh.ui, info, name + "-Weitergearbeitet"))
        .document as Student;
      expect(continued.content).toEqual(document.content);
      expect(continued.work.team).toBe(document.work.team);
      expect(continued.work.edges).toEqual(document.work.edges);
      expect(continued.work.cards).not.toEqual(document.work.cards);
      await fresh.finish();
    });

test("Lehrkraftdateien behalten .mysteryboard mit Download-MIME und unverändertem Inhalt", async ({
  page,
}, info) => {
  await openUniversal(page);
  const draft = draftFromContent(task().content, "QA");
  await importMystery(page, Buffer.from(encodeDocument(draft)));
  for (const kind of ["Entwurf sichern", "Schülerversion erstellen"]) {
    await button(page, kind).click();
    if (kind === "Schülerversion erstellen")
      await button(page, "Schülerversion als Datei").click();
    const link = page.getByRole("link", {
      name: "Datei herunterladen",
      exact: true,
    });
    const href = await link.getAttribute("href");
    expect(
      await page.evaluate(
        async (url) => (await fetch(url!)).headers.get("content-type"),
        href,
      ),
    ).toBe("application/octet-stream");
    const saved = await getFile(page, info, kind + ".mysteryboard");
    expect(saved.filename).toMatch(/\.mysteryboard$/);
    expect(saved.filename).not.toMatch(/\.json$/);
    expect(saved.document.content).toEqual(draft.content);
    await button(page, "Schließen").click();
  }
});
for (const failAll of [true, false])
  test(`PNG-Fehler: ${failAll ? "vollständiger Fehlschlag erhält Arbeit ohne Ersatzformat" : "großes Bild scheitert, Rückfall bleibt PNG"}`, async ({
    page,
  }, info) => {
    await openUniversal(page);
    await importMystery(page, Buffer.from(encodeDocument(task())));
    await page.getByLabel("Teamname oder Vornamen", { exact: true }).fill(team);
    await button(page, "Beginnen").click();
    const before = await state(page),
      downloads: string[] = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    await page.evaluate((failAll) => {
      const original = HTMLCanvasElement.prototype.toBlob;
      (window as any).__restorePngEncoder = () => {
        HTMLCanvasElement.prototype.toBlob = original;
      };
      HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
        if (failAll || this.width > 3000) callback(null);
        else original.call(this, callback, ...rest);
      };
    }, failAll);
    if (failAll) {
      await button(page, "Sichern").click();
      await expect(page.getByRole("status")).toContainText(
        "Es konnte kein Sicherungsbild erstellt werden",
        { timeout: 60000 },
      );
      await expect(page.getByRole("link")).toHaveCount(0);
      expect(downloads).toEqual([]);
      await button(page, "Schließen").click();
      expect(await state(page)).toEqual(before);
      await page.evaluate(() => (window as any).__restorePngEncoder());
    }
    const saved = await save(
      page,
      info,
      failAll ? "nach-Fehlschlag" : "automatischer-PNG-Rueckfall",
    );
    if (!failAll) expect(saved.bytes.readUInt32BE(16)).toBe(2480);
    expect(await state(page)).toEqual(before);
    expect(downloads.every((n) => n.endsWith(".png"))).toBe(true);
  });
