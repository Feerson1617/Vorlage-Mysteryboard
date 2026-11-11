import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import small from "../../src/content/small.json" with { type: "json" };
import largeData from "../../src/content/large.json" with { type: "json" };
import { initialWork, validateMystery, withTeam } from "../../src/core/model";
import { restorePng } from "../../src/core/png";
import { TEST_TEAM } from "./team-helpers";
test.use({ hasTouch: true });

const artifact = (large = false) =>
  `http://localhost:5174/artifacts/MysteryBoard-${large ? "umfangreich" : "klein"}.html`;
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const close = (page: Page) => button(page, "Schließen").click();
async function start(page: Page, large = false) {
  await page.goto(artifact(large));
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill(TEST_TEAM);
  await button(page, "Beginnen").click();
  await expect(page.locator("[data-card]")).toHaveCount(large ? 60 : 12);
}
async function point(page: Page, selector: string) {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function instrument(page: Page) {
  await page.evaluate(() => {
    const state = { events: [] as unknown[], opened: [] as string[] };
    (window as any).r1 = state;
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      state.opened.push(this.getAttribute("aria-label")!);
      state.events.push({
        type: "dialog-open",
        title: this.getAttribute("aria-label"),
      });
      return show.call(this);
    };
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "touchstart",
      "touchend",
      "click",
    ])
      window.addEventListener(
        type,
        (e) => {
          const p = e as PointerEvent;
          state.events.push({
            type,
            pointerType: p.pointerType,
            pointerId: p.pointerId,
            x: p.clientX,
            y: p.clientY,
            trusted: e.isTrusted,
            detail: p.detail,
            eventClass: e.constructor.name,
            target:
              (e.target as Element)
                .closest("[data-card],[data-number],[data-edge-label],button")
                ?.getAttribute("aria-label") ?? (e.target as Element).tagName,
          });
        },
        true,
      );
  });
}
// Deliberately dispatch PointerEvents only, never a click. Synthetic pointer IDs
// are not registered with the browser, so emulate only capture bookkeeping.
async function syntheticCapture(page: Page) {
  await page.evaluate(() => {
    const svg = document.querySelector(".board") as SVGSVGElement;
    const held = new Set<number>();
    svg.setPointerCapture = (id) => {
      held.add(id);
    };
    svg.hasPointerCapture = (id) => held.has(id);
    svg.releasePointerCapture = (id) => {
      held.delete(id);
    };
  });
}
async function pointer(
  page: Page,
  type: string,
  p: { x: number; y: number },
  id = 101,
  pointerType = "touch",
) {
  await page.evaluate(
    ({ type, p, id, pointerType }) => {
      const target =
        type === "pointerdown"
          ? document.elementFromPoint(p.x, p.y)!
          : document.querySelector(".board")!;
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType,
          pointerId: id,
          isPrimary: true,
          clientX: p.x,
          clientY: p.y,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    },
    { type, p, id, pointerType },
  );
}
async function noClickTap(page: Page, selector: string, id = 101) {
  const p = await point(page, selector);
  await pointer(page, "pointerdown", p, id);
  await pointer(page, "pointerup", p, id);
  return p;
}
const referenceTips = (large: boolean) => [
  { selector: '[data-card="1"] > rect', dialog: "Karte 1" },
  { selector: '[data-number="12"] circle', dialog: "Karte 12" },
  { selector: '[data-edge-label="1"]', dialog: "Verbindung 1 und 2" },
  {
    selector: `[data-card="${large ? 60 : 12}"] > rect`,
    dialog: `Karte ${large ? 60 : 12}`,
  },
  { selector: '[data-number="1"] circle', dialog: "Karte 1" },
];
for (const large of [false, true])
  test(`R1 ohne click: fünf Referenztipps ${large ? "60" : "12"} Karten öffnen genau einmal`, async ({
    page,
  }, info) => {
    await start(page, large);
    await instrument(page);
    await syntheticCapture(page);
    for (const [i, t] of referenceTips(large).entries()) {
      await noClickTap(page, t.selector, 101 + i);
      await expect(page.getByRole("dialog")).toHaveAccessibleName(t.dialog);
      expect(await page.evaluate(() => (window as any).r1.opened.length)).toBe(
        i + 1,
      );
      await close(page);
    }
    const trace = await page.evaluate(() => (window as any).r1);
    expect(
      trace.events.filter(
        (e: any) => e.type === "pointerup" && e.pointerType === "touch",
      ),
    ).toHaveLength(5);
    expect(
      trace.events.filter(
        (e: any) => e.type === "click" && e.pointerType === "touch",
      ),
    ).toHaveLength(0);
    await info.attach("no-click-trace.json", {
      body: JSON.stringify(trace, null, 2),
      contentType: "application/json",
    });
  });

