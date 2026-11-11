import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import small from "../../src/content/small.json" with { type: "json" };
import large from "../../src/content/large.json" with { type: "json" };
import soil from "../../src/content/boden-klasse11.json" with { type: "json" };
import other from "../fixtures/reusable-five.json" with { type: "json" };
import {
  cardNumber,
  initialWork,
  teamName,
  validateMystery,
  withTeam,
  type Work,
} from "../../src/core/model";
import { embedWork, restorePng } from "../../src/core/png";
import { validPng } from "../fixtures/png";

test.use({ hasTouch: true });
const variants = [
  { key: "small", file: "artifacts/MysteryBoard-klein.html", data: small },
  {
    key: "large",
    file: "artifacts/MysteryBoard-umfangreich.html",
    data: large,
  },
  {
    key: "boden",
    file: "artifacts/MysteryBoard-Boden-Klasse11.html",
    data: soil,
  },
  {
    key: "neutral",
    file: "artifacts/tests/MysteryBoard-Test-5.html",
    data: other,
  },
];
const soilVariant = variants[2];
const artifactUrl = (file: string) => `http://localhost:5174/${file}`;
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const teamField = (page: Page) =>
  page.getByRole("textbox", { name: /Teamname oder Vornamen/ });
const card = (page: Page, id: number) =>
  page.locator(`[data-card="${id}"] > rect`);
