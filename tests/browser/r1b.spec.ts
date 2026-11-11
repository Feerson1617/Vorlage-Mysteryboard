import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { initialWork, validateMystery, withTeam } from "../../src/core/model";
import { restorePng } from "../../src/core/png";
import small from "../../src/content/small.json" with { type: "json" };
import large from "../../src/content/large.json" with { type: "json" };
import { TEST_TEAM } from "./team-helpers";

test.use({ hasTouch: true });
const url = (big = false) =>
  `http://localhost:5174/artifacts/MysteryBoard-${big ? "umfangreich" : "klein"}.html`;
const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function start(page: Page, big = false) {
  await page.goto(url(big));
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill(TEST_TEAM);
  await btn(page, "Beginnen").tap();
  await expect(page.locator("[data-card]")).toHaveCount(big ? 60 : 12);
}
async function instrument(page: Page) {
  await page.evaluate(() => {
    const state = {
      events: [] as any[],
      actions: [] as string[],
      opened: [] as string[],
    };
    (window as any).r1b = state;
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      state.opened.push(this.getAttribute("aria-label")!);
      return show.call(this);
    };
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "touchcancel",
      "click",
    ]) {
      window.addEventListener(
        type,
        (e) => {
          const p = e as PointerEvent;
          const row = {
            type,
            target:
              (e.target as Element).getAttribute("aria-label") ||
              (e.target as Element).textContent?.slice(0, 65),
            pointerType: p.pointerType,
            pointerId: p.pointerId,
            detail: p.detail,
            trusted: e.isTrusted,
            defaultPrevented: e.defaultPrevented,
            before:
              document
                .querySelector("dialog[open]")
                ?.getAttribute("aria-label") ?? null,
            afterDispatchSnapshot: null as string | null,
          };
          state.events.push(row);
          queueMicrotask(() => {
            row.defaultPrevented = e.defaultPrevented;
            row.afterDispatchSnapshot =
              document
                .querySelector("dialog[open]")
                ?.getAttribute("aria-label") ?? null;
          });
        },
        true,
      );
    }
    document.addEventListener(
      "click",
      (e) => {
        const target = (e.target as Element).closest("button, a");
        if (target)
          state.actions.push(
            target.getAttribute("aria-label") || target.textContent!.trim(),
          );
      },
      true,
    );
  });
}
async function replay(
  target: Locator,
  type: string,
  id: number,
  pointerType = "touch",
  dx = 0,
) {
  return target.evaluate(
    (el, { type, id, pointerType, dx }) => {
      const b = el.getBoundingClientRect();
      const e = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: id,
        pointerType,
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
        detail: type === "click" ? 1 : 0,
        clientX: b.x + b.width / 2 + dx,
        clientY: b.y + b.height / 2,
      });
      el.dispatchEvent(e);
      return { defaultPrevented: e.defaultPrevented };
    },
    { type, id, pointerType, dx },
  );
}
// A React commit may follow the event microtask. Record the settled dialog
// separately from the event-dispatch snapshot, without conflating the two.
const trace = (page: Page) =>
  page.evaluate(() => ({
    ...(window as any).r1b,
    actionCount: (window as any).r1b.actions.length,
    dialogAfterSequence:
      document.querySelector("dialog[open]")?.getAttribute("aria-label") ??
      null,
  }));