for (const large of [false, true])
  test(`R1 native Touchfolge und Offline-Sicherung: fünf Tipps ${large ? 60 : 12} Karten`, async ({
    page,
    context,
  }, info) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.url() !== artifact(large))
        requests.push(r.url());
    });
    await page.goto(artifact(large));
    await context.setOffline(true);
    await page
      .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
      .fill(TEST_TEAM);
    await button(page, "Beginnen").click();
    await instrument(page);
    for (const [i, t] of referenceTips(large).entries()) {
      const p = await point(page, t.selector);
      await page.touchscreen.tap(p.x, p.y);
      await expect(page.getByRole("dialog")).toHaveAccessibleName(t.dialog);
      expect(await page.evaluate(() => (window as any).r1.opened.length)).toBe(
        i + 1,
      );
      await close(page);
    }
    const trace = await page.evaluate(() => (window as any).r1);
    expect(trace.opened).toEqual(referenceTips(large).map((t) => t.dialog));
    await info.attach("native-trace.json", {
      body: JSON.stringify(trace, null, 2),
      contentType: "application/json",
    });
    await button(page, "Sichern").click();
    const link = page.getByRole("link", {
      name: "Sicherungsbild herunterladen",
    });
    await expect(link).toBeVisible();
    const event = page.waitForEvent("download");
    await link.click();
    const bytes = await readFile((await (await event).path())!);
    const mystery = validateMystery(large ? largeData : small);
    expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(
      withTeam(initialWork(mystery), TEST_TEAM),
    );
    await close(page);
    await button(page, "Menü").click();
    await button(page, "Fortsetzen").click();
    await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles({
      name: "offline.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[data-card]")).toHaveCount(large ? 60 : 12);
    expect(requests).toEqual([]);
  });

