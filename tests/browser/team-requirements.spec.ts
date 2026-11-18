import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import small from "../../src/content/small.json" with { type: "json" };
import large from "../../src/content/large.json" with { type: "json" };
import soil from "../../src/content/boden-klasse11.json" with { type: "json" };
import neutral from "../fixtures/reusable-five.json" with { type: "json" };
import {
  initialWork,
  MAX_TEAM_NAME,
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
    data: neutral,
  },
];
const soilVariant = variants[2];
const soilMystery = validateMystery(soil);
const requiredMessage = "Bitte gebt eine Teambezeichnung oder Vornamen ein.";
const maximumName =
  "Jörg, Özlem und Änne – " +
  "B".repeat(MAX_TEAM_NAME - "Jörg, Özlem und Änne – ".length);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const field = (page: Page) =>
  page.getByRole("textbox", { name: "Teamname oder Vornamen", exact: true });
const offered = (page: Page) =>
  page.getByRole("link", { name: "Sicherungsbild herunterladen", exact: true });
const close = (page: Page) => button(page, "Schließen").tap();
const artifactUrl = (file: string) => `http://localhost:5174/${file}`;
function observe(page: Page, file: string) {
  const requests: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    const initialDocument =
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      request.frame() === page.mainFrame() &&
      request.url() === artifactUrl(file);
    if (/^https?:/.test(request.url()) && !initialDocument)
      requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { requests, errors };
}
async function openArtifact(page: Page, file: string) {
  // Managed browser policy blocks file://. Only this exact HTML document is
  // fetched locally; every interaction and fresh import runs disconnected.
  await page.context().setOffline(false);
  await page.goto(artifactUrl(file));
  await page.context().setOffline(true);
}
async function begin(page: Page, name: string, file = soilVariant.file) {
  await openArtifact(page, file);
  await field(page).fill(name);
  await button(page, "Beginnen").tap();
}
async function openRename(page: Page) {
  await button(page, "Menü").tap();
  await button(page, "Teamname ändern").tap();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Teamname ändern",
  );
}
async function rename(page: Page, name: string) {
  await openRename(page);
  await field(page).fill(name);
  await button(page, "Übernehmen").tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function assertInvalid(
  page: Page,
  submit: "Beginnen" | "Übernehmen",
  value: string,
) {
  await field(page).fill(value);
  await button(page, submit).tap();
  await expect(page.getByRole("alert")).toHaveText(requiredMessage);
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");
  await expect(offered(page)).toHaveCount(0);
  await expect(page.getByAltText("Vorschau des Sicherungsbildes")).toHaveCount(
    0,
  );
}
async function startExport(
  page: Page,
  path: "a3" | "menu" | "preview-compact",
) {
  if (path === "menu") {
    await button(page, "Menü").tap();
    await button(page, "Kleineres Sicherungsbild").tap();
  } else await button(page, "Sichern").tap();
}
async function readOffered(page: Page) {
  await expect(offered(page)).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await offered(page).tap();
  return readFile((await (await download).path())!);
}
async function loadPng(page: Page, png: Buffer, active = false) {
  if (active) await button(page, "Menü").tap();
  await button(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({
    name: "Unveraenderte-Originalsicherung.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
function legacyState(): Work {
  const state = initialWork(soilMystery);
  state.cards[0].x += 21;
  state.cards[0].color = 2;
  state.categories[2] = "Schon zugeordnet";
  state.edges.push({
    id: 73,
    from: 1,
    to: 2,
    direction: 1,
    label: "Ursprüngliche Beziehung",
  });
  return state;
}
async function assertSoilState(page: Page, state: Work) {
  await expect(page.locator("[data-card]")).toHaveCount(state.cards.length);
  for (const card of state.cards) {
    const node = page.locator(`[data-card="${card.id}"]`);
    await expect(node).toHaveAttribute("data-x", String(card.x));
    await expect(node).toHaveAttribute("data-y", String(card.y));
  }
  await expect(page.locator("[data-edge]")).toHaveCount(state.edges.length);
  for (const edge of state.edges)
    await expect(page.locator(`[data-edge-label="${edge.id}"]`)).toContainText(
      edge.label,
    );
}
async function assertNoPersistence(page: Page) {
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
}

for (const variant of variants) {
  test(`UNI-01 ${variant.key}: Start benötigt Namen; leere Änderung erhält den bestehenden Namen`, async ({
    page,
  }) => {
    const observation = observe(page, variant.file),
      mystery = validateMystery(variant.data);
    await openArtifact(page, variant.file);
    for (const invalid of ["", "   "]) {
      await assertInvalid(page, "Beginnen", invalid);
      await expect(page.locator("[data-card]")).toHaveCount(0);
      await expect(button(page, "Beginnen")).toBeVisible();
    }
    const original = "Team Marschboden",
      changed = "Jörg, Özlem und Änne";
    await field(page).fill(original);
    await button(page, "Beginnen").tap();
    await expect(page.locator("[data-card]")).toHaveCount(mystery.cards.length);
    await openRename(page);
    for (const invalid of ["", "   "]) {
      await assertInvalid(page, "Übernehmen", invalid);
      await expect(page.locator(".team-summary")).toHaveText(original);
      await expect(page.locator("[data-card]")).toHaveCount(
        mystery.cards.length,
      );
    }
    await close(page);
    await expect(page.locator(".team-summary")).toHaveText(original);
    await rename(page, changed);
    await button(page, "Rückgängig").tap();
    await expect(page.locator(".team-summary")).toHaveText(original);
    await button(page, "Wiederholen").tap();
    await expect(page.locator(".team-summary")).toHaveText(changed);
    await startExport(page, "menu");
    expect(
      restorePng(new Uint8Array(await readOffered(page)), mystery),
    ).toEqual(withTeam(initialWork(mystery), changed));
    expect(observation).toEqual({ requests: [], errors: [] });
    await assertNoPersistence(page);
  });
}

for (const path of ["a3", "menu", "preview-compact"] as const) {
  test(`UNI-01 Legacy und Export ${path}: importierbar, bearbeitbar, Name nachtragen, frischer PNG-Rundlauf`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120000);
    const observation = observe(page, soilVariant.file),
      legacy = legacyState();
    const legacyPng = Buffer.from(embedWork(validPng(), legacy));
    expect(restorePng(new Uint8Array(legacyPng), soilMystery)).toEqual(legacy);
    await openArtifact(page, soilVariant.file);
    await loadPng(page, legacyPng);
    await assertSoilState(page, legacy);
    await expect(page.locator(".team-summary")).toHaveCount(0);
    await expect(button(page, "Rückgängig")).toBeDisabled();
    await page.locator('[data-card="1"] > rect').tap();
    await button(page, "Rot").tap();
    await close(page);
    const edited = structuredClone(legacy);
    edited.cards.find((card) => card.id === 1)!.color = 5;
    await startExport(page, path);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await assertInvalid(page, "Übernehmen", "   ");
    await close(page);
    await assertSoilState(page, edited);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Invalid submission and cancellation must not add a history entry.
    await button(page, "Rückgängig").tap();
    await expect(button(page, "Rückgängig")).toBeDisabled();
    await button(page, "Wiederholen").tap();
    await startExport(page, path);
    const name = "Team Äcker und Böden";
    await field(page).fill(name);
    await button(page, "Übernehmen").tap();
    await expect(offered(page)).toBeVisible({ timeout: 45000 });
    if (path === "preview-compact") {
      await button(page, "Kleineres Bild erzeugen").tap();
    }
    const png = await readOffered(page),
      expected = withTeam(edited, name);
    expect(restorePng(new Uint8Array(png), soilMystery)).toEqual(expected);
    expect(png.readUInt32BE(16)).toBe(path === "a3" ? 4961 : 2480);
    await info.attach(`${path}-named-restorable.png`, {
      body: png,
      contentType: "image/png",
    });
    const freshContext = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    });
    try {
      const fresh = await freshContext.newPage(),
        freshObservation = observe(fresh, soilVariant.file);
      await openArtifact(fresh, soilVariant.file);
      await loadPng(fresh, png);
      await assertSoilState(fresh, expected);
      await expect(fresh.locator(".team-summary")).toHaveText(name);
      await expect(button(fresh, "Rückgängig")).toBeDisabled();
      await expect(button(fresh, "Wiederholen")).toBeDisabled();
      await startExport(fresh, "menu");
      expect(
        restorePng(new Uint8Array(await readOffered(fresh)), soilMystery),
      ).toEqual(expected);
      expect(freshObservation).toEqual({ requests: [], errors: [] });
      await assertNoPersistence(fresh);
    } finally {
      await freshContext.close();
    }
    expect(observation).toEqual({ requests: [], errors: [] });
    await assertNoPersistence(page);
  });
}

test("UNI-01 Undo/Redo, Abbruch und alte Vorschau können die Namensprüfung nicht umgehen", async ({
  page,
}) => {
  test.setTimeout(120000);
  const observation = observe(page, soilVariant.file);
  await begin(page, "Früherer Name");
  await startExport(page, "menu");
  const oldPng = await readOffered(page);
  expect(restorePng(new Uint8Array(oldPng), soilMystery).team).toBe(
    "Früherer Name",
  );
  await close(page);
  await button(page, "Rückgängig").tap();
  await expect(page.locator(".team-summary")).toHaveCount(0);
  for (const path of ["a3", "menu"] as const) {
    await startExport(page, path);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(
      "Teamname ändern",
    );
    await expect(offered(page)).toHaveCount(0);
    await expect(
      page.getByAltText("Vorschau des Sicherungsbildes"),
    ).toHaveCount(0);
    await close(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[data-card]")).toHaveCount(18);
  }
  await button(page, "Wiederholen").tap();
  await expect(page.locator(".team-summary")).toHaveText("Früherer Name");
  await startExport(page, "menu");
  expect(
    restorePng(new Uint8Array(await readOffered(page)), soilMystery).team,
  ).toBe("Früherer Name");
  await close(page);
  // A different imported legacy state must never expose the preceding PNG.
  const imported = legacyState();
  await loadPng(page, Buffer.from(embedWork(validPng(), imported)), true);
  await startExport(page, "a3");
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Teamname ändern",
  );
  await expect(offered(page)).toHaveCount(0);
  await close(page);
  await rename(page, "Bewusster neuer Name");
  // Canceling a pending export also cancels its continuation. A later ordinary
  // name edit must not unexpectedly export or resurrect the old download.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(offered(page)).toHaveCount(0);
  await startExport(page, "menu");
  const newPng = await readOffered(page);
  expect(newPng.equals(oldPng)).toBe(false);
  expect(restorePng(new Uint8Array(newPng), soilMystery)).toEqual(
    withTeam(imported, "Bewusster neuer Name"),
  );
  expect(observation).toEqual({ requests: [], errors: [] });
});

type HeaderLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  align: string;
  ascent: number;
  descent: number;
  canvasWidth: number;
};
async function recordHeader(page: Page) {
  await page.evaluate(() => {
    const scope = window as unknown as { uniHeader: HeaderLine[] };
    scope.uniHeader = [];
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      const transform = this.getTransform();
      if (
        this.canvas.width >= 2480 &&
        transform.isIdentity &&
        y < this.canvas.height / 2
      ) {
        const metrics = this.measureText(text);
        scope.uniHeader.push({
          text,
          x,
          y,
          width: metrics.width,
          align: this.textAlign,
          ascent: metrics.actualBoundingBoxAscent,
          descent: metrics.actualBoundingBoxDescent,
          canvasWidth: this.canvas.width,
        });
      }
      if (maxWidth === undefined) draw.call(this, text, x, y);
      else draw.call(this, text, x, y, maxWidth);
    };
  });
}
async function saveHeaderEvidence(page: Page, png: Buffer, info: TestInfo) {
  const rows = await page.evaluate(
    () => (window as unknown as { uniHeader: HeaderLine[] }).uniHeader,
  );
  const left = rows.filter((row) => row.align === "left"),
    right = rows.filter((row) => row.align === "right");
  expect(
    left
      .map((row) => row.text)
      .join("")
      .replace(/\s/g, ""),
  ).toBe(soil.title.replace(/\s/g, ""));
  expect(
    right
      .map((row) => row.text)
      .join("")
      .replace(/\s/g, ""),
  ).toBe(maximumName.replace(/\s/g, ""));
  expect(left[0].y).toBe(right[0].y);
  expect(Math.max(...left.map((row) => row.x + row.width))).toBeLessThan(
    Math.min(...right.map((row) => row.x - row.width)),
  );
  for (const row of rows) {
    expect(
      row.align === "right" ? row.x - row.width : row.x,
    ).toBeGreaterThanOrEqual(0);
    expect(
      row.align === "right" ? row.x : row.x + row.width,
    ).toBeLessThanOrEqual(row.canvasWidth);
    expect(row.y - row.ascent).toBeGreaterThanOrEqual(0);
  }
  const height = Math.ceil(
    Math.max(...rows.map((row) => row.y + row.descent)) + 30,
  );
  const raster = await page.evaluate(
    async ({ base64, height }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { base64: png.toString("base64"), height },
  );
  await writeFile(
    info.outputPath("80-zeichen-export-kopfzeile.png"),
    Buffer.from(raster, "base64"),
  );
  await info.attach("80-zeichen-export-kopfzeile.png", {
    body: Buffer.from(raster, "base64"),
    contentType: "image/png",
  });
  await info.attach("80-zeichen-export-koordinaten.json", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });
}

