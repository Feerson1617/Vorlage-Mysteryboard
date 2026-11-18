import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fillTeam, completeExportTeam, TEST_TEAM } from "./team-helpers";
import smallData from "../../src/content/small.json" with { type: "json" };
import largeData from "../../src/content/large.json" with { type: "json" };
import stressData from "../fixtures/review/stress-220.json" with { type: "json" };
import {
  validateMystery,
  initialWork,
  withTeam,
  type Work,
} from "../../src/core/model";
import { restorePng } from "../../src/core/png";
const url = (large = false) =>
  `http://localhost:5174/artifacts/MysteryBoard-${large ? "umfangreich" : "klein"}.html`;
const fixture = (name: string) => `tests/fixtures/review/${name}`;
const btn = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true });
const card = (p: Page, id: number) => p.locator(`[data-card="${id}"] > rect`);
const close = (p: Page) => btn(p, "Schließen").click();
async function load(p: Page, file: string) {
  await btn(p, "Fortsetzen").click();
  await p.getByLabel("Sicherungsbild", { exact: true }).setInputFiles(file);
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function connect(p: Page, from = 1, to = 12) {
  await card(p, from).click();
  await btn(p, "Mit einer Karte verbinden").click();
  await card(p, to).click();
}
async function savedBytes(p: Page) {
  await btn(p, "Sichern").click();
  await completeExportTeam(p);
  const link = p.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const download = p.waitForEvent("download");
  await link.click();
  const file = (await (await download).path())!;
  return { file, bytes: await readFile(file) };
}
test("M2 Original-ID-Grenzstand: dreimal Anlegen/Löschen/Undo/Redo und frische Wiederherstellung", async ({
  page,
  browser,
}, info) => {
  const mystery = validateMystery(smallData);
  const original = restorePng(
    new Uint8Array(await readFile(fixture("Start-ID-1000000.png"))),
    mystery,
  );
  await page.goto(url());
  await load(page, fixture("Start-ID-1000000.png"));
  for (let i = 0; i < 3; i++) {
    await connect(page);
    await page.getByLabel("Beschriftung").fill("Grenzstand bleibt bearbeitbar");
    await btn(page, "Übernehmen").click();
    await connect(page);
    await btn(page, "Verbindung löschen").click();
    await btn(page, "Rückgängig").click();
    await btn(page, "Wiederholen").click();
    await btn(page, "Rückgängig").click();
    if (i < 2) {
      await connect(page);
      await btn(page, "Verbindung löschen").click();
    }
  }
  await expect(page.locator("[data-edge]")).toHaveCount(10);
  const { file, bytes } = await savedBytes(page);
  const result = restorePng(new Uint8Array(bytes), mystery);
  expect(result.team).toBe(TEST_TEAM);
  expect(result.cards).toEqual(original.cards);
  expect(result.categories).toEqual(original.categories);
  expect(result.edges).toEqual(expect.arrayContaining(original.edges));
  expect(result.edges).toHaveLength(10);
  expect(result.edges.every((e) => e.id <= 1000000)).toBe(true);
  await info.attach("M2-output.png", { body: bytes, contentType: "image/png" });
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(url());
  await load(fresh, file);
  await expect(fresh.locator("[data-card]")).toHaveCount(12);
  await expect(fresh.locator("[data-edge]")).toHaveCount(10);
  await connect(fresh);
  await expect(fresh.getByLabel("Beschriftung")).toHaveValue(
    "Grenzstand bleibt bearbeitbar",
  );
  await close(fresh);
  expect(
    restorePng(new Uint8Array((await savedBytes(fresh)).bytes), mystery),
  ).toEqual(result);
  await context.close();
});
for (const touch of [false, true]) {
  test(`M1 sichtbares Label statt kreuzender Trefferfläche (${touch ? "Touch" : "Maus"})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: touch,
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    await page.goto(url());
    await fillTeam(page);
    await btn(page, "Beginnen").click();
    await connect(page, 1, 3);
    await btn(page, "Übernehmen").click();
    const label = page.locator(
      '[data-edge-label="1"] rect, [data-edge="1"] rect',
    );
    const tap = async () => {
      const b = (await label.boundingBox())!;
      if (touch)
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };
    await tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    await page.getByLabel("Beschriftung").fill("Gezielt geändert");
    await btn(page, "Übernehmen").click();
    await tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    await btn(page, "Verbindung löschen").click();
    await expect(page.locator('[data-edge="1"]')).toHaveCount(0);
    await expect(page.locator("[data-edge]")).toHaveCount(9);
    // The unlabeled 1–3 line retains a wide target, 12px off the visible stroke.
    const free = await page
      .locator('[data-edge="10"] line')
      .first()
      .evaluate((el) => {
        const line = el as SVGLineElement,
          m = line.getScreenCTM()!;
        const a = new DOMPoint(
          line.x1.baseVal.value,
          line.y1.baseVal.value,
        ).matrixTransform(m);
        const b = new DOMPoint(
          line.x2.baseVal.value,
          line.y2.baseVal.value,
        ).matrixTransform(m);
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        for (let t = 0.1; t < 0.95; t += 0.05) {
          const x = a.x + (b.x - a.x) * t - ((b.y - a.y) / length) * 12;
          const y = a.y + (b.y - a.y) * t + ((b.x - a.x) / length) * 12;
          if (
            document
              .elementFromPoint(x, y)
              ?.closest("[data-edge]")
              ?.getAttribute("data-edge") === "10"
          )
            return { x, y };
        }
        return null;
      });
    expect(free).not.toBeNull();
    if (touch) await page.touchscreen.tap(free!.x, free!.y);
    else await page.mouse.click(free!.x, free!.y);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 3",
    );
    await context.close();
  });
}

const stressUrl = "http://localhost:5174/dist/review/index.html";
for (const touch of [false, true])
  test(`M1 220 Original-Verbindungen: sichtbare Kreuzungslabels (${touch ? "Touch" : "Maus"})`, async ({
    browser,
  }, info) => {
    // Two complete media-rich exports plus fresh-context restore, like the
    // existing large-board test, need headroom on a throttled cloud worker.
    test.setTimeout(120_000);
    const context = await browser.newContext({
      hasTouch: touch,
      viewport: { width: 1180, height: 820 },
    });
    const page = await context.newPage();
    const external: string[] = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.url() !== stressUrl)
        external.push(r.url());
    });
    await page.goto(stressUrl);
    await context.setOffline(true);
    await fillTeam(page);
    await btn(page, "Beginnen").click();
    await expect(page.locator("[data-edge]")).toHaveCount(220);
    const targets = await page.evaluate(() => {
      const boxes = [
        ...document.querySelectorAll("[data-edge-label] rect"),
      ].map((el) => ({
        el,
        b: el.getBoundingClientRect(),
        id: Number(el.parentElement!.getAttribute("data-edge-label")),
      }));
      const cards = [
        ...document.querySelectorAll(
          "[data-card] > rect, [data-number] circle",
        ),
      ].map((el) => el.getBoundingClientRect());
      const contains = (b: DOMRect, x: number, y: number) =>
        x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
      return boxes.flatMap(({ b, id }, index) => {
        const x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        if (
          cards.some((c) => contains(c, x, y)) ||
          boxes.slice(index + 1).some((c) => contains(c.b, x, y))
        )
          return [];
        const stack = document.elementsFromPoint(x, y);
        return [
          {
            id,
            x,
            y,
            actual: Number(
              stack[0]
                ?.closest("[data-edge-label], [data-edge]")
                ?.getAttribute("data-edge-label"),
            ),
            crossing: stack.some(
              (el) =>
                el.closest("[data-edge]") &&
                Number(el.closest("[data-edge]")!.getAttribute("data-edge")) !==
                  id,
            ),
          },
        ];
      });
    });
    expect(targets.length).toBeGreaterThan(20);
    for (const t of targets)
      expect(t.actual, `sichtbares Label ${t.id}`).toBe(t.id);
    const crossings = targets.filter((t) => t.crossing);
    expect(crossings.length).toBeGreaterThan(5);
    for (const t of crossings.slice(0, 8)) {
      if (touch) await page.touchscreen.tap(t.x, t.y);
      else await page.mouse.click(t.x, t.y);
      const edge = stressData.initial.edges.find((e) => e.id === t.id)!;
      await expect(page.getByRole("dialog")).toHaveAccessibleName(
        `Verbindung ${edge.from} und ${edge.to}`,
      );
      await expect(page.getByLabel("Beschriftung")).toHaveValue(edge.label);
      await close(page);
    }
    // Edit/delete a crossing and undo both before the exact state comparison.
    const chosen = crossings.find(
      (t) =>
        stressData.initial.edges.find((e) => e.id === t.id)!.label.length < 20,
    )!;
    expect(chosen).toBeTruthy();
    const tapChosen = async () => {
      const b = (await page
        .locator(`[data-edge-label="${chosen.id}"] rect`)
        .boundingBox())!;
      if (touch)
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };
    await tapChosen();
    // This label is under the dialog's delete button. A single native touch
    // click must open it without falling through and deleting the connection.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("[data-edge]")).toHaveCount(220);
    await page.getByLabel("Beschriftung").fill("Geprüft");
    await btn(page, "Übernehmen").click();
    await tapChosen();
    await expect(page.getByLabel("Beschriftung")).toHaveValue("Geprüft");
    await btn(page, "Verbindung löschen").click();
    await expect(page.locator(`[data-edge="${chosen.id}"]`)).toHaveCount(0);
    await btn(page, "Rückgängig").click();
    await btn(page, "Rückgängig").click();
    await page.screenshot({ path: info.outputPath("stress-220.png") });
    // Full state, long text and long label stay intact through export/import.
    const mystery = validateMystery(stressData);
    const { bytes, file } = await savedBytes(page);
    expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(
      withTeam(initialWork(mystery), TEST_TEAM),
    );
    await info.attach("stress-220-output.png", {
      body: bytes,
      contentType: "image/png",
    });
    const freshContext = await browser.newContext();
    const fresh = await freshContext.newPage();
    await fresh.goto(stressUrl);
    await load(fresh, file);
    await expect(fresh.locator("[data-card]")).toHaveCount(60);
    await expect(fresh.locator("[data-edge]")).toHaveCount(220);
    expect(
      restorePng(new Uint8Array((await savedBytes(fresh)).bytes), mystery),
    ).toEqual(withTeam(initialWork(mystery), TEST_TEAM));
    expect(external).toEqual([]);
    await info.attach("label-hits.json", {
      body: JSON.stringify(
        { visible: targets.length, crossings: crossings.length, targets },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await freshContext.close();
    await context.close();
  });

test("Original 60/90-Gruppenstand bleibt vollständig und im frischen Kontext bearbeitbar", async ({
  page,
  browser,
}) => {
  const mystery = validateMystery(largeData);
  const expected = restorePng(
    new Uint8Array(await readFile(fixture("60-90-Gruppenstand.png"))),
    mystery,
  );
  await page.goto(url(true));
  await load(page, fixture("60-90-Gruppenstand.png"));
  // The legacy fixture itself stays teamless; only the new UI export asks for
  // the explicit name. Every original card/edge/category must remain exact.
  expect(expected.schema).toBe(1);
  expect(expected.team).toBeUndefined();
  const { file, bytes } = await savedBytes(page);
  expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(
    withTeam(expected, TEST_TEAM),
  );
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(url(true));
  await load(fresh, file);
  await expect(fresh.locator("[data-card]")).toHaveCount(60);
  await expect(fresh.locator("[data-edge]")).toHaveCount(90);
  await fresh.locator('[data-card="23"]').press("Enter");
  await expect(fresh.getByRole("dialog")).toHaveAccessibleName("Karte 23");
  await close(fresh);
  expect(
    restorePng(new Uint8Array((await savedBytes(fresh)).bytes), mystery),
  ).toEqual(withTeam(expected, TEST_TEAM));
  await context.close();
});

test("Werkzeugleiste 320–1024 px: alle fünf Werkzeuge sichtbar, 48-px-Touchflächen, kein Überlauf", async ({
  page,
}) => {
  await page.goto(url());
  await fillTeam(page);
  await btn(page, "Beginnen").click();
  for (const width of [
    320, 375, 480, 481, 550, 600, 601, 610, 620, 640, 704, 705, 768, 1024,
  ]) {
    await page.setViewportSize({ width, height: 820 });
    const geometry = await page.locator(".toolbar button").evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return {
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
        };
      }),
    );
    expect(geometry).toHaveLength(5);
    for (const b of geometry) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
      expect(b.height).toBeGreaterThanOrEqual(48);
      expect(b.width).toBeGreaterThanOrEqual(48);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(820);
    await btn(page, "Menü").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await close(page);
  }
});

for (const large of [false, true])
  for (const portrait of [false, true])
    test(`Nummern ${large ? 60 : 12}, ${portrait ? "Hochformat" : "Querformat"}: außerhalb, lesbar, vollständig, Zoom begrenzt`, async ({
      page,
    }, info) => {
      const viewport = portrait
        ? { width: 768, height: 1024 }
        : { width: 1024, height: 768 };
      await page.setViewportSize(viewport);
      await page.goto(url(large));
      await fillTeam(page);
      await btn(page, "Beginnen").click();
      const inspect = () =>
        page.evaluate(() => {
          const board = document
            .querySelector(".board")!
            .getBoundingClientRect();
          const cards = [
            ...document.querySelectorAll("[data-card] > rect"),
          ].map((el) => el.getBoundingClientRect());
          return [...document.querySelectorAll("[data-number]")].map((el) => {
            const circle = el.querySelector("circle")!;
            const b = circle.getBoundingClientRect();
            const text = el.querySelector("text")!;
            const own = el
              .parentElement!.querySelector("rect")!
              .getBoundingClientRect();
            const matrix = (text as SVGGraphicsElement).getScreenCTM()!;
            return {
              id: Number(el.getAttribute("data-number")),
              font: 18 * matrix.a,
              left: b.left,
              top: b.top,
              right: b.right,
              bottom: b.bottom,
              width: b.width,
              fullyVisible:
                b.left >= board.left &&
                b.top >= board.top &&
                b.right <= board.right &&
                b.bottom <= board.bottom,
              outside: b.right < own.left && b.bottom < own.top,
              overlaps: cards.some(
                (c) =>
                  b.left < c.right &&
                  b.right > c.left &&
                  b.top < c.bottom &&
                  b.bottom > c.top,
              ),
            };
          });
        });
      await expect
        .poll(async () =>
          (await inspect()).every(
            (n) => n.fullyVisible && n.outside && n.font >= 15,
          ),
        )
        .toBe(true);
      const normal = await inspect();
      expect(normal).toHaveLength(large ? 60 : 12);
      for (const n of normal) expect(n.overlaps, `Nummer ${n.id}`).toBe(false);
      await page.screenshot({ path: info.outputPath("numbers.png") });
      for (const id of large ? [1, 12, 23, 60] : [1, 12]) {
        const b = await page
          .locator(`[data-number="${id}"] circle`)
          .boundingBox();
        await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2);
        await expect(page.getByRole("dialog")).toHaveAccessibleName(
          `Karte ${id}`,
        );
        await close(page);
      }
      const initial = await page.locator(".board>g").getAttribute("transform");
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 1200);
      await expect
        .poll(async () =>
          Number(await page.locator(".board").getAttribute("data-zoom")),
        )
        .toBeLessThan(0.1);
      const distant = await inspect();
      for (let i = 0; i < distant.length; i++)
        expect(distant[i].width).toBeLessThan(normal[i].width);
      await btn(page, "Übersicht").click();
      await expect(page.locator(".board>g")).toHaveAttribute(
        "transform",
        initial!,
      );
      // Moving via the number moves exactly its card; Fit includes the new left edge.
      const badge = (await page
        .locator('[data-number="1"] circle')
        .boundingBox())!;
      const before = await page
        .locator('[data-card="1"]')
        .getAttribute("data-x");
      await page.mouse.move(
        badge.x + badge.width / 2,
        badge.y + badge.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        badge.x + badge.width / 2 - 25,
        badge.y + badge.height / 2 + 15,
        { steps: 5 },
      );
      await page.mouse.up();
      expect(
        await page.locator('[data-card="1"]').getAttribute("data-x"),
      ).not.toBe(before);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await btn(page, "Übersicht").click();
      await expect
        .poll(async () =>
          (await inspect()).every((n) => n.fullyVisible && n.outside),
        )
        .toBe(true);
      await info.attach("number-geometry.json", {
        body: JSON.stringify({ normal, distant }, null, 2),
        contentType: "application/json",
      });
    });

test("220er-Lesefenster: Langtext und Kennung umbrechen; Medien-Lesemaße dokumentiert", async ({
  page,
}, info) => {
  await page.goto(stressUrl);
  await fillTeam(page);
  await btn(page, "Beginnen").click();
  const media = [];
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const id of [1, 2, 3, 4]) {
      await page.locator(`[data-card="${id}"]`).press("Enter");
      await expect(page.locator(".reading p")).toHaveText(
        stressData.cards[id - 1].text,
      );
      const geometry = await page
        .locator("dialog")
        .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
      const img = page.locator(".reading img");
      if (await img.count()) {
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
        media.push(
          await img.evaluate((el: HTMLImageElement) => ({
            viewport: innerWidth,
            alt: el.alt,
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            boxWidth: el.width,
            boxHeight: el.height,
            source16px:
              16 *
              Math.min(
                el.width / el.naturalWidth,
                el.height / el.naturalHeight,
              ),
          })),
        );
      }
      if (width === 768 && id === 3)
        await page.screenshot({ path: info.outputPath("reader-map.png") });
      await close(page);
    }
  }
  await info.attach("reader-media.json", {
    body: JSON.stringify(media, null, 2),
    contentType: "application/json",
  });
});

test("Abgebrochene langsame Kodierung: sofortiger neuer Auftrag wartet sichtbar, nur aktueller Stand, höchstens ein Canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const state = { pending: 0, maxPending: 0, calls: 0, release: () => {} };
    (window as any).encoding = state;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      state.calls++;
      state.pending++;
      state.maxPending = Math.max(state.maxPending, state.pending);
      original.call(
        this,
        (blob) => {
          const done = () => {
            state.pending--;
            callback(blob);
          };
          if (state.calls === 1) state.release = done;
          else done();
        },
        type,
        quality,
      );
    };
  });
  await page.goto(url());
  await fillTeam(page);
  await btn(page, "Beginnen").click();
  await btn(page, "Sichern").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).encoding.pending))
    .toBe(1);
  await close(page);
  await card(page, 1).click();
  await btn(page, "Violett").click();
  await close(page);
  await btn(page, "Sichern").click();
  await expect(page.getByRole("status")).toContainText("vorherige Bildvorgang");
  await expect(
    page.getByRole("link", { name: "Sicherungsbild herunterladen" }),
  ).toHaveCount(0);
  await page.evaluate(() => (window as any).encoding.release());
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible();
  const download = page.waitForEvent("download");
  await link.click();
  const result = restorePng(
    new Uint8Array(await readFile((await (await download).path())!)),
    validateMystery(smallData),
  );
  expect(result.cards.find((c) => c.id === 1)!.color).toBe(4);
  expect(
    await page.evaluate(() => ({
      calls: (window as any).encoding.calls,
      max: (window as any).encoding.maxPending,
    })),
  ).toEqual({ calls: 2, max: 1 });
  expect(
    await page.evaluate(
      () =>
        !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    ),
  ).toBe(true);
});

test("Export validiert den Stand und zeichnet Außen-Nummern sowie benannte Farbfelder", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  const result = await page.evaluate(async () => {
    const { exportBoard } = await import(String("/src/core/export.ts"));
    const { default: m } = await import(String("/src/content/small.json"));
    const { initialWork } = await import(String("/src/core/model.ts"));
    const work = initialWork(m);
    work.categories[4] = "Flächennutzung";
    const texts: any[] = [];
    const arcs: any[] = [];
    const rects: any[] = [];
    const proto = CanvasRenderingContext2D.prototype;
    const text = proto.fillText,
      arc = proto.arc,
      rect = proto.fillRect;
    proto.fillText = function (t, ...args: any[]) {
      texts.push(t);
      return text.call(this, t, args[0], args[1]);
    };
    proto.arc = function (...args: any[]) {
      arcs.push(args);
      return arc.call(this, args[0], args[1], args[2], args[3], args[4]);
    };
    proto.fillRect = function (...args: any[]) {
      rects.push({ color: this.fillStyle, args });
      return rect.call(this, args[0], args[1], args[2], args[3]);
    };
    await exportBoard(work, m, "compact");
    work.edges[0].id = 1000001;
    let rejected = false;
    try {
      await exportBoard(work, m, "compact");
    } catch {
      rejected = true;
    }
    return { rejected, texts, arcs, rects, cards: work.cards };
  });
  expect(result.rejected).toBe(true);
  expect(result.texts).toContain("Violett – Flächennutzung");
  expect(result.texts).not.toContain("5: Flächennutzung");
  expect(
    result.rects.some((r: any) => r.color === "#eadfea" && r.args[2] === 18),
  ).toBe(true);
  expect(result.arcs).toHaveLength(12);
  result.arcs.forEach((a: number[], i: number) => {
    expect(a[0] + a[2]).toBeLessThan(result.cards[i].x);
    expect(a[1] + a[2]).toBeLessThan(result.cards[i].y);
  });
});