const close = (page: Page) => button(page, "Schließen").tap();
function observe(page: Page, files: string | string[]) {
  const requests: string[] = [],
    errors: string[] = [];
  const allowedDocuments = new Set(
    (Array.isArray(files) ? files : [files]).map(artifactUrl),
  );
  page.on("request", (r) => {
    const initialDocument =
      r.isNavigationRequest() &&
      r.resourceType() === "document" &&
      r.frame() === page.mainFrame() &&
      allowedDocuments.has(r.url());
    if (/^https?:/.test(r.url()) && !initialDocument) requests.push(r.url());
  });
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { requests, errors };
}
async function openArtifact(page: Page, file: string) {
  // Direct file:// navigation is blocked by the managed browser policy.
  // Fetch only the exact standalone document locally, then disconnect before
  // any user interaction. The request observer rejects all other HTTP(S).
  await page.context().setOffline(false);
  await page.goto(artifactUrl(file));
  await page.context().setOffline(true);
}
async function begin(page: Page, file: string, name: string, invalid = false) {
  await openArtifact(page, file);
  if (invalid) {
    await teamField(page).fill("Name\tTeam");
    await button(page, "Beginnen").tap();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator("[data-card]")).toHaveCount(0);
  }
  await teamField(page).fill(name);
  await button(page, "Beginnen").tap();
}
async function rename(page: Page, name: string, invalid = false) {
  await button(page, "Menü").tap();
  await button(page, "Teamname ändern").tap();
  if (invalid) {
    const previous = await page.locator(".team-summary").textContent();
    await teamField(page).fill("Name\tTeam");
    await button(page, "Übernehmen").tap();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await expect(page.locator(".team-summary")).toHaveText(previous!);
  }
  await teamField(page).fill(name);
  await button(page, "Übernehmen").tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function download(page: Page, compact = true) {
  if (compact) {
    await button(page, "Menü").tap();
    await button(page, "Kleineres Sicherungsbild").tap();
  } else await button(page, "Sichern").tap();
  return downloadReady(page);
}
async function downloadReady(page: Page) {
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await link.tap();
  return readFile((await (await download).path())!);
}
async function load(page: Page, png: Buffer) {
  await button(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({
    name: "Original-Sicherung.png",
    mimeType: "image/png",
    buffer: png,
  });
}
async function recordExport(page: Page) {
  await page.evaluate(() => {
    (window as any).exportTexts = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      if (this.canvas.width >= 2480 && this.canvas.height >= 1754) {
        const transform = this.getTransform(),
          metrics = this.measureText(text);
        (window as any).exportTexts.push({
          text,
          x,
          y,
          width: metrics.width,
          ascent: metrics.actualBoundingBoxAscent,
          descent: metrics.actualBoundingBoxDescent,
          align: this.textAlign,
          baseline: this.textBaseline,
          font: this.font,
          transform: [
            transform.a,
            transform.b,
            transform.c,
            transform.d,
            transform.e,
            transform.f,
          ],
          canvasWidth: this.canvas.width,
          canvasHeight: this.canvas.height,
        });
      }
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
}
async function verifyHeader(
  page: Page,
  png: Buffer,
  title: string,
  team: string,
  info: TestInfo,
  name: string,
) {
  const texts: any[] = await page.evaluate(() => (window as any).exportTexts);
  const rows = texts.filter(
    (t) =>
      t.transform.every(
        (n: number, i: number) => n === [1, 0, 0, 1, 0, 0][i],
      ) && t.y < t.canvasHeight / 2,
  );
  const left = rows.filter((t) => t.align === "left"),
    right = rows.filter((t) => t.align === "right");
  const compactText = (s: string) => s.replace(/\s/g, "");
  expect(compactText(left.map((t) => t.text).join(""))).toBe(
    compactText(title),
  );
  expect(compactText(right.map((t) => t.text).join(""))).toBe(
    compactText(team),
  );
  expect(left.length).toBeGreaterThan(0);
  expect(right.length).toBeGreaterThan(0);
  expect(left[0].y).toBe(right[0].y);
  const leftEdge = (row: any) =>
    row.align === "right" ? row.x - row.width : row.x;
  const rightEdge = (row: any) =>
    row.align === "right" ? row.x : row.x + row.width;
  expect(Math.max(...left.map(rightEdge))).toBeLessThan(
    Math.min(...right.map(leftEdge)),
  );
  for (const row of rows) {
    expect(leftEdge(row)).toBeGreaterThanOrEqual(0);
    expect(rightEdge(row)).toBeLessThanOrEqual(row.canvasWidth);
    expect(row.y - row.ascent).toBeGreaterThanOrEqual(0);
    expect(row.y + row.descent).toBeLessThan(row.canvasHeight * 0.15);
  }
  const height = Math.ceil(
    Math.max(...rows.map((t) => t.y + t.descent)) +
      25 * (png.readUInt32BE(16) / 2480),
  );
  const raster = await page.evaluate(
    async ({ base64, height }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { base64: png.toString("base64"), height },
  );
  const header = Buffer.from(raster, "base64");
  await writeFile(info.outputPath(`${name}-header.png`), header);
  await info.attach(`${name}-header.png`, {
    body: header,
    contentType: "image/png",
  });
  await info.attach(`${name}-header-coordinates.json`, {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });
  return texts;
}

for (const variant of variants) {
  test(`Universelle Vorlage ${variant.key}: lokale Einzel-HTML, Team und vollständiger Offline-PNG-Rundlauf`, async ({
    page,
    context,
    browser,
  }, info) => {
    test.setTimeout(120000);
    const mystery = validateMystery(variant.data),
      observation = observe(page, variant.file);
    await begin(
      page,
      variant.file,
      `Team Anfang ${variant.key}`,
      variant.key === "small",
    );
    await expect(page.locator("[data-card]")).toHaveCount(mystery.cards.length);
    for (const content of mystery.cards) {
      await expect(
        page.locator(`[data-number="${content.id}"] text`),
      ).toHaveText(cardNumber(mystery, content.id));
    }
    for (const group of Object.keys(mystery.cardGroups ?? {})) {
      await expect(
        page.locator(`[data-card][data-group="${group}"]`),
      ).toHaveCount(mystery.cards.filter((c) => c.group === group).length);
    }
    const additional = mystery.cards.find(
      (c) => c.group && mystery.cardGroups![c.group].prefix,
    );
    if (additional) {
      await card(page, additional.id).tap();
      await expect(page.getByRole("dialog")).toHaveAccessibleName(
        `Karte ${cardNumber(mystery, additional.id)}`,
      );
      await expect(page.locator(".card-group")).toHaveText(
        mystery.cardGroups![additional.group!].label,
      );
      await close(page);
    }
    const name = `Ada, Cem und Lina – ${variant.key}`;
    await rename(page, name, variant.key === "small");
    await expect(page.locator(".team-summary")).toContainText(name);
    await recordExport(page);
    const bytes = await download(page);
    const expected = withTeam(initialWork(mystery), name);
    expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(expected);
    const texts = await verifyHeader(
      page,
      bytes,
      mystery.title,
      name,
      info,
      variant.key,
    );
    for (const content of mystery.cards)
      expect(
        texts.some((t) => t.text === cardNumber(mystery, content.id)),
      ).toBe(true);
    await info.attach(`${variant.key}-original.png`, {
      body: bytes,
      contentType: "image/png",
    });
    expect(observation).toEqual({ requests: [], errors: [] });
    const freshContext = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1180, height: 820 },
    });
    try {
      const fresh = await freshContext.newPage(),
        after = observe(fresh, variant.file);
      await openArtifact(fresh, variant.file);
      await load(fresh, bytes);
      await expect(fresh.getByRole("dialog")).toHaveCount(0);
      await expect(fresh.locator(".team-summary")).toContainText(name);
      await expect(button(fresh, "Rückgängig")).toBeDisabled();
      await expect(button(fresh, "Wiederholen")).toBeDisabled();
      expect(
        restorePng(new Uint8Array(await download(fresh)), mystery),
      ).toEqual(expected);
      await close(fresh);
      const target = mystery.cards[0].id;
      await card(fresh, target).tap();
      await expect(fresh.getByRole("dialog")).toHaveAccessibleName(
        `Karte ${cardNumber(mystery, target)}`,
      );
      await button(fresh, "Rot").tap();
      expected.cards.find((c) => c.id === target)!.color = 5;
      await close(fresh);
      await rename(fresh, `Weiterarbeit ${variant.key}`);
      const edited = withTeam(expected, `Weiterarbeit ${variant.key}`);
      expect(
        restorePng(new Uint8Array(await download(fresh)), mystery),
      ).toEqual(edited);
      expect(after).toEqual({ requests: [], errors: [] });
      expect(
        await fresh.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ local: 0, session: 0 });
    } finally {
      await freshContext.close();
    }
  });
}

async function touchDrag(page: Page, id: number, dx: number, dy: number) {
  const rect = (await card(page, id).boundingBox())!,
    x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 4; i++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / 4, y: y + (dy * i) / 4 }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}