test("UNI-01/02: 80 Zeichen und Umlaute bleiben in Bild, PNG-Daten und frischer Wiederherstellung vollständig", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  expect(maximumName.length).toBe(80);
  await begin(page, maximumName);
  await openRename(page);
  await expect(field(page)).toHaveAttribute("maxlength", "80");
  await expect(field(page)).toHaveValue(maximumName);
  await close(page);
  await recordHeader(page);
  await startExport(page, "menu");
  const png = await readOffered(page);
  expect(restorePng(new Uint8Array(png), soilMystery)).toEqual(
    withTeam(initialWork(soilMystery), maximumName),
  );
  await saveHeaderEvidence(page, png, info);
  await info.attach("80-zeichen-original.png", {
    body: png,
    contentType: "image/png",
  });
  const freshContext = await browser.newContext({
    hasTouch: true,
    viewport: { width: 768, height: 1024 },
  });
  try {
    const fresh = await freshContext.newPage();
    await openArtifact(fresh, soilVariant.file);
    await loadPng(fresh, png);
    await button(fresh, "Menü").tap();
    await expect(fresh.locator(".menu-team")).toHaveText(
      `Team: ${maximumName}`,
    );
    await button(fresh, "Teamname ändern").tap();
    await expect(field(fresh)).toHaveValue(maximumName);
  } finally {
    await freshContext.close();
  }
});

