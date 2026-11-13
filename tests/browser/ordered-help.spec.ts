import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import five from "../fixtures/ordered-5.json" with { type: "json" };
import soil from "../../src/content/boden-klasse11.json" with { type: "json" };
import { validateMystery } from "../../src/core/model";
import { restorePng } from "../../src/core/png";
import { DEFAULT_METHOD_HELP } from "../../src/core/help";

test.use({ hasTouch: true });
const mystery = validateMystery(five);
const views = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
];
const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const card = (page: Page, id: number) =>
  page.locator(`[data-card="${id}"] > rect`);
const url = (count: number) =>
  `http://localhost:5174/artifacts/tests/MysteryBoard-Vorlage-Geordnet-${count}.html`;
async function open(page: Page, count: number) {
  await page.context().setOffline(false);
  await page.goto(url(count));
  await page.context().setOffline(true);
}
async function begin(page: Page, count: number) {
  await open(page, count);
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Vorlagenprüfung");
  await btn(page, "Beginnen").tap();
  await expect(page.locator("[data-card]")).toHaveCount(count);
}
async function help(page: Page, keyboard = false) {
  if (!(await btn(page, "Hilfe").isVisible())) {
    if (keyboard) await btn(page, "Menü").press("Enter");
    else await btn(page, "Menü").tap();
  }
  if (keyboard) await btn(page, "Hilfe").press("Enter");
  else await btn(page, "Hilfe").tap();
  await expect(
    page.getByRole("dialog", { name: "Hilfe", exact: true }),
  ).toBeVisible();
}
async function positions(page: Page) {
  return page
    .locator("[data-card]")
    .evaluateAll((nodes) =>
      nodes.map((n) => [
        Number(n.getAttribute("data-card")),
        Number(n.getAttribute("data-x")),
        Number(n.getAttribute("data-y")),
      ]),
    );
}
async function product(page: Page) {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((n) => [
      n.getAttribute("data-card"),
      n.getAttribute("data-x"),
      n.getAttribute("data-y"),
      n.querySelector("rect")!.getAttribute("fill"),
      [...n.querySelectorAll(":scope > text")].map((t) => t.textContent),
    ]),
    edges: [...document.querySelectorAll("[data-edge]")].map((n) => [
      n.getAttribute("data-edge"),
      n.outerHTML,
    ]),
    labels: [...document.querySelectorAll("[data-edge-label]")].map(
      (n) => n.outerHTML,
    ),
    team: document.querySelector(".team-summary")!.textContent,
    undo: (
      document.querySelector('[aria-label="Rückgängig"]') as HTMLButtonElement
    ).disabled,
    redo: (
      document.querySelector('[aria-label="Wiederholen"]') as HTMLButtonElement
    ).disabled,
  }));
}
async function drag(page: Page, id: number) {
  const b = (await card(page, id).boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= 4; i++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 5 * i, y: y + 4 * i, id: 1 }],
      });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
}
async function save(page: Page, info: TestInfo, name: string) {
  await btn(page, "Menü").tap();
  await btn(page, "Kleineres Sicherungsbild").tap();
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const pending = page.waitForEvent("download");
  await link.tap();
  const downloaded = await pending;
  expect(await downloaded.failure()).toBeNull();
  const path = info.outputPath(name + ".png");
  await downloaded.saveAs(path);
  const png = await readFile(path);
  await btn(page, "Schließen").tap();
  await info.attach(name, { path, contentType: "image/png" });
  return {
    png,
    state: restorePng(png, mystery),
    sha256: createHash("sha256").update(png).digest("hex"),
  };
}
async function load(page: Page, png: Buffer, existing = false) {
  if (existing) await btn(page, "Menü").tap();
  await btn(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await btn(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({ name: "Original.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function shot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + ".png");
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const count of [5, 12, 18, 60])
  for (const viewport of views)
    test(`Geordnete Ablage ${count}, ${viewport.width}x${viewport.height}: Zahlen, Präfixe, Abstände, unveränderte Bearbeitung`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await begin(page, count);
      const baseline = await positions(page);
      expect(baseline.map((c) => c[0])).toEqual(
        Array.from({ length: count }, (_, i) => i + 1),
      );
      const bounds = await page
        .locator("[data-card] > rect, [data-number]")
        .evaluateAll((nodes) =>
          nodes.map((n) => {
            const b = n.getBoundingClientRect();
            return {
              x: b.x,
              y: b.y,
              right: b.right,
              bottom: b.bottom,
              width: b.width,
              height: b.height,
            };
          }),
        );
      for (const b of bounds) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(viewport.width);
        expect(b.bottom).toBeLessThanOrEqual(viewport.height);
      }
      // Include the badge, not merely the rectangular card body, in the overlap check.
      for (let i = 0; i < bounds.length; i++)
        for (let j = i + 1; j < bounds.length; j++) {
          const a = bounds[i],
            b = bounds[j];
          expect(
            a.right <= b.x ||
              b.right <= a.x ||
              a.bottom <= b.y ||
              b.bottom <= a.y,
          ).toBe(true);
        }
      await expect(page.locator('[data-number="2"]')).toHaveText("Z2");
      await expect(page.locator('[data-number="4"]')).toHaveText("V4");
      await shot(page, info, "geordnete-startansicht");
      await drag(page, 1);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const moved = await positions(page);
      expect(moved).not.toEqual(baseline);
      await btn(page, "Übersicht").tap();
      expect(await positions(page)).toEqual(moved);
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
      await btn(page, "Übersicht").tap();
      expect(await positions(page)).toEqual(moved);
      const zoom = Number(
        await page.locator(".board").getAttribute("data-zoom"),
      );
      const board = (await page.locator(".board").boundingBox())!;
      await page.mouse.move(
        board.x + board.width / 2,
        board.y + board.height / 2,
      );
      await page.mouse.wheel(0, -180);
      await expect
        .poll(async () =>
          Number(await page.locator(".board").getAttribute("data-zoom")),
        )
        .toBeGreaterThan(zoom);
      expect(await positions(page)).toEqual(moved);
      await btn(page, "Rückgängig").tap();
      expect(await positions(page)).toEqual(baseline);
      await btn(page, "Wiederholen").tap();
      expect(await positions(page)).toEqual(moved);
    });

for (const viewport of views)
  test(`Schülerablauf mit zweistufiger Hilfe ${viewport.width}x${viewport.height}: eigenes Produkt, identische PNG, neue Sitzung`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    const requests: string[] = [],
      errors: string[] = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.url() !== url(5))
        requests.push(r.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await begin(page, 5);
    for (let id = 1; id <= 5; id++) {
      await page.locator(`[data-number="${id}"]`).tap();
      await expect(page.locator(".reading p")).toHaveText(
        five.cards.find((c) => c.id === id)!.text,
      );
      await btn(page, "Schließen").tap();
    }
    await drag(page, 1);
    await card(page, 4).tap();
    await btn(page, "Violett").tap();
    await page.getByLabel("Name für diese Farbe").fill("Eigene Zuordnung");
    await btn(page, "Schließen").tap();
    await card(page, 1).tap();
    await btn(page, "Mit einer Karte verbinden").tap();
    await card(page, 2).tap();
    await page.getByLabel("Beschriftung").fill("Unsere Vermutung");
    await page
      .getByRole("combobox", { name: "Richtung", exact: true })
      .selectOption("1");
    await btn(page, "Übernehmen").tap();
    const before = await save(page, info, "produkt-vor-hilfe");
    await load(page, before.png, true);
    const state = await product(page);
    const warns = () =>
      page.evaluate(
        () =>
          !window.dispatchEvent(
            new Event("beforeunload", { cancelable: true }),
          ),
      );
    expect(await warns()).toBe(false);
    const boardBeforeHelp = await page.locator(".board").boundingBox();
    await help(page);
    await expect(
      page.getByRole("dialog", { name: "Hilfe", exact: true }),
    ).toContainText(five.help.method);
    await expect(page.locator("#orientation-legend")).toHaveCount(0);
    expect(await product(page)).toEqual(state);
    expect(await warns()).toBe(false);
    const panel = (await page.locator(".learning-help").boundingBox())!;
    expect(await page.locator(".board").boundingBox()).toEqual(boardBeforeHelp);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
    expect(panel.height).toBeLessThanOrEqual(viewport.height / 2 + 1);
    expect(panel.y).toBeGreaterThanOrEqual(74);
    await shot(page, info, "hilfestufe-1");
    await btn(page, "Weitere Hilfe anzeigen").tap();
    await expect(page.locator("#orientation-legend")).toBeVisible();
    // The second stage must be visible immediately, without scrolling past
    // the first stage. The hide control must remain outside the scroll area.
    const stageHeading = (await page
      .getByRole("heading", { name: "2. Nummernorientierung" })
      .boundingBox())!;
    const hideControl = (await btn(
      page,
      "Orientierung ausblenden",
    ).boundingBox())!;
    expect(stageHeading.y).toBeGreaterThanOrEqual(panel.y);
    expect(stageHeading.y + stageHeading.height).toBeLessThanOrEqual(
      panel.y + viewport.height / 2,
    );
    expect(hideControl.y + hideControl.height).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(hideControl.y + hideControl.height).toBeLessThanOrEqual(
      (await page.locator(".learning-help").boundingBox())!.y +
        (await page.locator(".learning-help").boundingBox())!.height,
    );
    for (const category of five.help.categories) {
      await expect(page.locator(".help-legend")).toContainText(category.label);
      for (const id of category.cardIds) {
        await expect(
          page.locator(`[data-number="${id}"] circle`),
        ).toHaveAttribute("fill", category.color);
        await expect(page.locator(`[data-card="${id}"]`)).toHaveAttribute(
          "aria-description",
          `Orientierung: ${category.label}`,
        );
      }
    }
    await expect(page.locator(".help-legend")).toContainText("Karten 1, V4");
    await expect(page.locator(".help-legend")).toContainText("Karten Z2");
    await expect(page.locator('[data-number="3"] circle')).toHaveAttribute(
      "fill",
      "#334f40",
    );
    expect(await product(page)).toEqual(state);
    expect(await warns()).toBe(false);
    await shot(page, info, "hilfestufe-2");
    // Print CSS suppresses the temporary colors without merging print development.
    await page.emulateMedia({ media: "print" });
    expect(
      await page
        .locator("[data-number] circle")
        .evaluateAll((nodes) =>
          nodes.every((n) => getComputedStyle(n).fill === "rgb(51, 79, 64)"),
        ),
    ).toBe(true);
    await expect(page.locator(".learning-help")).not.toBeVisible();
    await page.emulateMedia({ media: "screen" });
    // The nonmodal panel leaves the original toolbar usable even while open.
    const active = await save(page, info, "produkt-mit-nummernhilfe");
    expect(active.state).toEqual(before.state);
    expect(active.png).toEqual(before.png);
    expect(await product(page)).toEqual(state);
    expect(await warns()).toBe(false);
    await help(page);
    await btn(page, "Orientierung ausblenden").tap();
    await expect(page.locator("#orientation-legend")).toHaveCount(0);
    expect(
      await page
        .locator("[data-number] circle")
        .evaluateAll((nodes) =>
          nodes.every((n) => n.getAttribute("fill") === "#334f40"),
        ),
    ).toBe(true);
    await btn(page, "Weitere Hilfe anzeigen").tap();
    await btn(page, "Orientierung ausblenden").tap();
    await btn(page, "Hilfe schließen").tap();
    expect(await product(page)).toEqual(state);
    // Continue independently, rather than letting help create any connection.
    await card(page, 4).tap();
    await btn(page, "Mit einer Karte verbinden").tap();
    await card(page, 5).tap();
    await page.getByLabel("Beschriftung").fill("Weitere eigene Idee");
    await btn(page, "Übernehmen").tap();
    const final = await save(page, info, "weitergearbeitet");
    expect(final.state.edges).toHaveLength(2);
    // Active help must also reset on importing another saved state in this session.
    await help(page);
    await btn(page, "Weitere Hilfe anzeigen").tap();
    await btn(page, "Hilfe schließen").tap();
    await load(page, final.png, true);
    expect(
      await page
        .locator("[data-number] circle")
        .evaluateAll((nodes) =>
          nodes.every((n) => n.getAttribute("fill") === "#334f40"),
        ),
    ).toBe(true);
    const context = await browser.newContext({
      hasTouch: true,
      viewport,
      acceptDownloads: true,
    });
    try {
      const fresh = await context.newPage();
      await open(fresh, 5);
      await load(fresh, final.png);
      await expect(fresh.locator("[data-card]")).toHaveCount(5);
      expect(await positions(fresh)).toEqual(
        final.state.cards.map((c) => [c.id, c.x, c.y]),
      );
      expect((await save(fresh, info, "neue-sitzung")).state).toEqual(
        final.state,
      );
      expect(
        await fresh
          .locator("[data-number] circle")
          .evaluateAll((nodes) =>
            nodes.every((n) => n.getAttribute("fill") === "#334f40"),
          ),
      ).toBe(true);
      await help(fresh);
      await expect(fresh.locator("#orientation-legend")).toHaveCount(0);
      expect(
        await fresh.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ local: 0, session: 0 });
    } finally {
      await context.close();
    }
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("produkt-integritaet", {
      body: JSON.stringify(
        {
          before: before.sha256,
          active: active.sha256,
          identicalPng: true,
          requests,
          errors,
          viewport,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

test("Allgemeiner Impuls ohne Hilfemetadaten, Tastatur und breite Werkzeugleiste", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await begin(page, 12);
  await expect(
    page
      .locator(".toolbar")
      .getByRole("button", { name: "Hilfe", exact: true }),
  ).toBeVisible();
  const before = await product(page);
  await help(page, true);
  await expect(
    page.getByRole("dialog", { name: "Hilfe", exact: true }),
  ).toContainText(DEFAULT_METHOD_HELP);
  await expect(btn(page, "Weitere Hilfe anzeigen")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Hilfe", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(btn(page, "Hilfe")).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  await help(page, true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(btn(page, "Menü")).toBeFocused();
  expect(await product(page)).toEqual(before);
});

test("Neuer Kern erhält explizites Boden-Layout und echte RC1-Positionen in einer getrennten technischen Vorschau", async ({
  page,
}) => {
  await page.goto(
    "http://localhost:5174/artifacts/previews/MysteryBoard-Boden-Klasse11.html",
  );
  await page.context().setOffline(true);
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Bestandsprüfung");
  await btn(page, "Beginnen").tap();
  expect(await positions(page)).toEqual(
    soil.initial.cards.map((c) => [c.id, c.x, c.y]),
  );
  await help(page);
  await expect(
    page.getByRole("dialog", { name: "Hilfe", exact: true }),
  ).toContainText(DEFAULT_METHOD_HELP);
  await expect(btn(page, "Weitere Hilfe anzeigen")).toHaveCount(0);
  await btn(page, "Hilfe schließen").tap();
  const png = await readFile("tests/fixtures/release/rc1-original.png");
  await load(page, png, true);
  const expected = restorePng(png, validateMystery(soil));
  expect(await positions(page)).toEqual(
    expected.cards.map((c) => [c.id, c.x, c.y]),
  );
  await btn(page, "Übersicht").tap();
  expect(await positions(page)).toEqual(
    expected.cards.map((c) => [c.id, c.x, c.y]),
  );
});
