import {
  test,
  expect,
  type Page,
  type Frame,
  type TestInfo,
  type BrowserContext,
} from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import soil from "../../src/content/boden-klasse11.json" with { type: "json" };
import small from "../../src/content/small.json" with { type: "json" };
import {
  initialWork,
  withTeam,
  validateMystery,
  cardNumber,
  type Work,
} from "../../src/core/model";
import { restorePng, embedWork } from "../../src/core/png";
import { validPng } from "../fixtures/png";

type App = Page | Frame;
const mystery = validateMystery(soil);
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const button = (app: App, name: string) =>
  app.getByRole("button", { name, exact: true });
const card = (app: App, id: number) =>
  app.locator(`[data-card="${id}"] > rect`);
const close = (app: App) => button(app, "Schließen").tap();
let server: Server, base: string, htmlHash: string, zipHash: string;
const lms = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lokaler SCORM-1.2-Testplayer (kein itslearning)</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0;display:block}</style>
<script>window.apiCalls=[];window.API={};for(const name of ['LMSInitialize','LMSFinish','LMSGetValue','LMSSetValue','LMSCommit','LMSGetLastError','LMSGetErrorString','LMSGetDiagnostic']){window.API[name]=(...args)=>{window.apiCalls.push([name,...args]);return name==='LMSGetValue'?'':'true';};}</script>
<iframe src="/package/launch.html" title="SCORM-Player"></iframe></html>`;

test.beforeAll(async () => {
  const html = await readFile("artifacts/MysteryBoard-Boden-Klasse11-RC2.html");
  const zip = await readFile(
    "artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip",
  );
  const packed = unzipSync(zip);
  expect(Buffer.from(packed["app.html"])).toEqual(html);
  expect(html.length).toBeLessThan(10_000_000);
  htmlHash = sha(html);
  zipHash = sha(zip);
  const files = new Map<string, { data: Uint8Array | string; type: string }>([
    ["/rc2.html", { data: html, type: "text/html" }],
    ["/lms.html", { data: lms, type: "text/html" }],
    [
      "/blank.html",
      { data: "<!doctype html><title>Beendet</title>", type: "text/html" },
    ],
  ]);
  // Serve exclusively bytes read back from the actual ZIP, never the sources.
  for (const [name, data] of Object.entries(packed))
    files.set(`/package/${name}`, {
      data,
      type: name.endsWith(".js") ? "text/javascript" : "text/html",
    });
  server = createServer((req, res) => {
    const entry = files.get(req.url || "");
    res.writeHead(entry ? 200 : 404, {
      "Content-Type": (entry?.type || "text/plain") + "; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(entry?.data || "Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server");
  base = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server) await new Promise<void>((done) => server.close(() => done()));
});

async function open(
  context: BrowserContext,
  embedded: boolean,
  errors: string[],
  requests: string[],
) {
  await context.setOffline(false);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const allowed = new Set(
    [
      "/rc2.html",
      "/lms.html",
      "/package/launch.html",
      "/package/app.html",
      "/package/session.js",
      "/blank.html",
    ].map((p) => base + p),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !allowed.has(r.url()))
      requests.push(r.url());
  });
  await page.goto(base + (embedded ? "/lms.html" : "/rc2.html"));
  const app = embedded
    ? page.frames().find((f) => f.url() === base + "/package/app.html")!
    : page;
  expect(app).toBeTruthy();
  await expect(button(app, "Beginnen")).toBeVisible();
  await context.setOffline(true);
  return { page, app };
}
async function save(app: App, page: Page, info: TestInfo, name: string) {
  await button(app, "Sichern").tap();
  const link = app.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const pending = page.waitForEvent("download");
  await link.tap();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const path = info.outputPath(name + ".png");
  await download.saveAs(path);
  const png = await readFile(path);
  const state = restorePng(png, mystery);
  await writeFile(
    info.outputPath(name + ".json"),
    JSON.stringify(state, null, 2),
  );
  await info.attach(name, { path, contentType: "image/png" });
  await close(app);
  return { png, state, path };
}
async function importPng(app: App, page: Page, png: Buffer, existing = false) {
  if (existing) await button(app, "Menü").tap();
  await button(app, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await button(app, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({ name: "Original.png", mimeType: "image/png", buffer: png });
}
async function positions(app: App) {
  return app.locator("[data-card]").evaluateAll((nodes) =>
    nodes.map((n) => ({
      id: Number(n.getAttribute("data-card")),
      x: Number(n.getAttribute("data-x")),
      y: Number(n.getAttribute("data-y")),
    })),
  );
}
async function assertVisible(app: App, state: Work) {
  await expect(app.locator("[data-card]")).toHaveCount(state.cards.length);
  expect(await positions(app)).toEqual(
    state.cards.map(({ id, x, y }) => ({ id, x, y })),
  );
  await expect(app.locator("[data-edge]")).toHaveCount(state.edges.length);
  await expect(app.locator(".team-summary")).toHaveText(state.team!);
}
async function screen(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + ".png");
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}
async function connection(app: App) {
  await card(app, 1).tap();
  await button(app, "Mit einer Karte verbinden").tap();
  await card(app, 15).tap();
  await expect(app.getByRole("dialog")).toHaveAccessibleName(
    "Verbindung 1 und V15",
  );
}
async function touchMove(page: Page, app: App, id: number) {
  const b = (await card(app, id).boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= 4; i++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + i * 5, y: y + i * 5, id: 1 }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}
async function pinchAndPan(page: Page, app: App) {
  const board = app.locator(".board"),
    bounds = (await board.boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  const before = await positions(app),
    zoom = Number(await board.getAttribute("data-zoom"));
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 40, y, id: 1 },
        { x: x + 40, y, id: 2 },
      ],
    });
    for (let i = 1; i <= 4; i++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 40 - i * 15, y, id: 1 },
          { x: x + 40 + i * 15, y, id: 2 },
        ],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(Number(await board.getAttribute("data-zoom"))).toBeGreaterThan(zoom);
    await expect(app.getByRole("dialog")).toHaveCount(0);
    expect(await positions(app)).toEqual(before);
    await button(app, "Übersicht").tap();
    const point = await board.evaluate((el) => {
      const b = el.getBoundingClientRect();
      for (const x of [b.x + 8, b.right - 8])
        for (const y of [b.y + 8, b.bottom - 8])
          if (document.elementFromPoint(x, y) === el) return { x, y };
      throw new Error("No free board area for native pan");
    });
    const transform = await board
      .locator(":scope > g")
      .getAttribute("transform");
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...point, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 25, y: point.y + 25, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      await board.locator(":scope > g").getAttribute("transform"),
    ).not.toBe(transform);
    expect(await positions(app)).toEqual(before);
    await expect(app.getByRole("dialog")).toHaveCount(0);
    await button(app, "Übersicht").tap();
  } finally {
    await session.detach();
  }
}

for (const embedded of [false, true])
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    test(`${embedded ? "SCORM-ZIP im LMS" : "RC2-HTML"} ${viewport.width}x${viewport.height}: vollständiger Offline-Unterrichtsablauf`, async ({
      browser,
    }, info) => {
      const requests: string[] = [],
        errors: string[] = [],
        evidence: Record<string, unknown> = {
          browser: browser.version(),
          embedded,
          viewport,
          htmlHash,
          zipHash,
          note: "Chromium touch automation and a simulated same-origin SCORM 1.2 LMS; not a Safari/iPad/itslearning acceptance.",
        };
      const contexts: BrowserContext[] = [];
      try {
        const context = await browser.newContext({
          hasTouch: true,
          viewport,
          acceptDownloads: true,
        });
        contexts.push(context);
        const { page, app } = await open(context, embedded, errors, requests);
        await button(app, "Beginnen").tap();
        await expect(app.locator("[data-card]")).toHaveCount(0);
        await app
          .getByLabel("Teamname oder Vornamen", { exact: true })
          .fill("RC2 – Testgruppe ÄÖÜ");
        await button(app, "Beginnen").tap();
        const expected = withTeam(initialWork(mystery), "RC2 – Testgruppe ÄÖÜ");
        await assertVisible(app, expected);
        await expect(app.locator("[data-edge]")).toHaveCount(0);
        const geometry = await app.evaluate(() => {
          const rect = (el: Element) => {
            const b = el.getBoundingClientRect();
            return {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              right: b.right,
              bottom: b.bottom,
            };
          };
          return {
            cards: [...document.querySelectorAll("[data-card] > rect")].map(
              rect,
            ),
            badges: [...document.querySelectorAll("[data-number]")].map(
              (el) => ({
                ...rect(el),
                label: el.textContent,
                font:
                  Number(el.querySelector("text")?.getAttribute("font-size")) *
                  (el as SVGGraphicsElement).getScreenCTM()!.a,
              }),
            ),
            tools: [...document.querySelectorAll(".toolbar button")].map(rect),
            horizontalOverflow:
              document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(geometry.horizontalOverflow).toBe(false);
        for (const b of [
          ...geometry.cards,
          ...geometry.badges,
          ...geometry.tools,
        ]) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThanOrEqual(viewport.width);
          expect(b.bottom).toBeLessThanOrEqual(viewport.height);
        }
        for (let i = 0; i < geometry.cards.length; i++)
          for (let j = i + 1; j < geometry.cards.length; j++) {
            const a = geometry.cards[i],
              b = geometry.cards[j];
            expect(
              a.right <= b.x ||
                b.right <= a.x ||
                a.bottom <= b.y ||
                b.bottom <= a.y,
            ).toBe(true);
          }
        for (const b of geometry.badges)
          expect(b.font).toBeGreaterThanOrEqual(15);
        for (const b of geometry.tools) {
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.height).toBeGreaterThanOrEqual(44);
        }
        evidence.geometry = geometry;
        await screen(page, info, "01-startanordnung");
        for (const content of mystery.cards) {
          await app.locator(`[data-number="${content.id}"]`).tap();
          await expect(app.getByRole("dialog")).toHaveAccessibleName(
            `Karte ${cardNumber(mystery, content.id)}`,
          );
          await expect(app.locator(".reading h3")).toHaveText(content.title);
          await expect(app.locator(".reading p")).toHaveText(content.text);
          const reading = await app.locator(".reading p").evaluate((el) => ({
            font: parseFloat(getComputedStyle(el).fontSize),
            overflow: el.scrollWidth > el.clientWidth,
          }));
          expect(reading.font).toBeGreaterThanOrEqual(18);
          expect(reading.overflow).toBe(false);
          if (content.id === 8 || content.id === 13)
            await screen(page, info, `karte-${content.id}`);
          await close(app);
          await expect(app.getByRole("dialog")).toHaveCount(0);
        }
        await pinchAndPan(page, app);
        await touchMove(page, app, 1);
        await expect(app.getByRole("dialog")).toHaveCount(0);
        const moved = (await positions(app)).find((c) => c.id === 1)!;
        expect(moved).not.toEqual(expected.cards.find((c) => c.id === 1));
        expect(moved.x).not.toBe(expected.cards.find((c) => c.id === 1)!.x);
        await button(app, "Rückgängig").tap();
        await assertVisible(app, expected);
        await button(app, "Wiederholen").tap();
        // Existing drag behavior brings the moved card to the front. Preserve
        // and verify that drawing order as part of the complete saved state.
        expected.cards = [
          ...expected.cards.filter((c) => c.id !== 1),
          { ...expected.cards.find((c) => c.id === 1)!, ...moved },
        ];
        await assertVisible(app, expected);
        await card(app, 13).tap();
        await button(app, "Blau").tap();
        await app.getByLabel("Name für diese Farbe").fill("Eigene Gruppe");
        await close(app);
        expected.cards.find((c) => c.id === 13)!.color = 2;
        expected.categories[2] = "Eigene Gruppe";
        await connection(app);
        await app.getByLabel("Beschriftung").fill("Eigene Verbindung");
        await app
          .getByRole("combobox", { name: "Richtung", exact: true })
          .selectOption("1");
        await button(app, "Übernehmen").tap();
        await connection(app);
        await app.getByLabel("Beschriftung").fill("Überarbeitet – könnte?");
        await app
          .getByRole("combobox", { name: "Richtung", exact: true })
          .selectOption("2");
        await button(app, "Übernehmen").tap();
        // A real visible label tap, without forcing through an overlapping card.
        const label = app.locator('[data-edge-label="1"]');
        await label.tap();
        await expect(app.getByRole("dialog")).toHaveAccessibleName(
          "Verbindung 1 und V15",
        );
        await button(app, "Verbindung löschen").tap();
        await expect(app.locator("[data-edge]")).toHaveCount(0);
        await button(app, "Rückgängig").tap();
        await expect(app.locator("[data-edge]")).toHaveCount(1);
        await button(app, "Wiederholen").tap();
        await expect(app.locator("[data-edge]")).toHaveCount(0);
        await button(app, "Rückgängig").tap();
        expected.edges = [
          {
            id: 1,
            from: 1,
            to: 15,
            direction: 2,
            label: "Überarbeitet – könnte?",
          },
        ];
        await button(app, "Menü").tap();
        await button(app, "Teamname ändern").tap();
        await app
          .getByLabel("Teamname oder Vornamen", { exact: true })
          .fill("RC2 – Weiterarbeit");
        await button(app, "Übernehmen").tap();
        expected.team = "RC2 – Weiterarbeit";
        const saved = await save(app, page, info, "02-original-sicherung");
        expect(saved.state).toEqual(expected);
        if (embedded) {
          expect(await page.evaluate(() => (window as any).apiCalls)).toEqual([
            ["LMSInitialize", ""],
          ]);
          const launch = page
            .frames()
            .find((f) => f.url() === base + "/package/launch.html")!;
          await launch.evaluate(() =>
            window.dispatchEvent(
              new PageTransitionEvent("pagehide", { persisted: true }),
            ),
          );
          await assertVisible(app, expected);
          expect(await page.evaluate(() => (window as any).apiCalls)).toEqual([
            ["LMSInitialize", ""],
          ]);
        }
        const fresh = await browser.newContext({
          hasTouch: true,
          viewport,
          acceptDownloads: true,
        });
        contexts.push(fresh);
        const restored = await open(fresh, embedded, errors, requests);
        await importPng(restored.app, restored.page, saved.png);
        await expect(restored.app.getByRole("dialog")).toHaveCount(0);
        await assertVisible(restored.app, expected);
        await expect(button(restored.app, "Rückgängig")).toBeDisabled();
        await expect(button(restored.app, "Wiederholen")).toBeDisabled();
        expect(
          (await save(restored.app, restored.page, info, "03-neue-sitzung"))
            .state,
        ).toEqual(expected);
        await card(restored.app, 15).tap();
        await button(restored.app, "Rot").tap();
        await close(restored.app);
        expected.cards.find((c) => c.id === 15)!.color = 5;
        expect(
          (await save(restored.app, restored.page, info, "04-weiterbearbeitet"))
            .state,
        ).toEqual(expected);
        const invalid = [
          saved.png.subarray(0, 64),
          Buffer.from(
            embedWork(validPng(), initialWork(validateMystery(small))),
          ),
        ];
        for (const png of invalid) {
          await importPng(restored.app, restored.page, png, true);
          await expect(
            restored.app.getByRole("dialog").getByRole("status"),
          ).toContainText(
            /keine vollständige|anderen Mystery|passt nicht|Mystery/,
          );
          await close(restored.app);
          await assertVisible(restored.app, expected);
        }
        const legacy = await readFile(
          "tests/fixtures/release/rc1-original.png",
        );
        const old = restorePng(legacy, mystery);
        await importPng(restored.app, restored.page, legacy, true);
        await expect(restored.app.getByRole("dialog")).toHaveCount(0);
        await assertVisible(restored.app, old);
        expect(
          (await save(restored.app, restored.page, info, "05-rc1-importiert"))
            .state,
        ).toEqual(old);
        await screen(restored.page, info, "rc1-positionen-erhalten");
        expect(
          await restored.app.evaluate(() => ({
            local: localStorage.length,
            session: sessionStorage.length,
          })),
        ).toEqual({ local: 0, session: 0 });
        if (embedded) {
          expect(
            await restored.page.evaluate(() => (window as any).apiCalls),
          ).toEqual([["LMSInitialize", ""]]);
          await restored.app.evaluate(() =>
            window.addEventListener(
              "beforeunload",
              (event) => event.stopImmediatePropagation(),
              { capture: true },
            ),
          );
          await fresh.setOffline(false);
          await restored.page
            .frames()
            .find((f) => f.url() === base + "/package/launch.html")!
            .goto(base + "/blank.html");
          const calls = await restored.page.evaluate(
            () => (window as any).apiCalls,
          );
          expect(calls).toEqual([
            ["LMSInitialize", ""],
            ["LMSFinish", ""],
          ]);
          evidence.scormApiCalls = calls;
        }
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
        evidence.status = "passed";
        evidence.steps = [
          "team required",
          "18 mixed cards, no overlap, accessible numbers/tools",
          "all 18 complete reader texts",
          "native Chromium pinch, pan, drag",
          "connection create/edit/visible label/delete, direction, undo/redo",
          "V-card color/category",
          "rename",
          "original PNG download",
          "new context complete state restore and continued editing",
          "corrupt and foreign PNG rejected without losing work",
          "real RC1 PNG preserves old positions",
          "offline and no persistent web storage",
          "packed app byte-identical; no SCORM learner/progress calls",
        ];
      } finally {
        evidence.unexpectedRequests = requests;
        evidence.browserErrors = errors;
        await info.attach("acceptance.json", {
          body: JSON.stringify(evidence, null, 2),
          contentType: "application/json",
        });
        for (const context of contexts) await context.close();
      }
    });
  }