async function lateClick(
  page: Page,
  p: { x: number; y: number },
  id: number,
  legacy = false,
  selector?: string,
) {
  return page.evaluate(
    ({ p, id, legacy, selector }) => {
      const target = selector
        ? document.querySelector(selector)!
        : document.elementFromPoint(p.x, p.y)!;
      const options = {
        bubbles: true,
        cancelable: true,
        clientX: p.x,
        clientY: p.y,
        button: 0,
        detail: 1,
      };
      const click = legacy
        ? new MouseEvent("click", options)
        : new PointerEvent("click", {
            ...options,
            pointerType: "touch",
            pointerId: id,
            isPrimary: true,
          });
      return target.dispatchEvent(click);
    },
    { p, id, legacy, selector },
  );
}
for (const legacy of [false, true])
  test(`R1 verspäteter ${legacy ? "MouseEvent" : "PointerEvent"}-Klick trifft keinen neuen Löschknopf; bewusster Tipp löscht`, async ({
    page,
  }, info) => {
    await start(page);
    await syntheticCapture(page);
    await instrument(page);
    // Align the visible label with the delete button that will appear there.
    await page.locator('[data-edge="1"]').press("Enter");
    const b = (await button(page, "Verbindung löschen").boundingBox())!;
    const destination = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await close(page);
    const label = await point(page, '[data-edge-label="1"]');
    const pan = { x: 8, y: 810 };
    await pointer(page, "pointerdown", pan, 90);
    await pointer(
      page,
      "pointermove",
      {
        x: pan.x + destination.x - label.x,
        y: pan.y + destination.y - label.y,
      },
      90,
    );
    await pointer(
      page,
      "pointerup",
      {
        x: pan.x + destination.x - label.x,
        y: pan.y + destination.y - label.y,
      },
      90,
    );
    const p = await noClickTap(page, '[data-edge-label="1"]', 111);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    expect(
      await page.evaluate(
        (p) => document.elementFromPoint(p.x, p.y)?.textContent,
        p,
      ),
    ).toContain("Verbindung löschen");
    const count = await page.evaluate(() => (window as any).r1.opened.length);
    // A real delay is part of this test, never a production suppression window.
    await page.waitForTimeout(350);
    expect(await lateClick(page, p, 111, legacy)).toBe(false);
    expect(await lateClick(page, p, 111, legacy)).toBe(false);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    await expect(page.locator("[data-edge]")).toHaveCount(9);
    expect(await page.evaluate(() => (window as any).r1.opened.length)).toBe(
      count,
    );
    await button(page, "Verbindung löschen").tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('[data-edge="1"]')).toHaveCount(0);
    await expect(page.locator("[data-edge]")).toHaveCount(8);
    // Another old click cannot reopen a dialog after the intentional deletion.
    expect(await lateClick(page, p, 111, legacy)).toBe(false);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await info.attach("delayed-click-trace.json", {
      body: JSON.stringify(
        await page.evaluate(() => (window as any).r1),
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

test("R1 alter Klick während eines neuen Button-Tipps wird verworfen, dessen eigener Klick bleibt wirksam", async ({
  page,
}) => {
  await start(page);
  await syntheticCapture(page);
  await instrument(page);
  await noClickTap(page, '[data-card="1"] > rect', 201);
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  const p = await point(page, 'dialog button[aria-label="Schließen"]');
  await page
    .locator('dialog button[aria-label="Schließen"]')
    .dispatchEvent("pointerdown", {
      pointerId: 202,
      pointerType: "touch",
      isPrimary: true,
      clientX: p.x,
      clientY: p.y,
      button: 0,
      bubbles: true,
    });
  expect(await lateClick(page, p, 201)).toBe(false);
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  await page
    .locator('dialog button[aria-label="Schließen"]')
    .dispatchEvent("pointerup", {
      pointerId: 202,
      pointerType: "touch",
      isPrimary: true,
      clientX: p.x,
      clientY: p.y,
      button: 0,
      bubbles: true,
    });
  expect(await lateClick(page, p, 201)).toBe(false);
  expect(await lateClick(page, p, 202)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Rapid independent taps cannot be swallowed by a time-based cooldown.
  for (let i = 0; i < 3; i++) {
    await noClickTap(page, '[data-number="12"] circle', 210 + i);
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 12");
    await button(page, "Schließen").tap();
  }
  expect(await page.evaluate(() => (window as any).r1.opened)).toEqual([
    "Karte 1",
    "Karte 12",
    "Karte 12",
    "Karte 12",
  ]);
});

const state = (page: Page) =>
  page
    .locator("[data-card]")
    .evaluateAll((cards) =>
      cards.map((c) => [
        c.getAttribute("data-card"),
        c.getAttribute("data-x"),
        c.getAttribute("data-y"),
      ]),
    );
test("R1 Negativgesten: Ziehen, Pan, Pinch, versetztes Loslassen, Cancel und Capture-Verlust öffnen nie einen Dialog", async ({
  page,
}, info) => {
  await start(page);
  await syntheticCapture(page);
  await instrument(page);
  const original = await state(page),
    p = await point(page, '[data-card="1"] > rect');
  const q = { x: p.x + 40, y: p.y + 25 };
  const noDialog = async () => {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).r1.opened)).toEqual([]);
  };
  // Release far away without a preceding pointermove must not become a tap.
  await pointer(page, "pointerdown", p, 301);
  await pointer(page, "pointerup", q, 301);
  expect(await lateClick(page, p, 301)).toBe(false);
  await noDialog();
  expect(await state(page)).toEqual(original);
  for (const cancel of ["pointercancel", "lostpointercapture"]) {
    await pointer(page, "pointerdown", p, 302);
    await pointer(page, "pointermove", q, 302);
    await pointer(page, cancel, q, 302);
    await pointer(page, "pointerup", p, 302);
    await lateClick(page, p, 302);
    await noDialog();
    expect(await state(page)).toEqual(original);
  }
  await pointer(page, "pointerdown", p, 303);
  await pointer(page, "pointermove", q, 303);
  await pointer(page, "pointerup", q, 303);
  await lateClick(page, q, 303);
  await noDialog();
  expect(await state(page)).not.toEqual(original);
  await button(page, "Rückgängig").click();
  expect(await state(page)).toEqual(original);
  const view = await page.locator(".board>g").getAttribute("transform");
  await pointer(page, "pointerdown", { x: 8, y: 810 }, 304);
  await pointer(page, "pointermove", { x: 38, y: 780 }, 304);
  await pointer(page, "pointerup", { x: 38, y: 780 }, 304);
  await noDialog();
  expect(await page.locator(".board>g").getAttribute("transform")).not.toBe(
    view,
  );
  await button(page, "Übersicht").click();
  await expect(page.locator(".board>g")).toHaveAttribute("transform", view!);
  // Staggered fingers, including a third finger while one remains held.
  await pointer(page, "pointerdown", p, 305);
  await pointer(page, "pointerdown", { x: p.x + 100, y: p.y }, 306);
  await pointer(page, "pointermove", { x: p.x + 160, y: p.y }, 306);
  await pointer(page, "pointerup", p, 305);
  await pointer(page, "pointerdown", { x: p.x - 30, y: p.y }, 307);
  await pointer(page, "pointerup", { x: p.x + 160, y: p.y }, 306);
  await pointer(page, "pointermove", { x: p.x - 60, y: p.y }, 307);
  await pointer(page, "pointerup", { x: p.x - 60, y: p.y }, 307);
  await lateClick(page, p, 307);
  await noDialog();
  expect(await state(page)).toEqual(original);
  await info.attach("negative-gesture-trace.json", {
    body: JSON.stringify(
      await page.evaluate(() => (window as any).r1),
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("R1 Verbindungswahl: Mehrfinger, Abbruch und nachlaufende Klicks wählen keine zweite Karte", async ({
  page,
}) => {
  await start(page);
  await syntheticCapture(page);
  await instrument(page);
  await noClickTap(page, '[data-number="1"] circle', 401);
  const connect = button(page, "Mit einer Karte verbinden");
  const b = (await connect.boundingBox())!;
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  expect(await lateClick(page, p, 401)).toBe(false);
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  await connect.tap();
  await expect(page.locator(".connection-prompt")).toBeVisible();
  const q = await point(page, '[data-card="12"] > rect');
  await pointer(page, "pointerdown", q, 402);
  await pointer(page, "pointerdown", { x: q.x + 40, y: q.y }, 403);
  await pointer(page, "pointerup", q, 402);
  await pointer(page, "pointerup", { x: q.x + 40, y: q.y }, 403);
  await lateClick(page, q, 403);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button(page, "Abbrechen").tap();
  expect(await lateClick(page, q, 403)).toBe(false);
  await expect(page.locator(".connection-prompt")).toHaveCount(0);
  await expect(page.locator("[data-edge]")).toHaveCount(9);
  expect(await page.evaluate(() => (window as any).r1.opened)).toEqual([
    "Karte 1",
  ]);
  // A fresh deliberate connection still works.
  await noClickTap(page, '[data-card="1"] > rect', 404);
  await connect.tap();
  await noClickTap(page, '[data-card="12"] > rect', 405);
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Verbindung 1 und 12",
  );
});

test("R1 Maus, Enter, Leertaste, Fokus und programmatische Dateiauswahl bleiben bedienbar", async ({
  page,
}) => {
  await start(page);
  await instrument(page);
  await page.locator('[data-card="1"] > rect').click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  await close(page);
  for (const key of ["Enter", "Space"]) {
    await page.locator('[data-card="12"]').focus();
    await page.keyboard.press(key);
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 12");
    await button(page, "Schließen").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-card="12"]')).toBeFocused();
    await page.locator('[data-edge="1"]').press(key);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    await close(page);
  }
  expect(await page.evaluate(() => (window as any).r1.opened.length)).toBe(5);
  await button(page, "Menü").click();
  await button(page, "Fortsetzen").click();
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Sicherungsbild auswählen").click();
  await (await chooser).setFiles([]);
  await expect(page.getByRole("dialog")).toBeVisible();
  await close(page);
});