async function tapVisibleLabel(page: Page, id: number) {
  const point = await page
    .locator(`[data-edge-label="${id}"] rect`)
    .evaluate((element, id) => {
      const bounds = element.getBoundingClientRect();
      // Cards/badges may cover a label's center after a user moves a card. Tap
      // its actual visible part; never force a click through a painted card.
      for (const fy of [0.5, 0.25, 0.75])
        for (const fx of [0.5, 0.9, 0.1, 0.98, 0.02]) {
          const x = bounds.left + bounds.width * fx,
            y = bounds.top + bounds.height * fy;
          if (
            document
              .elementFromPoint(x, y)
              ?.closest("[data-edge-label]")
              ?.getAttribute("data-edge-label") === String(id)
          )
            return { x, y };
        }
      return null;
    }, id);
  expect(
    point,
    `Sichtbare und tatsächlich treffbare Fläche von Label ${id}`,
  ).not.toBeNull();
  await page.touchscreen.tap(point!.x, point!.y);
}
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`Boden ${viewport.width}×${viewport.height}: Pflicht/V, Touch-Ziehen, sichtbare Verbindung und Teamexport`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    const observation = observe(page, soilVariant.file),
      mystery = validateMystery(soil);
    await begin(page, soilVariant.file, "Unsere Bodengruppe");
    await expect(page.locator("[data-card]")).toHaveCount(18);
    await expect(page.locator("[data-edge]")).toHaveCount(0);
    const expected = withTeam(initialWork(mystery), "Unsere Bodengruppe");
    expect(expected.cards.every((c) => c.color === 0)).toBe(true);
    expect(expected.categories).toEqual(["", "", "", "", "", ""]);
    for (const content of mystery.cards) {
      const number = page.locator(`[data-number="${content.id}"] text`);
      await expect(number).toHaveText(cardNumber(mystery, content.id));
      const box = (await number.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    const initialScreenshot = info.outputPath(
      `boden-${viewport.width}-initial.png`,
    );
    await page.screenshot({ path: initialScreenshot });
    await info.attach(`boden-${viewport.width}-initial.png`, {
      path: initialScreenshot,
      contentType: "image/png",
    });
    await card(page, 13).tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Karte V13");
    await expect(page.locator(".reading p")).toHaveText(
      mystery.cards.find((c) => c.id === 13)!.text,
    );
    await button(page, "Blau").tap();
    expected.cards.find((c) => c.id === 13)!.color = 2;
    await close(page);
    const before = expected.cards.find((c) => c.id === 1)!;
    const oldX = before.x,
      oldY = before.y;
    await touchDrag(page, 1, 35, 22);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const moved = await page.locator('[data-card="1"]').evaluate((el) => ({
      x: Number(el.getAttribute("data-x")),
      y: Number(el.getAttribute("data-y")),
    }));
    expect(moved).not.toEqual({ x: oldX, y: oldY });
    Object.assign(before, moved);
    const displayedOrder = await page
      .locator("[data-card]")
      .evaluateAll((elements) =>
        elements.map((el) => Number(el.getAttribute("data-card"))),
      );
    expected.cards = displayedOrder.map((id) =>
      expected.cards.find((c) => c.id === id)!,
    );
    await card(page, 1).tap();
    await button(page, "Mit einer Karte verbinden").tap();
    await expect(page.locator(".connection-prompt")).toContainText("1");
    await card(page, 13).tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und V13",
    );
    await expect(
      page.getByRole("option", { name: "1 → V13", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("option", { name: "V13 → 1", exact: true }),
    ).toHaveCount(1);
    await page.getByLabel("Beschriftung").fill("Deutung prüfen");
    await page.getByLabel("Richtung").selectOption("1");
    await button(page, "Übernehmen").tap();
    await tapVisibleLabel(page, 1);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Verbindung 1 und V13",
    );
    await page.getByLabel("Beschriftung").fill("Weitere Belege nötig");
    await page.getByLabel("Richtung").selectOption("2");
    await button(page, "Übernehmen").tap();
    await button(page, "Rückgängig").tap();
    await expect(page.locator('[data-edge-label="1"]')).toContainText(
      "Deutung prüfen",
    );
    await button(page, "Wiederholen").tap();
    await expect(page.locator('[data-edge-label="1"]')).toContainText(
      "Weitere Belege nötig",
    );
    expected.edges = [
      { id: 1, from: 1, to: 13, direction: 2, label: "Weitere Belege nötig" },
    ];
    const name = "Ada und Cem – gemeinsam begründen";
    await rename(page, name);
    const final = withTeam(expected, name);
    await page.screenshot({
      path: info.outputPath(`boden-${viewport.width}-board.png`),
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await recordExport(page);
    const bytes = await download(page, false);
    expect(restorePng(new Uint8Array(bytes), mystery)).toEqual(final);
    await verifyHeader(
      page,
      bytes,
      mystery.title,
      name,
      info,
      `boden-${viewport.width}`,
    );
    await info.attach(`boden-${viewport.width}-full.png`, {
      body: bytes,
      contentType: "image/png",
    });
    expect(observation).toEqual({ requests: [], errors: [] });
  });
}

test("Alle Varianten importieren schema1 unverändert; Export verlangt Team, ungültiges Löschen erhält den Namen", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  const observation = observe(
      page,
      variants.map((variant) => variant.file),
    ),
    results = [];
  for (const variant of variants) {
    const mystery = validateMystery(variant.data);
    const legacy =
      variant.key === "small"
        ? await readFile("tests/fixtures/review/Start-ID-1000000.png")
        : variant.key === "large"
          ? await readFile("tests/fixtures/review/60-90-Gruppenstand.png")
          : Buffer.from(embedWork(validPng(), initialWork(mystery)));
    const expected = restorePng(new Uint8Array(legacy), mystery);
    expect(expected.schema).toBe(1);
    expect(teamName(expected)).toBe("");
    await begin(page, variant.file, "Vorheriger Name");
    await button(page, "Menü").tap();
    await load(page, legacy);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".team-summary")).toHaveCount(0);
    await expect(button(page, "Rückgängig")).toBeDisabled();
    await expect(button(page, "Wiederholen")).toBeDisabled();
    // Import remains valid without a name and the existing work stays usable.
    await card(page, mystery.cards[0].id).tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      `Karte ${cardNumber(mystery, mystery.cards[0].id)}`,
    );
    await close(page);

    // A compact export requests the missing name. Cancelling neither exports
    // an older snapshot nor clears the imported work.
    await button(page, "Menü").tap();
    await button(page, "Kleineres Sicherungsbild").tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await expect(teamField(page)).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Sicherungsbild herunterladen" }),
    ).toHaveCount(0);
    await close(page);
    await expect(page.locator("[data-card]")).toHaveCount(mystery.cards.length);
    await expect(page.locator(".team-summary")).toHaveCount(0);

    // Supplying a name resumes the explicitly requested normal export. The
    // complete state must equal the legacy state plus this name only.
    await button(page, "Sichern").tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await teamField(page).fill("Nach alter Sicherung");
    await button(page, "Übernehmen").tap();
    const named = withTeam(expected, "Nach alter Sicherung");
    expect(
      restorePng(new Uint8Array(await downloadReady(page)), mystery),
    ).toEqual(named);
    await close(page);

    // UNI-01 deliberately replaces the old expectation that deleting a name
    // creates a valid nameless new export. Legacy data acceptance is unchanged.
    for (const invalid of ["", "   "]) {
      await button(page, "Menü").tap();
      await button(page, "Teamname ändern").tap();
      await teamField(page).fill(invalid);
      await button(page, "Übernehmen").tap();
      await expect(page.getByRole("alert")).toContainText(
        "Bitte gebt eine Teambezeichnung oder Vornamen ein.",
      );
      await expect(teamField(page)).toBeFocused();
      await expect(page.getByRole("dialog")).toHaveAccessibleName(
        "Teamname ändern",
      );
      await expect(page.locator(".team-summary")).toContainText(
        "Nach alter Sicherung",
      );
      await close(page);
    }
    expect(restorePng(new Uint8Array(await download(page)), mystery)).toEqual(
      named,
    );
    await close(page);

    // Rejected changes add no history entries: one undo restores the imported
    // teamless snapshot, which must pass through the same export gate again.
    await button(page, "Rückgängig").tap();
    await expect(page.locator(".team-summary")).toHaveCount(0);
    await button(page, "Menü").tap();
    await button(page, "Kleineres Sicherungsbild").tap();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await expect(teamField(page)).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Sicherungsbild herunterladen" }),
    ).toHaveCount(0);
    await teamField(page).fill("Erneut zugeordnet");
    await button(page, "Übernehmen").tap();
    const reassigned = withTeam(expected, "Erneut zugeordnet");
    expect(
      restorePng(new Uint8Array(await downloadReady(page)), mystery),
    ).toEqual(reassigned);
    await close(page);
    await expect(button(page, "Wiederholen")).toBeDisabled();
    await button(page, "Rückgängig").tap();
    await expect(page.locator(".team-summary")).toHaveCount(0);
    await button(page, "Wiederholen").tap();
    await expect(page.locator(".team-summary")).toContainText(
      "Erneut zugeordnet",
    );
    expect(restorePng(new Uint8Array(await download(page)), mystery)).toEqual(
      reassigned,
    );
    await close(page);
    results.push({
      variant: variant.key,
      legacySchema: expected.schema,
      exactRestorationWithSuppliedName: true,
      cancelledExportPreservedLegacyWork: true,
      emptyAndWhitespaceChangeRejected: true,
      undoToLegacyRequiresNameAgain: true,
      bothExportSizesAndRedoPreserveCompleteState: true,
    });
  }
  expect(observation).toEqual({ requests: [], errors: [] });
  await info.attach("legacy-compatibility.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
});