for (const [name, downId, clickId, clickType] of [
  ["WebKit touch 0 → mouse 1", 0, 1, "mouse"],
  ["andere IDs touch 17 → mouse 83", 17, 83, "mouse"],
  ["andere IDs gleicher Typ touch 17 → touch 83", 17, 83, "touch"],
  ["gleiche IDs touch 17 → touch 17", 17, 17, "touch"],
] as const)
  for (const action of ["Schließen", "Verbindung löschen", "Menü"]) {
    test(`R1b Replay ${name}: ${action} genau einmal`, async ({
      page,
    }, info) => {
      await start(page);
      if (action === "Verbindung löschen")
        await page.locator('[data-edge-label="1"]').tap();
      else {
        await page.locator('[data-card="1"] > rect').tap();
        if (action === "Menü") await btn(page, "Schließen").tap();
      }
      await instrument(page);
      const target = btn(page, action);
      await replay(target, "pointerdown", downId);
      await replay(target, "pointerup", downId);
      const click = await replay(target, "click", clickId, clickType);
      await info.attach("id-switch-replay.json", {
        body: JSON.stringify(await trace(page), null, 2),
        contentType: "application/json",
      });
      expect(click.defaultPrevented).toBe(false);
      expect((await trace(page)).actions).toEqual([action]);
      if (action === "Menü")
        await expect(page.getByRole("dialog")).toHaveAccessibleName("Menü");
      else await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[data-edge]")).toHaveCount(
        action === "Verbindung löschen" ? 8 : 9,
      );
    });
  }

// Use this file with MB_ENGINE=webkit once the matching browser is installed.
if (process.env.MB_ENGINE === "webkit")
  test.use({ browserName: "webkit", launchOptions: {} });
