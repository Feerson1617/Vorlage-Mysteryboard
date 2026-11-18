import {
  test,
  expect,
  type Page,
  type Frame,
  type Browser,
  type TestInfo,
} from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  COLORS,
  cardNumber,
  validateMystery,
  initialWork,
  withTeam,
  type Mystery,
  type Work,
} from "../../src/core/model";
import { embedWork, restorePng } from "../../src/core/png";
import { validPng } from "../fixtures/png";

test.use({ hasTouch: true });
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});
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
const norm = (s: string) => s.normalize("NFKC").replace(/[\s\u00ad]+/g, "");
const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
const target = (n: number | "media") =>
  n === "media"
    ? "artifacts/tests/MysteryBoard-Vorlage-Medien.html"
    : `artifacts/tests/MysteryBoard-Vorlage-Geordnet-${n}.html`;
const content = async (n: number | "media") =>
  validateMystery(
    JSON.parse(
      await readFile(
        `tests/fixtures/${n === "media" ? "print-media" : `ordered-${n}`}.json`,
        "utf8",
      ),
    ),
  );
async function shot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: name === "startbildschirm" });
  await info.attach(name, { path, contentType: "image/png" });
}
async function open(page: Page, n: number | "media") {
  await page.context().setOffline(false);
  await page.goto(`http://localhost:5174/${target(n)}`);
  await page.context().setOffline(true);
}
async function begin(page: Page, n: number | "media", info?: TestInfo) {
  await open(page, n);
  await expect(page.locator(".number-guidance")).toHaveText(
    "Die Kartennummern helfen euch beim Wiederfinden. Sie geben keine richtige Reihenfolge vor.",
  );
  expect(
    await page
      .locator(".welcome")
      .evaluate((n) => n.scrollWidth <= window.innerWidth),
  ).toBe(true);
  if (info) await shot(page, info, "startbildschirm");
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Prüfgruppe Integration");
  await btn(page, "Beginnen").tap();
  await expect(page.locator("[data-card]")).toHaveCount(n === "media" ? 5 : n);
}
async function help(page: Page) {
  if (!(await btn(page, "Hilfe").isVisible())) await btn(page, "Menü").tap();
  await btn(page, "Hilfe").tap();
  await expect(
    page.getByRole("dialog", { name: "Hilfe", exact: true }),
  ).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((n) => [
      n.getAttribute("data-card"),
      n.getAttribute("data-x"),
      n.getAttribute("data-y"),
      n.querySelector("rect")!.getAttribute("fill"),
    ]),
    edges: [...document.querySelectorAll("[data-edge]")].map(
      (n) => n.outerHTML,
    ),
    undo: (
      document.querySelector('[aria-label="Rückgängig"]') as HTMLButtonElement
    ).disabled,
    redo: (
      document.querySelector('[aria-label="Wiederholen"]') as HTMLButtonElement
    ).disabled,
    dirty: !window.dispatchEvent(
      new Event("beforeunload", { cancelable: true }),
    ),
    team: document.querySelector(".team-summary")!.textContent,
  }));
}
async function drag(page: Page, id: number) {
  const b = (await card(page, id).boundingBox())!;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }],
    });
    for (let i = 1; i <= 4; i++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: b.x + b.width / 2 + i * 5,
            y: b.y + b.height / 2 + i * 3,
            id: 1,
          },
        ],
      });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function edge(page: Page, from: number, to: number, label: string) {
  await card(page, from).tap();
  await btn(page, "Mit einer Karte verbinden").tap();
  await page.locator(`[data-number="${to}"]`).tap();
  await page
    .getByLabel("Beschriftung (freiwillig)", { exact: true })
    .fill(label);
  await page
    .getByRole("combobox", { name: "Richtung", exact: true })
    .selectOption("1");
  await btn(page, "Übernehmen").tap();
}
async function save(page: Page, m: Mystery, info: TestInfo, name: string) {
  await btn(page, "Menü").tap();
  await btn(page, "Kleineres Sicherungsbild").tap();
  const link = page.getByRole("link", {
    name: "Sicherungsbild herunterladen",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 60000 });
  const pending = page.waitForEvent("download");
  await link.tap();
  const download = await pending;
  const path = info.outputPath(`${name}.png`);
  await download.saveAs(path);
  const bytes = await readFile(path);
  await info.attach(name, { path, contentType: "image/png" });
  await btn(page, "Schließen").tap();
  return { bytes, work: restorePng(bytes, m) };
}
async function load(page: Page, png: Buffer) {
  await btn(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await btn(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({ name: "Original.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function printFrame(page: Page, paper: "a4" | "a3") {
  await btn(page, "Menü").tap();
  await btn(page, "Druckfassung / PDF").tap();
  if (paper === "a3")
    await page
      .getByRole("combobox", { name: "Papierformat", exact: true })
      .selectOption("a3");
  const frame = (await (await page
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle())!.contentFrame())!;
  await expect(frame.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 60000 },
  );
  await expect(btn(page, "Drucken / PDF speichern")).toBeEnabled();
  return frame;
}
async function inspect(frame: Frame, m: Mystery, w: Work) {
  const pages = frame.locator(".print-page"),
    count = await pages.count();
  expect(count).toBeGreaterThan(1);
  await expect(frame.locator("article[data-card-id]")).toHaveCount(
    m.cards.length,
  );
  await expect(frame.locator("article[data-edge-id]")).toHaveCount(
    w.edges.length,
  );
  for (let i = 0; i < count; i++) {
    await expect(pages.nth(i).locator(".print-title")).toHaveText(m.title);
    await expect(pages.nth(i).locator(".print-team")).toHaveText(w.team!);
    await expect(pages.nth(i).locator(".print-page-number")).toHaveText(
      `Seite ${i + 1} von ${count}`,
    );
  }
  for (const c of m.cards) {
    expect(
      (
        await frame.locator(`[data-card-text="${c.id}"]`).allTextContents()
      ).join(""),
    ).toBe(c.text);
    const state = w.cards.find((x) => x.id === c.id)!;
    const overview = frame.locator(`[data-overview-card-id="${c.id}"]`);
    await expect(overview).toHaveAttribute("data-x", String(state.x));
    await expect(overview).toHaveAttribute("data-y", String(state.y));
    await expect(overview.locator("rect")).toHaveAttribute(
      "fill",
      COLORS[state.color],
    );
    await expect(overview.locator("circle")).toHaveAttribute("fill", "#334f40");
    await expect(
      frame.locator(`article[data-card-id="${c.id}"] .print-card-number`),
    ).toHaveText(`Karte ${cardNumber(m, c.id)}`);
    if (c.image) {
      const image = frame.locator(`[data-card-image="${c.id}"]`);
      await expect(image).toHaveAttribute("src", c.image);
      const ratios = await image.evaluate((n) => {
        const img = n as HTMLImageElement,
          b = n.getBoundingClientRect();
        return {
          source: img.naturalWidth / img.naturalHeight,
          printed: b.width / b.height,
        };
      });
      expect(ratios.printed).toBeCloseTo(ratios.source, 2);
    }
  }
  for (const e of w.edges) {
    const node = frame.locator(`article[data-edge-id="${e.id}"]`);
    await expect(node).toHaveAttribute("data-from", String(e.from));
    await expect(node).toHaveAttribute("data-to", String(e.to));
    await expect(node).toHaveAttribute("data-direction", String(e.direction));
    expect(
      (
        await frame.locator(`[data-edge-label="${e.id}"]`).allTextContents()
      ).join(""),
    ).toBe(e.label);
  }
  const referenceErrors = await frame.locator("[data-target-page]").evaluateAll(
    (nodes) =>
      nodes.filter((n) => {
        const target = document.querySelector(n.getAttribute("href")!);
        return (
          !target ||
          target.closest<HTMLElement>(".print-page")!.dataset.page !==
            n.getAttribute("data-target-page")
        );
      }).length,
  );
  expect(referenceErrors).toBe(0);
  expect(
    await frame
      .locator(".learning-help,.help-active-label,#orientation-state")
      .count(),
  ).toBe(0);
  const html = await frame.evaluate(() => document.documentElement.outerHTML);
  for (const c of m.help?.categories ?? [])
    expect(html.toLowerCase()).not.toContain(c.color.toLowerCase());
  return { count, html };
}
async function pdf(
  browser: Browser,
  frame: Frame,
  m: Mystery,
  w: Work,
  key: string,
  paper: "a4" | "a3",
  info: TestInfo,
) {
  const inspected = await inspect(frame, m, w),
    context = await browser.newContext({ offline: true });
  const dir = process.env.INTEGRATION_EXAMPLES_DIR || info.outputPath("pdf");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${key}-${paper}.pdf`),
    page = await context.newPage(),
    requests: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  try {
    // Chromium's native print-to-PDF backend, using the actual prepared frame.
    // No custom PDF drawing and no assertion that Safari's print UI was tested.
    await page.setContent(inspected.html);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    await page.pdf({
      path: file,
      preferCSSPageSize: true,
      printBackground: true,
    });
    const meta = execFileSync("pdfinfo", [file], { encoding: "utf8" });
    expect(Number(meta.match(/^Pages:\s+(\d+)/m)![1])).toBe(inspected.count);
    const size = meta.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m)!;
    expect(
      Math.abs(Number(size[1]) - (paper === "a4" ? 842 : 1191)),
    ).toBeLessThan(3);
    expect(
      Math.abs(Number(size[2]) - (paper === "a4" ? 595 : 842)),
    ).toBeLessThan(3);
    const text = execFileSync("pdftotext", ["-raw", file, "-"], {
        encoding: "utf8",
        maxBuffer: 20_000_000,
      }),
      compact = norm(text);
    for (const fragment of await frame
      .locator(
        "[data-card-text],[data-edge-label],.print-reference-row,.print-card-meta",
      )
      .allTextContents())
      if (norm(fragment)) expect(compact).toContain(norm(fragment));
    const pdfPages = text.split("\f").filter((x) => x.trim());
    expect(pdfPages).toHaveLength(inspected.count);
    for (let i = 0; i < pdfPages.length; i++) {
      expect(norm(pdfPages[i])).toContain(norm(m.title));
      expect(norm(pdfPages[i])).toContain(norm(w.team!));
      expect(norm(pdfPages[i])).toContain(
        norm(`Seite ${i + 1} von ${inspected.count}`),
      );
    }
    expect(requests).toEqual([]);
    await writeFile(join(dir, `${key}-${paper}.txt`), text);
    await writeFile(
      join(dir, `${key}-${paper}.json`),
      JSON.stringify(
        {
          paper,
          pages: inspected.count,
          bytes: (await readFile(file)).length,
          sha256: sha(await readFile(file)),
          pdfinfo: meta,
          cards: m.cards.length,
          edges: w.edges.length,
          requests,
          completeFragments: true,
          sourceHtmlSha256: sha(inspected.html),
        },
        null,
        2,
      ),
    );
    await info.attach(`${key}-${paper}`, {
      path: file,
      contentType: "application/pdf",
    });
    return inspected;
  } finally {
    await context.close();
  }
}

for (const viewport of views)
  test(`Integration Schülergruppe ${viewport.width}x${viewport.height}: Hilfe, A4/A3-PDF, Weiterarbeit und neue PNG-Sitzung`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    const m = await content(5),
      requests: string[] = [],
      errors: string[] = [];
    page.on("request", (r) => {
      if (
        /^https?:/.test(r.url()) &&
        r.url() !== `http://localhost:5174/${target(5)}`
      )
        requests.push(r.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await begin(page, 5, info);
    const initial = await snapshot(page);
    expect(initial.cards.map((c) => Number(c[0]))).toEqual([1, 2, 3, 4, 5]);
    await shot(page, info, "start-geordnet");
    for (let id = 1; id <= 5; id++) {
      await page.locator(`[data-number="${id}"]`).tap();
      await expect(page.locator(".reading p")).toHaveText(
        m.cards.find((c) => c.id === id)!.text,
      );
      await btn(page, "Schließen").tap();
    }
    await drag(page, 1);
    await card(page, 4).tap();
    await btn(page, "Violett").tap();
    await page.getByLabel("Name für diese Farbe").fill("Eigene Erklärung");
    await btn(page, "Schließen").tap();
    await edge(page, 1, 2, "Unsere erste begründete Vermutung");
    const beforeHelp = await snapshot(page);
    await help(page);
    await shot(page, info, "hilfe-1");
    await btn(page, "Weitere Hilfe anzeigen").tap();
    await shot(page, info, "hilfe-2");
    await btn(page, "Hilfe schließen").tap();
    await btn(page, "Menü").tap();
    await expect(btn(page, "Hilfe")).toHaveAttribute(
      "data-orientation-active",
      "true",
    );
    await expect(btn(page, "Hilfe")).toHaveAccessibleDescription(
      "Orientierungshilfe eingeschaltet.",
    );
    await expect(btn(page, "Hilfe")).toContainText("✓ Orientierung an");
    await shot(page, info, "orientierung-aktiv-menue");
    await btn(page, "Hilfe").tap();
    await btn(page, "Orientierung ausblenden").tap();
    await btn(page, "Hilfe schließen").tap();
    expect(await snapshot(page)).toEqual(beforeHelp);
    await edge(page, 3, 4, "Eine weitere eigene Beziehung");
    await help(page);
    await btn(page, "Weitere Hilfe anzeigen").tap();
    await btn(page, "Hilfe schließen").tap();
    const before = await save(page, m, info, "vor-druck"),
      stable = await snapshot(page);
    for (const paper of ["a4", "a3"] as const) {
      const frame = await printFrame(page, paper);
      await shot(page, info, `druckvorschau-${paper}`);
      await frame.evaluate(() => {
        (window as any).calls = 0;
        window.print = () => {
          (window as any).calls++;
        };
      });
      expect(await frame.evaluate(() => (window as any).calls)).toBe(0);
      await btn(page, "Drucken / PDF speichern").tap();
      expect(await frame.evaluate(() => (window as any).calls)).toBe(1);
      await pdf(
        browser,
        frame,
        m,
        before.work,
        `gruppe-${viewport.width}x${viewport.height}`,
        paper,
        info,
      );
      await btn(page, "Schließen").tap();
      expect(await snapshot(page)).toEqual(stable);
      await expect(page.locator('[data-number="1"] circle')).toHaveAttribute(
        "fill",
        m.help!.categories![0].color,
      );
    }
    const after = await save(page, m, info, "nach-druck");
    expect(after.bytes).toEqual(before.bytes);
    expect(after.work).toEqual(before.work);
    await drag(page, 5);
    await edge(page, 4, 5, "Nach dem Drucken weiterentwickelt");
    const final = await save(page, m, info, "weitergearbeitet");
    expect(final.work.edges).toHaveLength(3);
    const context = await browser.newContext({ hasTouch: true, viewport });
    try {
      const fresh = await context.newPage();
      await open(fresh, 5);
      await load(fresh, final.bytes);
      const restored = await save(fresh, m, info, "wiederhergestellt");
      expect(restored.work).toEqual(final.work);
      await expect(fresh.locator('[data-number="1"] circle')).toHaveAttribute(
        "fill",
        "#334f40",
      );
      await btn(fresh, "Menü").tap();
      await expect(btn(fresh, "Hilfe")).toHaveAttribute(
        "data-orientation-active",
        "false",
      );
      await expect(btn(fresh, "Hilfe")).toHaveAccessibleDescription(
        "Orientierungshilfe ausgeschaltet.",
      );
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
  });

for (const [i, n] of [12, 18, 60].entries())
  test(`Integration neutrale ${n} Karten: geordnete Positionen bleiben in A4 und A3 erhalten`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(180000);
    await page.setViewportSize(views[i]);
    const m = await content(n);
    await begin(page, n);
    await drag(page, 1);
    await edge(page, 1, 2, "Eigene neutrale Testbeziehung");
    const before = await save(page, m, info, "mengenstand"),
      stable = await snapshot(page);
    for (const paper of ["a4", "a3"] as const) {
      const frame = await printFrame(page, paper);
      await pdf(browser, frame, m, before.work, `neutral-${n}`, paper, info);
      await btn(page, "Schließen").tap();
      expect(await snapshot(page)).toEqual(stable);
    }
    expect((await save(page, m, info, "mengenstand-nach-druck")).bytes).toEqual(
      before.bytes,
    );
  });

test("Integration Medien: drei Seitenverhältnisse, langer Text, negative Positionen und 500 Zeichen Beziehung im echten PDF", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000);
  await page.setViewportSize(views[0]);
  const m = await content("media"),
    w = withTeam(initialWork(m), "Neutrale Medienprüfung");
  w.cards.forEach((c, i) => {
    c.x = i * 900 - 1800;
    c.y = i % 2 ? -500 : 700;
    c.color = i % COLORS.length;
  });
  w.categories = COLORS.map((_, i) => `Eigene Kategorie ${i}`);
  w.edges = [
    {
      id: 1,
      from: 1,
      to: 4,
      direction: 2,
      label: ("Anfang " + "Begründung ".repeat(50)).slice(0, 495) + " Ende",
    },
    { id: 2, from: 2, to: 3, direction: 0, label: "Ohne gerichteten Pfeil" },
  ];
  expect(w.edges[0].label.length).toBeLessThanOrEqual(500);
  await open(page, "media");
  await load(page, Buffer.from(embedWork(validPng(), w)));
  await help(page);
  await btn(page, "Weitere Hilfe anzeigen").tap();
  await btn(page, "Hilfe schließen").tap();
  const stable = await snapshot(page);
  for (const paper of ["a4", "a3"] as const) {
    const frame = await printFrame(page, paper);
    await pdf(browser, frame, m, w, "medien-langtext", paper, info);
    await shot(page, info, `medien-vorschau-${paper}`);
    await btn(page, "Schließen").tap();
    expect(await snapshot(page)).toEqual(stable);
  }
  expect((await save(page, m, info, "medien-original")).work).toEqual(w);
});

test("Integration breite Werkzeugleiste: aktive Hilfe sichtbar und mit Tastatur beschrieben", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await begin(page, 5, info);
  await btn(page, "Hilfe").press("Enter");
  await btn(page, "Weitere Hilfe anzeigen").press("Enter");
  await page.keyboard.press("Escape");
  await expect(btn(page, "Hilfe")).toBeFocused();
  await expect(btn(page, "Hilfe")).toHaveAccessibleDescription(
    "Orientierungshilfe eingeschaltet.",
  );
  await expect(btn(page, "Hilfe").locator(".help-active-mark")).toHaveText("✓");
  await shot(page, info, "orientierung-aktiv-werkzeugleiste");
  await btn(page, "Hilfe").press("Enter");
  await btn(page, "Orientierung ausblenden").press("Enter");
  await page.keyboard.press("Escape");
  await expect(btn(page, "Hilfe")).toHaveAccessibleDescription(
    "Orientierungshilfe ausgeschaltet.",
  );
});