test("Boden übernimmt weder fremdes Mystery noch Inhaltsversion 1.0.0 und behält den geöffneten Teamstand", async ({
  page,
  context,
}) => {
  const mystery = validateMystery(soil),
    observation = observe(page, soilVariant.file);
  const expected = withTeam(initialWork(mystery), "Behaltene Gruppe");
  await begin(page, soilVariant.file, teamName(expected));
  const foreign = initialWork(validateMystery(other));
  const oldVersion: Work = { ...initialWork(mystery), version: "1.0.0" };
  for (const [work, message] of [
    [foreign, "anderen Mystery"],
    [oldVersion, "anderen Mystery-Version"],
  ] as const) {
    await button(page, "Menü").tap();
    await load(page, Buffer.from(embedWork(validPng(), work)));
    await expect(page.getByRole("status")).toContainText(message);
    await close(page);
    await expect(page.locator("[data-card]")).toHaveCount(18);
    await expect(page.locator(".team-summary")).toContainText(
      teamName(expected),
    );
    expect(restorePng(new Uint8Array(await download(page)), mystery)).toEqual(
      expected,
    );
    await close(page);
  }
  expect(observation).toEqual({ requests: [], errors: [] });
});

test("Export-Kopfzeile: lange untrennbare Titel und Teamangaben passen ohne Überlagerung in beide Bildgrößen", async ({
  page,
}, info) => {
  // Supplementary geometry/raster stress case; all interactive workflows above
  // use the actual standalone production HTMLs, not the development module.
  await page.goto("http://localhost:5173");
  const outputs = await page.evaluate(async () => {
    const { exportBoard } = await import(String("/src/core/export.ts"));
    const { initialWork, withTeam } = await import(
      String("/src/core/model.ts")
    );
    const { default: data } = await import(
      String("/tests/fixtures/reusable-five.json")
    );
    const mystery = { ...data, title: "W".repeat(100) },
      team = "M".repeat(80);
    const results = [];
    for (const mode of ["compact", "a3"]) {
      const output = await exportBoard(
        withTeam(initialWork(mystery), team),
        mystery,
        mode,
      );
      const header = output.headerBounds;
      const probe = document.createElement("canvas").getContext("2d")!;
      const measured = [header.title, header.team].map((region) => {
        probe.font = region.font;
        return {
          ...region,
          widths: region.lines.map(
            (line: string) => probe.measureText(line).width,
          ),
        };
      });
      const image = new Image(),
        objectUrl = URL.createObjectURL(output.blob);
      image.src = objectUrl;
      await image.decode();
      const raster = document.createElement("canvas");
      raster.width = output.width;
      raster.height = Math.ceil(header.boardTop);
      raster.getContext("2d")!.drawImage(image, 0, 0);
      URL.revokeObjectURL(objectUrl);
      results.push({
        mode,
        title: mystery.title,
        team,
        header,
        measured,
        width: output.width,
        height: output.height,
        raster: raster.toDataURL("image/png").split(",")[1],
      });
    }
    return results;
  });
  for (const output of outputs) {
    const { header, measured } = output;
    expect(header.title.y).toBe(header.team.y);
    expect(
      header.title.x + header.title.width + header.gap,
    ).toBeLessThanOrEqual(header.team.x + 0.001);
    expect(header.title.lines.join("")).toBe(output.title);
    expect(header.team.lines.join("")).toBe(output.team);
    expect(header.title.lines.length).toBeGreaterThan(1);
    expect(header.team.lines.length).toBeGreaterThan(1);
    expect(header.boardTop).toBeLessThan(output.height * 0.15);
    for (const region of measured) {
      expect(Math.max(...region.widths)).toBeLessThanOrEqual(region.width);
      expect(region.y + region.height).toBeLessThan(header.boardTop);
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(output.width);
    }
    const bytes = Buffer.from(output.raster, "base64");
    await writeFile(info.outputPath(`long-${output.mode}-header.png`), bytes);
    await info.attach(`long-${output.mode}-header.png`, {
      body: bytes,
      contentType: "image/png",
    });
    const { raster, ...geometry } = output;
    await info.attach(`long-${output.mode}-header.json`, {
      body: JSON.stringify(geometry, null, 2),
      contentType: "application/json",
    });
  }
});