const diagnostics = new WeakMap<Page, string[]>();
function monitor(page: Page) {
  const messages: string[] = [];
  diagnostics.set(page, messages);
  page.on("console", (m) => {
    if (["warning", "error"].includes(m.type()))
      messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  return messages;
}
test.beforeEach(async ({ page }) => {
  monitor(page);
});
test.afterEach(async ({ page, browser }, info) => {
  const messages = diagnostics.get(page)!;
  await info.attach("browser-diagnostics.json", {
    body: JSON.stringify(
      {
        engine: process.env.MB_ENGINE || "chromium",
        version: browser.version(),
        messages,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(messages).toEqual([]);
});

for (const big of [false, true]) {
  test(`R1b native Referenzfolge ${big ? 60 : 12}: fünf Ziele und jedes Schließen per Finger`, async ({
    page,
    context,
  }, info) => {
    await start(page, big);
    await context.setOffline(true);
    await instrument(page);
    const tips = [
      ['[data-card="1"] > rect', "Karte 1"],
      ['[data-number="12"] circle', "Karte 12"],
      ['[data-edge-label="1"]', "Verbindung 1 und 2"],
      [`[data-card="${big ? 60 : 12}"] > rect`, `Karte ${big ? 60 : 12}`],
      ['[data-number="1"] circle', "Karte 1"],
    ];
    for (const [selector, title] of tips) {
      await page.locator(selector).tap();
      await expect(page.getByRole("dialog")).toHaveAccessibleName(title);
      await btn(page, "Schließen").tap();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const result = await trace(page);
    expect(result.opened).toEqual(tips.map((t) => t[1]));
    expect(result.actions).toEqual(Array(5).fill("Schließen"));
    await info.attach("native-open-close.json", {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    });
  });
}

for (const legacy of [false, true])
  for (const action of ["Schließen", "Übernehmen", "Verbindung löschen"]) {
    test(`R1b 450ms alter ${legacy ? "MouseEvent" : "PointerEvent"}-Klick auf ${action} ohne neue Geste bleibt wirkungslos`, async ({
      page,
    }, info) => {
      await start(page);
      await instrument(page);
      await page.locator('[data-edge-label="1"]').tap();
      const target = btn(page, action);
      await page.waitForTimeout(450); // Test delay, never an application cooldown.
      const prevented = await target.evaluate((el, legacy) => {
        const b = el.getBoundingClientRect();
        const init = {
          bubbles: true,
          cancelable: true,
          detail: 1,
          clientX: b.x + b.width / 2,
          clientY: b.y + b.height / 2,
        };
        const e = legacy
          ? new MouseEvent("click", init)
          : new PointerEvent("click", {
              ...init,
              pointerType: "mouse",
              pointerId: 1,
            });
        el.dispatchEvent(e);
        return e.defaultPrevented;
      }, legacy);
      expect(prevented).toBe(true);
      expect((await trace(page)).actions).toEqual([]);
      await expect(page.getByRole("dialog")).toHaveAccessibleName(
        "Verbindung 1 und 2",
      );
      await expect(page.locator("[data-edge]")).toHaveCount(9);
      await target.tap();
      expect((await trace(page)).actions).toEqual([action]);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[data-edge]")).toHaveCount(
        action === "Verbindung löschen" ? 8 : 9,
      );
      await info.attach("delayed-click.json", {
        body: JSON.stringify(await trace(page), null, 2),
        contentType: "application/json",
      });
    });
  }

test("R1b ungültige Buttonfolgen hinterlassen keine Klickfreigabe; nächste bewusste Geste funktioniert", async ({
  page,
}, info) => {
  await start(page);
  await instrument(page);
  const cases = [
    "moved-return",
    "displaced-up",
    "pointercancel",
    "lostpointercapture",
    "touchcancel",
    "two-fingers",
    "different-target",
  ];
  for (const kind of cases) {
    await page.locator('[data-card="1"] > rect').tap();
    const close = btn(page, "Schließen"),
      green = btn(page, "Grün");
    await replay(close, "pointerdown", 51);
    if (kind === "moved-return")
      await replay(close, "pointermove", 51, "touch", 30);
    if (["pointercancel", "lostpointercapture"].includes(kind))
      await replay(close, kind, 51);
    if (kind === "touchcancel")
      await close.dispatchEvent("touchcancel", {
        touches: [],
        changedTouches: [],
      });
    if (kind === "two-fingers") await replay(green, "pointerdown", 52);
    await replay(
      kind === "different-target" ? green : close,
      "pointerup",
      51,
      "touch",
      kind === "displaced-up" ? 30 : 0,
    );
    if (kind === "two-fingers") await replay(green, "pointerup", 52);
    expect(
      (await replay(close, "click", 77, "mouse")).defaultPrevented,
      kind,
    ).toBe(true);
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
    await close.tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect((await trace(page)).actions).toEqual(cases.map(() => "Schließen"));
  await info.attach("invalid-button-gestures.json", {
    body: JSON.stringify(await trace(page), null, 2),
    contentType: "application/json",
  });
});

test("R1b touchcancel auf Board verwirft Auswahl; neuer Tipp ohne click öffnet genau einmal", async ({
  page,
}, info) => {
  await start(page);
  await instrument(page);
  await page.evaluate(() => {
    const svg = document.querySelector(".board") as SVGSVGElement,
      held = new Set<number>();
    svg.setPointerCapture = (id) => {
      held.add(id);
    };
    svg.hasPointerCapture = (id) => held.has(id);
    svg.releasePointerCapture = (id) => {
      held.delete(id);
    };
  });
  const card = page.locator('[data-card="1"] > rect');
  await replay(card, "pointerdown", 71);
  await card.dispatchEvent("touchcancel", { touches: [], changedTouches: [] });
  await replay(card, "pointerup", 71);
  expect((await replay(card, "click", 1, "mouse")).defaultPrevented).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await replay(card, "pointerdown", 72);
  await replay(card, "pointerup", 72);
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  expect((await trace(page)).opened).toEqual(["Karte 1"]);
  await btn(page, "Schließen").tap();
  await info.attach("touchcancel-no-click.json", {
    body: JSON.stringify(await trace(page), null, 2),
    contentType: "application/json",
  });
});

test("R1b Schutz bleibt auf die Anwendung begrenzt und erlaubt keine ersetzten Dialogbuttons", async ({
  page,
}) => {
  await start(page);
  await page.locator('[data-card="1"] > rect').tap();
  const close = btn(page, "Schließen");
  await replay(close, "pointerdown", 81);
  await replay(close, "pointerup", 81);
  await close.evaluate((el) => {
    (window as any).r1bOld = el;
    el.replaceWith(el.cloneNode(true));
  });
  expect((await replay(close, "click", 1, "mouse")).defaultPrevented).toBe(
    true,
  );
  await close.evaluate((el) => {
    el.replaceWith((window as any).r1bOld);
  });
  await close.tap();
  const outside = await page.evaluate(() => {
    const el = document.createElement("button");
    document.body.append(el);
    let actions = 0;
    el.addEventListener("click", () => actions++);
    const e = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    });
    el.dispatchEvent(e);
    el.remove();
    return { prevented: e.defaultPrevented, actions };
  });
  expect(outside).toEqual({ prevented: false, actions: 1 });
  await btn(page, "Menü").tap();
  await btn(page, "Hinweise").tap();
  await btn(page, "Schließen").tap();
  await btn(page, "Übersicht").tap();
  await page.locator('[data-card="1"]').press("Enter");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte 1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-card="1"]')).toBeFocused();
});

async function download(page: Page, compact = false, needsTeam = false) {
  if (compact) {
    await btn(page, "Menü").tap();
    await btn(page, "Kleineres Sicherungsbild").tap();
  } else await btn(page, "Sichern").tap();
  if (needsTeam) {
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await page
      .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
      .fill(TEST_TEAM);
    await btn(page, "Übernehmen").tap();
  }
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const event = page.waitForEvent("download");
  await link.tap();
  return readFile((await (await event).path())!);
}
async function importPng(page: Page, bytes: Buffer) {
  await btn(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await btn(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({ name: "Original.png", mimeType: "image/png", buffer: bytes });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
for (const big of [false, true]) {
  test(`R1b durchgehender Touch-Arbeitsablauf ${big ? "60/90" : "12/9"} mit Original-PNG und neuer Sitzung`, async ({
    page,
    context,
    browser,
  }, info) => {
    test.setTimeout(120000);
    const requests: string[] = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.url() !== url(big))
        requests.push(r.url());
    });
    await start(page, big);
    await context.setOffline(true);
    const mystery = validateMystery(big ? large : small),
      expected = withTeam(initialWork(mystery), TEST_TEAM);
    const initialEdges = expected.edges.length;
    // The first PNG must restore every field, including the required start team.
    const original = await download(page, true);
    expect(restorePng(new Uint8Array(original), mystery)).toEqual(expected);
    await btn(page, "Schließen").tap();
    await page.locator('[data-card="1"] > rect').tap();
    await btn(page, "Grün").tap();
    expected.cards.find((c) => c.id === 1)!.color = 1;
    await btn(page, "Schließen").tap();
    await page.locator('[data-card="1"] > rect').tap();
    await btn(page, "Mit einer Karte verbinden").tap();
    await page.locator('[data-card="3"] > rect').tap();
    // Field data entry is automated; every opening/closing/submitting action is a native finger tap.
    await page.getByLabel("Beschriftung").tap();
    await page.getByLabel("Beschriftung").fill("R1b neue Verbindung");
    await btn(page, "Übernehmen").tap();
    const newId = initialEdges + 1;
    expected.edges.push({
      id: newId,
      from: 1,
      to: 3,
      direction: 0,
      label: "R1b neue Verbindung",
    });
    await expect(page.locator("[data-edge]")).toHaveCount(initialEdges + 1);
    // The visible 1–2 label must win over the new crossing 1–3 line.
    await page.locator('[data-edge-label="1"]').tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und 2",
    );
    await page.getByLabel("Beschriftung").tap();
    await page.getByLabel("Beschriftung").fill("R1b gezielt geändert");
    await page.getByLabel("Richtung").selectOption("2");
    await btn(page, "Übernehmen").tap();
    await page.locator('[data-edge-label="1"]').tap();
    await expect(page.getByLabel("Beschriftung")).toHaveValue(
      "R1b gezielt geändert",
    );
    await expect(page.getByLabel("Richtung")).toHaveValue("2");
    await btn(page, "Verbindung löschen").tap();
    await expect(page.locator('[data-edge="1"]')).toHaveCount(0);
    await expect(page.locator(`[data-edge="${newId}"]`)).toHaveCount(1);
    await btn(page, "Rückgängig").tap();
    await expect(page.locator('[data-edge="1"]')).toHaveCount(1);
    await btn(page, "Wiederholen").tap();
    await expect(page.locator('[data-edge="1"]')).toHaveCount(0);
    expected.edges = expected.edges.filter((e) => e.id !== 1);
    await btn(page, "Menü").tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Menü");
    await btn(page, "Schließen").tap();
    const bytes = await download(page);
    expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(expected);
    await info.attach("touch-workflow.png", {
      body: bytes,
      contentType: "image/png",
    });
    const freshContext = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1180, height: 820 },
    });
    try {
      const fresh = await freshContext.newPage(),
        messages = monitor(fresh);
      fresh.on("request", (r) => {
        if (/^https?:/.test(r.url()) && r.url() !== url(big))
          requests.push(r.url());
      });
      await fresh.goto(url(big));
      await freshContext.setOffline(true);
      await importPng(fresh, bytes);
      await expect(fresh.locator("[data-card]")).toHaveCount(big ? 60 : 12);
      await expect(fresh.locator("[data-edge]")).toHaveCount(initialEdges);
      await expect(btn(fresh, "Rückgängig")).toBeDisabled();
      await expect(btn(fresh, "Wiederholen")).toBeDisabled();
      await fresh.locator('[data-card="1"] > rect').tap();
      await expect(btn(fresh, "Grün")).toHaveAttribute("aria-pressed", "true");
      await btn(fresh, "Rot").tap();
      expected.cards.find((c) => c.id === 1)!.color = 5;
      await btn(fresh, "Schließen").tap();
      expect(
        restorePng(new Uint8Array(await download(fresh, true)), mystery),
      ).toEqual(expected);
      expect(messages).toEqual([]);
      expect(requests).toEqual([]);
      await info.attach("workflow-summary.json", {
        body: JSON.stringify(
          {
            cards: expected.cards.length,
            edges: expected.edges.length,
            originalPngExact: true,
            restoredEditedPngExact: true,
            furtherEditExact: true,
            externalRequests: requests,
            freshConsole: messages,
            fieldEntry:
              "fill/selectOption; all dialog buttons, links and targets use native tap",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      await freshContext.close();
    }
  });
}

test("R1b Original-ID-Grenzstand importiert unverändert und bleibt nach Teamnachtrag per Finger sicherbar", async ({
  page,
}, info) => {
  const bytes = await readFile("tests/fixtures/review/Start-ID-1000000.png"),
    mystery = validateMystery(small);
  const expected = restorePng(new Uint8Array(bytes), mystery);
  expect(expected.schema).toBe(1);
  expect(expected).not.toHaveProperty("team");
  await page.goto(url());
  await importPng(page, bytes);
  await expect(btn(page, "Rückgängig")).toBeDisabled();
  await expect(btn(page, "Wiederholen")).toBeDisabled();
  const saved = await download(page, true, true);
  expect(restorePng(new Uint8Array(saved), mystery)).toEqual(
    withTeam(expected, TEST_TEAM),
  );
  await info.attach("read-only-high-id.png", {
    body: saved,
    contentType: "image/png",
  });
});

test("R1b 220-Verbindungen: acht Kreuzungslabels einschließlich Schließen, Ändern und Löschen per Finger", async ({
  page,
}, info) => {
  await page.goto("http://localhost:5174/dist/review/index.html");
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill(TEST_TEAM);
  await btn(page, "Beginnen").tap();
  await expect(page.locator("[data-edge]")).toHaveCount(220);
  const originalIds = await page
    .locator("[data-edge]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-edge")));
  const targets = await page
    .locator("[data-edge-label] rect")
    .evaluateAll((labels) =>
      labels.flatMap((el) => {
        const b = el.getBoundingClientRect(),
          x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        const id = el.parentElement!.getAttribute("data-edge-label")!;
        const stack = document.elementsFromPoint(x, y);
        if (
          stack[0]
            ?.closest("[data-edge-label]")
            ?.getAttribute("data-edge-label") !== id ||
          !stack.some(
            (e) =>
              e.closest("[data-edge]") &&
              e.closest("[data-edge]")!.getAttribute("data-edge") !== id,
          )
        )
          return [];
        return [{ x, y, id }];
      }),
    );
  expect(targets.length).toBeGreaterThanOrEqual(8);
  for (const target of targets.slice(0, 8)) {
    const label = await page
      .locator(`[data-edge="${target.id}"]`)
      .getAttribute("aria-label");
    const pair = label!.match(/^Verbindung (\d+) zu (\d+)/)!;
    await page.touchscreen.tap(target.x, target.y);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      `Verbindung ${pair[1]} und ${pair[2]}`,
    );
    await expect(page.locator("[data-edge]")).toHaveCount(220);
    await btn(page, "Schließen").tap();
  }
  const chosen = targets[0];
  const chosenLabel = page.locator(`[data-edge-label="${chosen.id}"]`);
  await chosenLabel.tap();
  await page.getByLabel("Beschriftung").fill("R1b Kreuzung gezielt");
  await btn(page, "Übernehmen").tap();
  await chosenLabel.tap();
  await expect(page.getByLabel("Beschriftung")).toHaveValue(
    "R1b Kreuzung gezielt",
  );
  await btn(page, "Verbindung löschen").tap();
  expect(
    await page
      .locator("[data-edge]")
      .evaluateAll((es) => es.map((e) => e.getAttribute("data-edge"))),
  ).toEqual(originalIds.filter((id) => id !== chosen.id));
  await btn(page, "Rückgängig").tap();
  await btn(page, "Rückgängig").tap();
  expect(
    await page
      .locator("[data-edge]")
      .evaluateAll((es) => es.map((e) => e.getAttribute("data-edge"))),
  ).toEqual(originalIds);
  await info.attach("finger-crossings.json", {
    body: JSON.stringify(
      {
        targets: targets.slice(0, 8),
        changedAndDeletedOnly: chosen.id,
        originalIdsRestored: true,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("R1b Capture-Verlust beendet keinen gehaltenen Finger; verspäteter fremder Abbruch sperrt keinen neuen Tipp", async ({
  page,
}, info) => {
  await start(page);
  await instrument(page);
  await page.locator('[data-card="1"] > rect').tap();
  const close = btn(page, "Schließen"),
    blue = btn(page, "Blau");
  await expect(blue).toHaveAttribute("aria-pressed", "false");
  await replay(close, "pointerdown", 91);
  await replay(close, "lostpointercapture", 91);
  // Finger 91 is still physically down: 92 cannot become a single-finger tap.
  await replay(blue, "pointerdown", 92);
  await replay(blue, "pointerup", 92);
  expect((await replay(blue, "click", 1, "mouse")).defaultPrevented).toBe(true);
  await expect(blue).toHaveAttribute("aria-pressed", "false");
  await replay(close, "pointerup", 91);
  await close.tap();
  await page.locator('[data-card="1"] > rect').tap();
  await replay(close, "pointerdown", 93);
  await replay(close, "pointercancel", 91); // already-ended older pointer
  await replay(close, "pointerup", 93);
  expect((await replay(close, "click", 1, "mouse")).defaultPrevented).toBe(
    false,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await trace(page)).actions).toEqual(["Schließen", "Schließen"]);
  await info.attach("capture-with-held-finger.json", {
    body: JSON.stringify(await trace(page), null, 2),
    contentType: "application/json",
  });
});
