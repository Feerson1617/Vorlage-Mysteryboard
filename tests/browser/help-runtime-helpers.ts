import {
  expect,
  type Browser,
  type TestInfo,
  type Locator,
} from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { unzipSync } from "fflate";
import { button, rootPage, getFile, type UI } from "./authoring-helpers";
import { encodeDocument } from "../../src/core/documents";
export async function scorm(
  browser: Browser,
  info: TestInfo,
  name: string,
  viewport = { width: 1024, height: 768 },
) {
  const folder = info.outputPath(name);
  await mkdir(folder, { recursive: true });
  for (const [n, b] of Object.entries(
    unzipSync(await readFile("artifacts/MysteryBoard-Universal-SCORM-1.2.zip")),
  ))
    await writeFile(join(folder, n), b);
  const context = await browser.newContext({
      hasTouch: true,
      viewport,
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
      .getByRole("button", { name: "Aufgabe öffnen", exact: true }),
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
// The application only downloads a PNG. Derived JSON is a test snapshot,
// never an alternate student export. Keep every existing full-state assertion.
export async function studentSnapshot(ui: UI, info: TestInfo, name: string) {
  await button(ui, "Menü").tap();
  await expect(button(ui, "Projektdatei sichern")).toHaveCount(0);
  await button(ui, "Kleineres Sicherungsbild").tap();
  await expect(
    ui.getByRole("link", { name: "Sicherungsbild herunterladen", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const saved = await getFile(
    ui,
    info,
    name + "-snapshot-original.png",
    "Sicherungsbild herunterladen",
  );
  const bytes = Buffer.from(encodeDocument(saved.document));
  const path = info.outputPath(name + ".mysteryboard");
  await writeFile(path, bytes);
  await info.attach(name + "-aus-PNG-gelesen.mysteryboard", {
    path,
    contentType: "application/json",
  });
  if (process.env.AUTHORING_EXAMPLES_DIR) {
    await mkdir(process.env.AUTHORING_EXAMPLES_DIR, { recursive: true });
    await writeFile(
      join(process.env.AUTHORING_EXAMPLES_DIR, name + ".mysteryboard"),
      bytes,
    );
  }
  return { ...saved, bytes, png: saved.bytes };
}
export async function project(ui: UI, info: TestInfo, name: string) {
  const saved = await studentSnapshot(ui, info, name);
  await button(ui, "Schließen").tap();
  return saved;
}
export async function png(ui: UI, info: TestInfo, name: string) {
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
export async function connect(
  ui: UI | Locator,
  a: number,
  b: number,
  label: string,
) {
  await ui.locator(`[data-number="${a}"]`).tap();
  await button(ui, "Mit einer Karte verbinden").tap();
  await ui.locator(`[data-number="${b}"]`).tap();
  await ui
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill(label);
  await button(ui, "Übernehmen").tap();
}
export async function gestures(ui: UI) {
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
  const committed = await card.getAttribute("data-x");
  expect(committed).not.toBe(old);
  await expect(ui.getByRole("dialog")).toHaveCount(0);
  await session.detach();
  // Verify that the committed card survives two paints. This also lets the
  // raw-CDP input queue settle before switching back to Playwright's native
  // touchscreen. The bare-HTML probe documents that driver boundary.
  await ui.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await card.getAttribute("data-x")).toBe(committed);
}
