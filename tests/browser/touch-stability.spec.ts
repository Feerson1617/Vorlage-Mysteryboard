import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { button } from "./authoring-helpers";

const prefix = process.env.TOUCH_BASELINE
  ? "artifacts/delivery/pdf-regions/"
  : "artifacts/";
test("Touch und Tastatur: Undo einer unbeteiligten Verbindung während eines Drags verwirft nur die Vorschau", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    }),
    page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.locator('[data-number="5"]').click();
  await button(page, "Mit einer Karte verbinden").click();
  await page.locator('[data-number="6"]').click();
  await page
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill("während anderer Geste zurücknehmen");
  await button(page, "Übernehmen").click();
  const before = await cards(page),
    grip = await pick(page),
    session = await context.newCDPSession(page);
  expect(grip.id).toBe(1);
  await button(page, "Rückgängig").focus();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: grip.x, y: grip.y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: grip.x + 31, y: grip.y + 17 }],
  });
  await frame(page);
  await button(page, "Rückgängig").press("Enter");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await frame(page);
  await evidence(page, info, "undo-during-drag", {
    before,
    after: await cards(page),
    errors,
  });
  expect(errors).toEqual([]);
  expect(await cards(page)).toEqual(before);
  await expect(page.locator("[data-edge]")).toHaveCount(0);
  await button(page, "Wiederholen").click();
  await expect(page.locator("[data-edge]")).toHaveCount(1);
  expect(await cards(page)).toEqual(before);
  await context.close();
});
async function open(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__touchEvents = [];
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
    ])
      document.addEventListener(
        type,
        (e) => {
          const p = e as PointerEvent;
          w.__touchEvents.push({
            type,
            id: p.pointerId,
            x: p.clientX,
            y: p.clientY,
            trusted: p.isTrusted,
            time: performance.now(),
          });
          if (type === "pointerdown") w.__activeTouchId = p.pointerId;
        },
        true,
      );
    w.__resizeCallbacks = [];
    const Native = ResizeObserver;
    window.ResizeObserver = class extends Native {
      constructor(cb: ResizeObserverCallback) {
        super(cb);
        w.__resizeCallbacks.push(cb);
      }
    };
  });
  // The old delivery contains the exact baseline universal app, unchanged.
  await page.goto(
    "http://localhost:5174/" + prefix + "MysteryBoard-Universal.html",
  );
  await button(page, "Aufgabe öffnen").click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles("examples/universal/ki-beispiel.mysteryboard");
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Touchprüfung");
  await button(page, "Beginnen").click();
  await expect(page.locator("[data-card='1']")).toBeVisible();
}
async function evidence(
  page: Page,
  info: TestInfo,
  name: string,
  values: unknown,
) {
  const payload = {
    values,
    events: await page.evaluate(() => (window as any).__touchEvents),
  };
  const text = JSON.stringify(payload, null, 2);
  await info.attach(name + ".json", {
    body: text,
    contentType: "application/json",
  });
  if (process.env.TOUCH_EVIDENCE_DIR) {
    await mkdir(process.env.TOUCH_EVIDENCE_DIR, { recursive: true });
    await writeFile(join(process.env.TOUCH_EVIDENCE_DIR, name + ".json"), text);
  }
}
async function position(page: Page, id = 1) {
  return page.locator(`[data-card='${id}']`).evaluate((node) => {
    const n = node as SVGGElement,
      m = n.getScreenCTM()!,
      r = n.querySelector("rect")!.getBoundingClientRect();
    return {
      x: Number(n.dataset.x),
      y: Number(n.dataset.y),
      z: m.a,
      screenX: m.e,
      screenY: m.f,
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}
const frame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
async function pick(page: Page, preferred?: string) {
  return page.evaluate((preferred) => {
    const board = document.querySelector("svg.board")!.getBoundingClientRect();
    const nodes = [
      ...document.querySelectorAll(preferred || "[data-card] > rect"),
    ];
    for (const n of nodes) {
      const r = n.getBoundingClientRect(),
        id = Number(n.closest("[data-card]")!.getAttribute("data-card"));
      const left = Math.max(r.left, board.left + 36),
        right = Math.min(r.right, board.right - 36),
        top = Math.max(r.top, board.top + 36),
        bottom = Math.min(r.bottom, board.bottom - 36);
      if (left >= right || top >= bottom) continue;
      for (const fx of [0.5, 0.2, 0.8])
        for (const fy of [0.2, 0.5, 0.8]) {
          const x = left + (right - left) * fx,
            y = top + (bottom - top) * fy;
          const target = document.elementFromPoint(x, y);
          if (
            Number(
              target?.closest("[data-card]")?.getAttribute("data-card"),
            ) === id &&
            (!preferred || target?.closest(preferred) === n)
          )
            return { id, x, y, tag: target!.tagName };
        }
    }
    throw new Error("Keine frei sichtbare Kartenfläche gefunden: " + preferred);
  }, preferred);
}
async function cards(page: Page) {
  return page.locator("[data-card]").evaluateAll((nodes) =>
    nodes.map((n) => ({
      id: n.getAttribute("data-card"),
      x: n.getAttribute("data-x"),
      y: n.getAttribute("data-y"),
    })),
  );
}
test("Touch: 50 Moves und pointerup in demselben Task übernehmen die wirkliche Endposition", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  await open(page);
  const before = await position(page),
    x = before.box.x + before.box.width / 2,
    y = before.box.y + Math.min(30, before.box.height / 2);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  await page.evaluate(
    ({ x, y }) => {
      const svg = document.querySelector("svg.board")!;
      const id = (window as any).__activeTouchId;
      for (let i = 1; i <= 50; i++)
        svg.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerId: id,
            pointerType: "touch",
            clientX: x + i * 1.2,
            clientY: y + i * 0.4,
            buttons: 1,
          }),
        );
      svg.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: id,
          pointerType: "touch",
          clientX: x + 67,
          clientY: y + 23,
          button: 0,
        }),
      );
    },
    { x, y },
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const after = await position(page);
  await evidence(page, info, "race-50-moves-release", {
    before,
    after,
    expected: { x: before.x + 67 / before.z, y: before.y + 23 / before.z },
  });
  expect(Math.abs(after.x - before.x - 67 / before.z) * before.z).toBeLessThan(
    0.1,
  );
  expect(Math.abs(after.y - before.y - 23 / before.z) * before.z).toBeLessThan(
    0.1,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button(page, "Rückgängig").click();
  expect((await position(page)).x).toBe(before.x);
  await button(page, "Wiederholen").click();
  expect((await position(page)).x).toBe(after.x);
  await context.close();
});
test("Touch: wiederholte ResizeObserver-Meldung setzt eine aktive Ansicht nicht zurück", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  await open(page);
  const b = (await page.locator("svg.board").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.wheel(0, -350);
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
  const before = await position(page),
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: b.x + 10, y: b.y + b.height - 10 }],
  });
  await page.evaluate(() => {
    for (const cb of (window as any).__resizeCallbacks) cb([], {});
  });
  const after = await position(page);
  await evidence(page, info, "resize-observer-active", { before, after });
  expect(after.z).toBe(before.z);
  expect(after.screenX).toBe(before.screenX);
  expect(after.screenY).toBe(before.screenY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await context.close();
});
test("Touch: zwei abgeschlossene Drags ohne Renderpause behalten beide Änderungen und zwei Undo-Schritte", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    }),
    page = await context.newPage();
  await open(page);
  const before = await position(page),
    grip = await pick(page),
    cdp = await context.newCDPSession(page);
  expect(grip.id).toBe(1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: grip.x, y: grip.y }],
  });
  await page.evaluate(({ x, y }) => {
    const svg = document.querySelector("svg.board")!,
      card = document.querySelector('[data-card="1"] > rect')!;
    const id = (window as any).__activeTouchId;
    const send = (
      target: Element,
      type: string,
      id: number,
      dx: number,
      dy: number,
    ) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: id,
          pointerType: "touch",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: x + dx,
          clientY: y + dy,
        }),
      );
    for (let i = 1; i <= 10; i++) send(svg, "pointermove", id, i * 3, i * 1.5);
    send(svg, "pointerup", id, 30, 15);
    send(card, "pointerdown", 9999, 30, 15);
    for (let i = 1; i <= 10; i++)
      send(svg, "pointermove", 9999, 30 + i * 3, 15 + i * 1.5);
    send(svg, "pointerup", 9999, 60, 30);
  }, grip);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const after = await position(page);
  await evidence(page, info, "two-drags-one-task", { before, after });
  expect(Math.abs((after.x - before.x) * before.z - 60)).toBeLessThan(0.1);
  await button(page, "Rückgängig").click();
  expect(
    Math.abs(((await position(page)).x - before.x) * before.z - 30),
  ).toBeLessThan(0.1);
  await button(page, "Rückgängig").click();
  expect((await position(page)).x).toBe(before.x);
  for (let i = 0; i < 2; i++) await button(page, "Wiederholen").click();
  expect((await position(page)).x).toBe(after.x);
  await context.close();
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
])
  test(`Touch auf Text und Bild ${viewport.width}: über Karten bis zum Bildschirmrand, genau ein Undo`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ hasTouch: true, viewport }),
      page = await context.newPage();
    await open(page);
    const cdp = await context.newCDPSession(page),
      samples: unknown[] = [];
    for (const target of ["[data-card] image", "[data-card] > text"]) {
      await button(page, "Übersicht").click();
      await expect(page.locator("[data-card] image").first()).toBeVisible();
      const grip = await pick(page, target),
        before = await position(page, grip.id),
        all = await cards(page),
        board = (await page.locator("svg.board").boundingBox())!;
      const end = {
        x: board.x + board.width - 3,
        y: Math.min(board.y + board.height - 3, grip.y + 65),
      };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: grip.x, y: grip.y }],
      });
      for (let i = 1; i <= 10; i++) {
        const x = grip.x + ((end.x - grip.x) * i) / 10,
          y = grip.y + ((end.y - grip.y) * i) / 10;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x, y }],
        });
        await frame(page);
        const actual = await position(page, grip.id),
          error = Math.hypot(
            actual.screenX - before.screenX - x + grip.x,
            actual.screenY - before.screenY - y + grip.y,
          );
        samples.push({
          target,
          actualHit: grip.tag,
          move: i,
          finger: { x, y },
          actual,
          errorCssPixels: error,
        });
        expect(error).toBeLessThan(0.2);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const after = await position(page, grip.id);
      expect(
        Math.abs((after.x - before.x) * before.z - end.x + grip.x),
      ).toBeLessThan(0.2);
      await button(page, "Rückgängig").click();
      expect(await cards(page)).toEqual(all);
    }
    await evidence(page, info, `text-bild-rand-${viewport.width}`, samples);
    await context.close();
  });
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
])
  test(`Touch-Stress ${viewport.width}x${viewport.height}: 60 Karten/220 Kanten, 50 Moves, 30 Drags, Pinch, Abbruch und Resize`, async ({
    browser,
  }, info) => {
    test.setTimeout(240000);
    const context = await browser.newContext({ hasTouch: true, viewport }),
      page = await context.newPage();
    await open(page); // installs native event instrumentation
    await page.goto(
      "http://localhost:5174/artifacts/tests/MysteryBoard-Pruefung-220.html",
    );
    await page
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Touchprüfung");
    await button(page, "Beginnen").click();
    await expect(page.locator("[data-card]")).toHaveCount(60);
    await expect(page.locator("[data-edge]")).toHaveCount(220);
    const cdp = await context.newCDPSession(page),
      samples: unknown[] = [];
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
      x?: number,
      y?: number,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: x === undefined ? [] : [{ id: 1, x, y: y! }],
      });
    for (const zoom of [0.15, 0.55, 1.5, 2.8]) {
      const anchor = await pick(page),
        old = Number(await page.locator("svg.board").getAttribute("data-zoom"));
      await page.mouse.move(anchor.x, anchor.y);
      await page.mouse.wheel(0, -Math.log(zoom / old) / 0.0015);
      await frame(page);
      const grip = await pick(page),
        before = await position(page, grip.id);
      await touch("touchStart", grip.x, grip.y);
      for (let i = 1; i <= 50; i++) {
        const dx = Math.sin(i * 0.32) * 27 + i * 0.15,
          dy = Math.sin(i * 0.47) * 18;
        await touch("touchMove", grip.x + dx, grip.y + dy);
        await frame(page);
        const actual = await position(page, grip.id),
          error = Math.hypot(
            actual.screenX - before.screenX - dx,
            actual.screenY - before.screenY - dy,
          );
        samples.push({
          kind: "continuous",
          zoom,
          move: i,
          id: grip.id,
          before,
          startFinger: { x: grip.x, y: grip.y },
          finger: { x: grip.x + dx, y: grip.y + dy },
          actual,
          errorCssPixels: error,
        });
        expect(error).toBeLessThan(0.2);
      }
      const end = await position(page, grip.id);
      await touch("touchEnd");
      await frame(page);
      expect((await position(page, grip.id)).x).toBe(end.x);
      expect((await position(page, grip.id)).y).toBe(end.y);
      // Completed capture loss/cancel for the old pointer cannot undo the edit.
      await page.evaluate(() => {
        const id = (window as any).__activeTouchId,
          el = document.querySelector("svg.board")!;
        for (const type of ["pointercancel", "lostpointercapture"])
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: id,
              pointerType: "touch",
            }),
          );
      });
      expect((await position(page, grip.id)).x).toBe(end.x);
      await button(page, "Rückgängig").click();
      expect((await position(page, grip.id)).x).toBe(before.x);
      await button(page, "Übersicht").click();
    }
    const initial = await cards(page);
    for (let i = 1; i <= 30; i++) {
      const grip = await pick(page),
        before = await position(page, grip.id),
        dx = i % 2 ? 19 : -19,
        dy = i % 2 ? 9 : -9;
      await touch("touchStart", grip.x, grip.y);
      await touch("touchMove", grip.x + dx / 2, grip.y + dy / 2);
      await touch("touchMove", grip.x + dx, grip.y + dy);
      await touch("touchEnd");
      await frame(page);
      const after = await position(page, grip.id),
        error = Math.hypot(
          (after.x - before.x) * before.z - dx,
          (after.y - before.y) * before.z - dy,
        );
      samples.push({
        kind: "successive",
        drag: i,
        id: grip.id,
        before,
        after,
        startFinger: { x: grip.x, y: grip.y },
        finger: { x: grip.x + dx, y: grip.y + dy },
        errorCssPixels: error,
      });
      expect(error).toBeLessThan(0.2);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const final = await cards(page);
    for (let i = 0; i < 30; i++) await button(page, "Rückgängig").click();
    expect(await cards(page)).toEqual(initial);
    for (let i = 0; i < 30; i++) await button(page, "Wiederholen").click();
    expect(await cards(page)).toEqual(final);
    // Real OS cancel and actual capture release both discard the whole drag.
    for (const kind of ["cancel", "capture-loss"]) {
      const grip = await pick(page),
        baseline = await cards(page);
      await touch("touchStart", grip.x, grip.y);
      await touch("touchMove", grip.x + 22, grip.y + 15);
      await frame(page);
      if (kind === "cancel") await touch("touchCancel");
      else {
        await page.evaluate(() => {
          const s = document.querySelector("svg.board") as SVGSVGElement;
          s.releasePointerCapture((window as any).__activeTouchId);
        });
        await touch("touchMove", grip.x + 30, grip.y + 19);
        await touch("touchEnd");
      }
      await frame(page);
      samples.push({
        kind,
        unchanged:
          JSON.stringify(await cards(page)) === JSON.stringify(baseline),
      });
      expect(await cards(page)).toEqual(baseline);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    // Two fingers consume the remaining finger, then a fresh drag works again.
    const rect = (await page.locator("svg.board").boundingBox())!,
      cx = rect.x + rect.width / 2,
      cy = rect.y + rect.height / 2,
      baseline = await cards(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 1, x: cx - 25, y: cy },
        { id: 2, x: cx + 25, y: cy },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { id: 1, x: cx - 55, y: cy },
        { id: 2, x: cx + 55, y: cy },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ id: 2, x: cx + 55, y: cy }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 2, x: cx + 65, y: cy + 10 }],
    });
    await touch("touchEnd");
    expect(await cards(page)).toEqual(baseline);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await button(page, "Übersicht").click();
    const grip = await pick(page),
      before = await position(page, grip.id);
    await touch("touchStart", grip.x, grip.y);
    await touch("touchMove", grip.x + 25, grip.y + 12);
    await frame(page);
    const during = await position(page, grip.id);
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
    await frame(page);
    const resized = await position(page, grip.id);
    const cancelled = await page.evaluate(() =>
      (window as any).__touchEvents
        .slice(-5)
        .some((e: any) => e.type === "pointercancel"),
    );
    if (!cancelled) {
      expect(Math.abs(resized.screenX - during.screenX)).toBeLessThan(0.2);
      expect(Math.abs(resized.screenY - during.screenY)).toBeLessThan(0.2);
      await touch("touchMove", grip.x + 31, grip.y + 17);
    }
    await touch("touchEnd");
    const after = await position(page, grip.id);
    samples.push({
      kind: "pinch-then-drag-and-viewport-rotation",
      before,
      during,
      resized,
      after,
      cancelled,
    });
    if (cancelled) expect(after.x).toBe(before.x);
    else
      expect(Math.abs((after.x - before.x) * before.z - 31)).toBeLessThan(0.2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await page.evaluate(() => ({
        x: scrollX,
        y: scrollY,
        scale: visualViewport!.scale,
      })),
    ).toEqual({ x: 0, y: 0, scale: 1 });
    await evidence(page, info, `stress-${viewport.width}`, samples);
    const screenshot = info.outputPath(`pfeile-touch-${viewport.width}.png`);
    await page.screenshot({ path: screenshot });
    if (process.env.TOUCH_EVIDENCE_DIR)
      await writeFile(
        join(
          process.env.TOUCH_EVIDENCE_DIR,
          `pfeile-touch-${viewport.width}.png`,
        ),
        await page.screenshot(),
      );
    await context.close();
  });