const viewports = [
  { width: 320, height: 800 },
  { width: 480, height: 800 },
  { width: 600, height: 900 },
  { width: 601, height: 900 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];
for (const viewport of viewports) {
  test(`UNI-02 ${viewport.width}×${viewport.height}: Team rechts, eine Werkzeugzeile, alle Bedienelemente zugänglich`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    const observation = observe(page, soilVariant.file);
    const evidence: unknown[] = [];
    for (const [index, name] of [
      "Team Marschboden",
      "Emma, Leon und Mia",
      maximumName,
    ].entries()) {
      if (index === 0) await begin(page, name);
      else await rename(page, name);
      const metrics = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(".toolbar")!,
          nav = header.querySelector<HTMLElement>("nav")!,
          team = header.querySelector<HTMLElement>(".team-summary")!,
          board = document.querySelector<SVGElement>(".board")!;
        const rect = (node: Element) => {
          const r = node.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const range = document.createRange();
        range.selectNodeContents(team);
        const text = range.getBoundingClientRect();
        return {
          header: rect(header),
          nav: rect(nav),
          team: rect(team),
          board: rect(board),
          text: { x: text.x, right: text.right },
          teamFont: parseFloat(getComputedStyle(team).fontSize),
          teamVisible: getComputedStyle(team).display !== "none",
          clientWidth: team.clientWidth,
          scrollWidth: team.scrollWidth,
          inputCount: header.querySelectorAll("input").length,
          buttons: [...nav.querySelectorAll("button")].map(rect),
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      evidence.push({ name, viewport, metrics });
      expect(metrics.header.height).toBeLessThanOrEqual(78);
      expect(metrics.inputCount).toBe(0);
      expect(metrics.buttons).toHaveLength(5);
      expect(metrics.pageWidth).toBeLessThanOrEqual(viewport.width);
      expect(metrics.board.y).toBeCloseTo(metrics.header.bottom, 0);
      for (const control of metrics.buttons) {
        expect(control.width).toBeGreaterThanOrEqual(48);
        expect(control.height).toBeGreaterThanOrEqual(48);
        expect(control.x).toBeGreaterThanOrEqual(0);
        expect(control.right).toBeLessThanOrEqual(viewport.width);
        expect(control.y).toBeGreaterThanOrEqual(metrics.header.y);
        expect(control.bottom).toBeLessThanOrEqual(metrics.header.bottom);
      }
      for (let i = 1; i < metrics.buttons.length; i++)
        expect(metrics.buttons[i].x).toBeGreaterThanOrEqual(
          metrics.buttons[i - 1].right,
        );
      if (viewport.width > 420) {
        expect(metrics.teamVisible).toBe(true);
        expect(metrics.team.x).toBeGreaterThanOrEqual(metrics.nav.right);
        expect(metrics.team.right).toBeLessThanOrEqual(viewport.width);
        expect(metrics.team.right).toBeGreaterThan(viewport.width / 2);
        expect(
          Math.abs(
            metrics.team.y +
              metrics.team.height / 2 -
              metrics.nav.y -
              metrics.nav.height / 2,
          ),
        ).toBeLessThan(2);
        if (viewport.width >= 768 && index < 2) {
          expect(metrics.teamFont).toBeGreaterThanOrEqual(16);
          expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
          expect(metrics.text.x).toBeGreaterThanOrEqual(metrics.team.x - 0.5);
          expect(metrics.text.right).toBeLessThanOrEqual(
            metrics.team.right + 0.5,
          );
        }
      }
      await page.screenshot({
        path: info.outputPath(`team-${viewport.width}-${index}.png`),
      });
      // A deliberate native tap remains usable, including the narrow layout.
      await button(page, "Übersicht").tap();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await button(page, "Menü").tap();
      await expect(page.locator(".menu-team")).toBeVisible();
      await expect(page.locator(".menu-team")).toHaveText(`Team: ${name}`);
      const menuName = await page
        .locator(".menu-team")
        .evaluate((node) => ({
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          right: node.getBoundingClientRect().right,
        }));
      expect(menuName.scrollWidth).toBeLessThanOrEqual(menuName.clientWidth);
      expect(menuName.right).toBeLessThanOrEqual(viewport.width);
      if (index === 2)
        await page.screenshot({
          path: info.outputPath(`team-${viewport.width}-full-menu.png`),
        });
      await close(page);
    }
    await info.attach("layout-measurements.json", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    expect(observation).toEqual({ requests: [], errors: [] });
    await assertNoPersistence(page);
  });
}
