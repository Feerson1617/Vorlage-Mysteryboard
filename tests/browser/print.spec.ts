import {
  test,
  expect,
  type Page,
  type Frame,
  type TestInfo,
  type Browser,
} from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import small from "../../src/content/small.json" with { type: "json" };
import large from "../../src/content/large.json" with { type: "json" };
import soil from "../../src/content/boden-klasse11.json" with { type: "json" };
import stress from "../fixtures/review/stress-220.json" with { type: "json" };
import neutral from "../fixtures/reusable-five.json" with { type: "json" };
import {
  cardNumber,
  COLORS,
  initialWork,
  validateMystery,
  validateWork,
  withTeam,
  type Mystery,
  type Work,
} from "../../src/core/model";
import { packWork } from "../../src/core/codec";
import { embedWork, restorePng } from "../../src/core/png";
import { validPng } from "../fixtures/png";

test.use({ hasTouch: true });
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});
const examples = process.env.PRINT_EXAMPLES_DIR;
const variants = [
  { key: "12", file: "artifacts/MysteryBoard-klein.html", data: small },
  {
    key: "18",
    file: "artifacts/previews/MysteryBoard-Boden-Klasse11.html",
    data: soil,
  },
  { key: "60", file: "artifacts/MysteryBoard-umfangreich.html", data: large },
  {
    key: "220",
    file: "artifacts/tests/MysteryBoard-Pruefung-220.html",
    data: stress,
  },
  { key: "5", file: "artifacts/tests/MysteryBoard-Test-5.html", data: neutral },
];
const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const close = (page: Page) => btn(page, "Schließen").tap();
const normalized = (text: string) =>
  text.normalize("NFKC").replace(/[\s\u00ad]+/g, "");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function printWork(mystery: Mystery, key: string) {
  const work = withTeam(
    initialWork(mystery),
    `Technische Testgruppe ${key} – keine Musterlösung`,
  );
  work.categories = work.categories.map(
    (label, index) => label || `Testkategorie ${index}`,
  );
  if (!work.edges.length)
    work.edges.push({
      id: 1,
      from: 1,
      to:
        mystery.cards.find(
          (card) => card.group && mystery.cardGroups?.[card.group].prefix,
        )?.id || 2,
      direction: 1,
      label: "Technische Testverbindung – keine fachliche Lösung",
    });
  return validateWork(work, mystery);
}
function observe(page: Page, file: string) {
  const requests: string[] = [],
    errors: string[] = [],
    url = `http://localhost:5174/${file}`;
  page.on("request", (request) => {
    const document =
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      request.frame() === page.mainFrame() &&
      request.url() === url;
    if (/^https?:/.test(request.url()) && !document)
      requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { requests, errors };
}
async function load(page: Page, file: string, work: Work) {
  await page.context().setOffline(false);
  await page.goto(`http://localhost:5174/${file}`);
  await page.context().setOffline(true);
  await expect(btn(page, "Fortsetzen")).toBeVisible();
  await btn(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await btn(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({
    name: "Drucktest-Original.png",
    mimeType: "image/png",
    buffer: Buffer.from(embedWork(validPng(), work)),
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-card]")).toHaveCount(work.cards.length);
}
async function save(page: Page) {
  await btn(page, "Menü").tap();
  await btn(page, "Kleineres Sicherungsbild").tap();
  const link = page.getByRole("link", {
    name: "Sicherungsbild herunterladen",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 60000 });
  const pending = page.waitForEvent("download");
  await link.tap();
  const png = await readFile((await (await pending).path())!);
  await close(page);
  return png;
}
async function printFrame(page: Page, paper: "a4" | "a3" = "a4") {
  await btn(page, "Menü").tap();
  await btn(page, "Druckfassung / PDF").tap();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Druckfassung / PDF",
  );
  if (paper === "a3")
    await page
      .getByRole("combobox", { name: "Papierformat", exact: true })
      .selectOption("a3");
  const frame = await (await page
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle())!.contentFrame();
  expect(frame).not.toBeNull();
  await expect(frame!.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 60000 },
  );
  await expect(btn(page, "Drucken / PDF speichern")).toBeEnabled();
  return frame!;
}

async function inspectPrint(frame: Frame, mystery: Mystery, work: Work) {
  const pages = frame.locator(".print-page"),
    total = await pages.count();
  expect(total).toBeGreaterThan(1);
  const firstCards = frame.locator("article[data-card-id]"),
    firstEdges = frame.locator("article[data-edge-id]");
  expect(
    await firstCards.evaluateAll((nodes) =>
      nodes
        .map((node) => Number(node.getAttribute("data-card-id")))
        .sort((a, b) => a - b),
    ),
  ).toEqual(mystery.cards.map((card) => card.id).sort((a, b) => a - b));
  expect(
    await firstEdges.evaluateAll((nodes) =>
      nodes
        .map((node) => Number(node.getAttribute("data-edge-id")))
        .sort((a, b) => a - b),
    ),
  ).toEqual(work.edges.map((edge) => edge.id).sort((a, b) => a - b));
  expect(await frame.locator("[data-overview-card-id]").count()).toBe(
    mystery.cards.length,
  );
  expect(await frame.locator("[data-overview-edge-id]").count()).toBe(
    work.edges.length,
  );
  for (let index = 0; index < total; index++) {
    const page = pages.nth(index);
    await expect(page).toHaveAttribute("data-page", String(index + 1));
    await expect(page.locator(".print-page-number")).toHaveText(
      `Seite ${index + 1} von ${total}`,
    );
    await expect(page.locator(".print-title")).toHaveText(mystery.title);
    await expect(page.locator(".print-team")).toHaveText(work.team!);
  }
  for (const content of mystery.cards) {
    const parts = frame.locator(`[data-card-part="${content.id}"]`),
      first = frame.locator(`article[data-card-id="${content.id}"]`);
    expect(
      normalized(
        await frame
          .locator(`[data-card-text="${content.id}"]`)
          .allTextContents()
          .then((texts) => texts.join("")),
      ),
    ).toBe(normalized(content.text));
    await expect(first.locator(".print-card-number")).toContainText(
      cardNumber(mystery, content.id),
    );
    const state = work.cards.find((card) => card.id === content.id)!;
    await expect(first).toHaveAttribute(
      "data-color-index",
      String(state.color),
    );
    const rgb = COLORS[state.color]
      .match(/\w\w/g)!
      .map((hex) => parseInt(hex, 16))
      .join(", ");
    await expect(first).toHaveCSS("border-left-color", `rgb(${rgb})`);
    expect(normalized((await first.textContent()) || "")).toContain(
      normalized(content.title),
    );
    if (content.group)
      expect(await first.textContent()).toContain(
        mystery.cardGroups![content.group].label,
      );
    const targetPage = Number(
      await first.evaluate((node) =>
        node.closest(".print-page")!.getAttribute("data-page"),
      ),
    );
    const references = frame.locator(`[data-card-reference="${content.id}"]`);
    for (const reference of await references.all()) {
      await expect(reference).toHaveAttribute("href", `#card-${content.id}`);
      await expect(reference.locator(".page-ref")).toHaveText(
        `Seite ${targetPage}`,
      );
      await expect(reference).toHaveAttribute(
        "data-target-page",
        String(targetPage),
      );
      expect(await reference.textContent()).toContain(
        cardNumber(mystery, content.id),
      );
    }
    for (const edge of work.edges.filter(
      (edge) => edge.from === content.id || edge.to === content.id,
    )) {
      const links = parts.locator(`[data-edge-reference="${edge.id}"]`);
      expect(await links.count()).toBeGreaterThan(0);
      const edgePage = Number(
        await frame
          .locator(`article[data-edge-id="${edge.id}"]`)
          .evaluate((node) =>
            node.closest(".print-page")!.getAttribute("data-page"),
          ),
      );
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute("href", `#edge-${edge.id}`);
        await expect(link.locator(".page-ref")).toHaveText(`Seite ${edgePage}`);
        await expect(link).toHaveAttribute(
          "data-target-page",
          String(edgePage),
        );
      }
    }
  }
  for (const edge of work.edges) {
    const first = frame.locator(`article[data-edge-id="${edge.id}"]`);
    await expect(first).toHaveAttribute("data-from", String(edge.from));
    await expect(first).toHaveAttribute("data-to", String(edge.to));
    await expect(first).toHaveAttribute(
      "data-direction",
      String(edge.direction),
    );
    const direction = `${cardNumber(mystery, edge.from)} ${edge.direction === 0 ? "—" : edge.direction === 1 ? "→" : "←"} ${cardNumber(mystery, edge.to)}`;
    await expect(first.locator(".print-edge-title")).toContainText(direction);
    expect(
      normalized(
        await frame
          .locator(`[data-edge-label="${edge.id}"]`)
          .allTextContents()
          .then((texts) => texts.join("")),
      ),
    ).toBe(normalized(edge.label));
    const endpoints = await frame
      .locator(`[data-edge-part="${edge.id}"] [data-card-reference]`)
      .evaluateAll((nodes) =>
        [
          ...new Set(
            nodes.map((node) =>
              Number(node.getAttribute("data-card-reference")),
            ),
          ),
        ].sort((a, b) => a - b),
      );
    expect(endpoints).toEqual([edge.from, edge.to].sort((a, b) => a - b));
  }
  for (const [index, category] of work.categories.entries()) {
    const item = frame
      .locator(`.print-category[data-color-index="${index}"]`)
      .first();
    await expect(item).toBeVisible();
    if (category) await expect(item).toContainText(category);
  }
  expect(await frame.locator("[data-card-image]").count()).toBe(
    mystery.cards.filter((card) => card.image).length,
  );
  expect(await frame.locator("canvas").count()).toBe(0);
  const geometry = await frame.evaluate(() => {
    const issues: string[] = [],
      sizes: number[] = [],
      summaries: {
        page: number;
        section: string | undefined;
        cards: number;
        edges: number;
      }[] = [];
    const overview = document.querySelector<SVGSVGElement>(
      ".print-overview-svg",
    )!;
    const drawing = overview.getBBox(),
      view = overview.viewBox.baseVal;
    if (
      drawing.x < view.x - 2 ||
      drawing.y < view.y - 2 ||
      drawing.x + drawing.width > view.x + view.width + 2 ||
      drawing.y + drawing.height > view.y + view.height + 2
    )
      issues.push("overview: drawing extends beyond viewBox");
    for (const image of document.querySelectorAll<HTMLImageElement>(
      "[data-card-image]",
    )) {
      const embedded = document.querySelector<SVGImageElement>(
        `[data-overview-card-id="${image.dataset.cardImage}"] image`,
      )!;
      if (
        !embedded ||
        Math.abs(
          Number(embedded.getAttribute("width")) /
            Number(embedded.getAttribute("height")) -
            image.naturalWidth / image.naturalHeight,
        ) > 0.01
      )
        issues.push("overview image aspect ratio differs from source");
      const bounds = image.getBoundingClientRect(),
        body = image
          .closest(".print-page")!
          .querySelector(".print-body")!
          .getBoundingClientRect();
      if (
        !image.complete ||
        !image.naturalWidth ||
        Math.abs(
          bounds.width / bounds.height -
            image.naturalWidth / image.naturalHeight,
        ) > 0.01
      )
        issues.push("image distorted or not decoded");
      if (
        bounds.left < body.left - 1 ||
        bounds.right > body.right + 1 ||
        bounds.top < body.top - 1 ||
        bounds.bottom > body.bottom + 1
      )
        issues.push("image clips outside printable area");
    }
    for (const node of document.querySelectorAll<HTMLElement>(".print-page")) {
      const page = Number(node.dataset.page),
        box = node.getBoundingClientRect(),
        header = node.querySelector<HTMLElement>(".print-header")!,
        footer = node.querySelector<HTMLElement>(".print-page-number")!;
      const title = node.querySelector<HTMLElement>(".print-title")!,
        team = node.querySelector<HTMLElement>(".print-team")!;
      if (
        title.getBoundingClientRect().right >
        team.getBoundingClientRect().left + 1
      )
        issues.push(`page ${page}: header regions overlap`);
      for (const column of [title, team]) {
        const range = document.createRange();
        range.selectNodeContents(column);
        for (const text of range.getClientRects())
          if (
            text.left < column.getBoundingClientRect().left - 1 ||
            text.right > column.getBoundingClientRect().right + 1 ||
            text.bottom > header.getBoundingClientRect().bottom + 1
          )
            issues.push(`page ${page}: header text clips`);
      }
      for (const text of node.querySelectorAll<HTMLElement>(
        "p[data-card-text],p[data-edge-label]",
      ))
        sizes.push((parseFloat(getComputedStyle(text).fontSize) * 72) / 96);
      for (const detail of node.querySelectorAll<HTMLElement>(
        "[data-card-part],[data-edge-part],.print-category",
      )) {
        const rect = detail.getBoundingClientRect();
        if (
          rect.left < box.left - 1 ||
          rect.right > box.right + 1 ||
          rect.top < header.getBoundingClientRect().bottom - 1 ||
          rect.bottom > footer.getBoundingClientRect().top + 1
        )
          issues.push(`page ${page}: content block escapes printable area`);
        if (
          detail.scrollWidth > detail.clientWidth + 1 ||
          detail.scrollHeight > detail.clientHeight + 1
        )
          issues.push(`page ${page}: content block scroll overflow`);
        const walker = document.createTreeWalker(detail, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          if (!text.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          for (const line of range.getClientRects())
            if (
              line.left < rect.left - 1.5 ||
              line.right > rect.right + 1.5 ||
              line.top < header.getBoundingClientRect().bottom - 1 ||
              line.bottom > footer.getBoundingClientRect().top + 1
            )
              issues.push(
                `page ${page}: rendered text clips (${text.textContent.slice(0, 40)})`,
              );
        }
      }
      summaries.push({
        page,
        section: node.dataset.section,
        cards: node.querySelectorAll("[data-card-part]").length,
        edges: node.querySelectorAll("[data-edge-part]").length,
      });
    }
    return { issues, minimumTextPoints: Math.min(...sizes), pages: summaries };
  });
  expect(geometry.issues).toEqual([]);
  expect(geometry.minimumTextPoints).toBeGreaterThanOrEqual(10.9);
  return { pageCount: total, ...geometry };
}

async function createPdf(
  browser: Browser,
  frame: Frame,
  key: string,
  mystery: Mystery,
  work: Work,
  report: Awaited<ReturnType<typeof inspectPrint>>,
  info: TestInfo,
) {
  // Explicit artifact-generation opt-in. Ordinary CI needs only Chromium;
  // the acceptance delivery also uses installed Poppler for independent PDF checks.
  if (!examples) return;
  await mkdir(examples, { recursive: true });
  const html = await frame.evaluate(() => document.documentElement.outerHTML),
    pdfPath = join(examples, `MysteryBoard-Druck-${key}.pdf`);
  const context = await browser.newContext({
    viewport: { width: 1800, height: 1300 },
    offline: true,
  });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.emulateMedia({ media: "print" });
    // Test artifact only: runtime uses the browser's native print dialog.
    const bytes = await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true,
    });
    const details = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
    expect(Number(details.match(/^Pages:\s+(\d+)/m)?.[1])).toBe(
      report.pageCount,
    );
    const text = execFileSync("pdftotext", ["-raw", pdfPath, "-"], {
        encoding: "utf8",
        maxBuffer: 20_000_000,
      }),
      compact = normalized(text);
    for (const card of mystery.cards)
      expect(compact).toContain(normalized(card.title));
    // The DOM check already reconstructs each complete original text. Check
    // every emitted fragment here: page headers legitimately separate them.
    for (const fragment of await frame
      .locator("p[data-card-text],p[data-edge-label]")
      .allTextContents())
      if (normalized(fragment)) expect(compact).toContain(normalized(fragment));
    for (const category of work.categories)
      if (category) expect(compact).toContain(normalized(category));
    expect(compact).toContain(normalized(mystery.title));
    expect(compact).toContain(normalized(work.team!));
    await writeFile(join(examples, `${key}-pdf-text.txt`), text);
    const indexes = new Set([
      0,
      report.pages.findIndex((row) => row.section === "cards"),
      report.pages.findIndex((row) => row.section === "relations"),
      report.pageCount - 1,
    ]);
    for (const index of indexes)
      if (index >= 0)
        await page
          .locator(".print-page")
          .nth(index)
          .screenshot({
            path: join(examples, `${key}-seite-${index + 1}.png`),
          });
    const evidence = {
      ...report,
      key,
      pdf: pdfPath,
      bytes: bytes.length,
      sha256: sha(bytes),
      pdfinfo: details,
      cards: mystery.cards.length,
      edges: work.edges.length,
      textExtraction:
        "All full card texts, titles, edge labels, categories and header strings present",
      browser: browser.version(),
      runtimePdfDependency: false,
    };
    await writeFile(
      join(examples, `${key}-report.json`),
      JSON.stringify(evidence, null, 2),
    );
    await info.attach(`${key}-print-report.json`, {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
}

for (const variant of variants) {
  test(`Druck ${variant.key}: komplette Offline-Detailseiten, lesbare Texte, Querverweise und unveränderte PNG`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(240000);
    const mystery = validateMystery(variant.data),
      work = printWork(mystery, variant.key),
      observation = observe(page, variant.file);
    await load(page, variant.file, work);
    const before = restorePng(new Uint8Array(await save(page)), mystery);
    expect(before).toEqual(work);
    await expect(btn(page, "Rückgängig")).toBeDisabled();
    console.log(
      `[print ${variant.key}] original PNG verified; preparing print`,
    );
    const previewStarted = Date.now();
    const frame = await printFrame(page);
    const previewReadyMilliseconds = Date.now() - previewStarted;
    console.log(
      `[print ${variant.key}] preview ready after ${previewReadyMilliseconds} ms; checking all details`,
    );
    const report = {
      ...(await inspectPrint(frame, mystery, work)),
      previewReadyMilliseconds,
    };
    console.log(
      `[print ${variant.key}] ${report.pageCount} pages checked; exercising native cross-reference`,
    );
    const parentUrl = page.url();
    const firstReference = frame.locator("[data-card-reference]").first();
    const linkEvidence = await firstReference.evaluate((node) => ({
      href: (node as HTMLAnchorElement).href,
      base: document.baseURI,
      documentUrl: document.URL,
    }));
    await info.attach("print-link-origin.json", {
      body: JSON.stringify(linkEvidence, null, 2),
      contentType: "application/json",
    });
    if (examples) {
      await mkdir(examples, { recursive: true });
      await writeFile(
        join(examples, `${variant.key}-link-origin.json`),
        JSON.stringify(linkEvidence, null, 2),
      );
    }
    await firstReference.tap();
    await expect(frame.locator("body")).toHaveAttribute(
      "data-print-ready",
      "true",
    );
    expect(page.url()).toBe(parentUrl);
    expect(observation.requests).toEqual([]);
    await frame.evaluate(() => {
      (window as any).printCalls = 0;
      window.print = () => {
        (window as any).printCalls++;
      };
    });
    await btn(page, "Drucken / PDF speichern").tap();
    expect(await frame.evaluate(() => (window as any).printCalls)).toBe(1);
    await createPdf(browser, frame, variant.key, mystery, work, report, info);
    await close(page);
    await expect(btn(page, "Rückgängig")).toBeDisabled();
    await expect(btn(page, "Wiederholen")).toBeDisabled();
    const after = restorePng(new Uint8Array(await save(page)), mystery);
    expect(after).toEqual(before);
    expect(Buffer.from(packWork(after))).toEqual(Buffer.from(packWork(before)));
    expect(observation).toEqual({ requests: [], errors: [] });
    expect(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
      })),
    ).toEqual({ local: 0, session: 0 });
  });
}

test("Druck A3 und Zoom: fertige Produktions-HTML erzeugt bei anderem Bildschirmzoom dieselben Druckseiten", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000);
  const mystery = validateMystery(soil),
    work = printWork(mystery, "A3"),
    variant = variants[1],
    observation = observe(page, variant.file);
  await load(page, variant.file, work);
  const first = await printFrame(page, "a3"),
    report = await inspectPrint(first, mystery, work),
    original = await first.evaluate(() => document.documentElement.outerHTML);
  await createPdf(browser, first, "18-A3", mystery, work, report, info);
  await close(page);
  const zoom = Number(await page.locator(".board").getAttribute("data-zoom")),
    board = (await page.locator(".board").boundingBox())!;
  await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2);
  await page.mouse.wheel(0, -700);
  await expect
    .poll(async () =>
      Number(await page.locator(".board").getAttribute("data-zoom")),
    )
    .toBeGreaterThan(zoom);
  const second = await printFrame(page, "a3");
  await inspectPrint(second, mystery, work);
  expect(await second.evaluate(() => document.documentElement.outerHTML)).toBe(
    original,
  );
  await close(page);
  expect(restorePng(new Uint8Array(await save(page)), mystery)).toEqual(work);
  expect(observation).toEqual({ requests: [], errors: [] });
});

for (const paper of ["a4", "a3"] as const) {
  test(`Druck Extremtext ${paper}: 4000 Zeichen, ungetrenntes Wort, 100 Zeichen Titel und 500 Zeichen Beschriftung`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(180000);
    const data = structuredClone(neutral);
    data.title = "Druckprüfung mit langen Texten und unveränderten Zuordnungen";
    data.cards[0].title = "T".repeat(100);
    data.cards[0].text = (
      "Vollständiger Kartentext ÄÖÜ.\n".repeat(135) + "X".repeat(1000)
    ).slice(0, 4000);
    data.cards[1].text = "W".repeat(4000);
    const mystery = validateMystery(data);
    // Test images have no viewBox: their explicit aspect ratios must survive
    // both overview SVG embedding and the dedicated readable image pages.
    for (const [index, [width, height]] of [
      [100, 100],
      [80, 240],
      [320, 80],
    ].entries()) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#dbe8df"/><text x="5" y="20" font-size="12">Test ${width}×${height}</text></svg>`;
      mystery.cards[index].image =
        `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      mystery.cards[index].imageAlt = `Technisches Testbild ${width}×${height}`;
    }
    const work = printWork(mystery, "Langtext");
    work.team =
      "Jörg, Özlem und Änne – " +
      "N".repeat(80 - "Jörg, Özlem und Änne – ".length);
    work.edges[0].label = "L".repeat(500);
    const before = JSON.stringify({ mystery, work });
    await page.goto("http://localhost:5173");
    await page.evaluate(async () => {
      const path = "/src/core/print.ts";
      (window as any).printModule = await import(path);
    });
    await page.context().setOffline(true);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    const result = await page.evaluate(
      async ({ mystery, work, paper }) => {
        const before = JSON.stringify({ mystery, work });
        const frame = document.createElement("iframe");
        frame.title = "Extremtest-Druckvorschau";
        frame.style.cssText = "width:1700px;height:1200px";
        document.body.replaceChildren(frame);
        const result = await (window as any).printModule.preparePrintFrame(
          frame,
          work,
          mystery,
          paper,
        );
        return {
          result,
          unchanged: JSON.stringify({ mystery, work }) === before,
        };
      },
      { mystery, work, paper },
    );
    expect(result.unchanged).toBe(true);
    expect(JSON.stringify({ mystery, work })).toBe(before);
    const frame = (await (await page
      .locator("iframe")
      .elementHandle())!.contentFrame())!;
    await expect(frame.locator("body")).toHaveAttribute(
      "data-print-ready",
      "true",
    );
    const report = await inspectPrint(frame, mystery, work);
    expect(result.result.pageCount).toBe(report.pageCount);
    if (paper === "a4")
      expect(
        await frame.locator('[data-card-part="2"]').count(),
      ).toBeGreaterThan(1);
    await createPdf(
      browser,
      frame,
      `extrem-${paper}`,
      mystery,
      work,
      report,
      info,
    );
    expect(requests).toEqual([]);
  });
}

test("Druck-Namenspflicht: Legacy bleibt unverändert, Abbruch startet nichts und Namensnachtrag setzt bewusst fort", async ({
  page,
}) => {
  test.setTimeout(120000);
  const mystery = validateMystery(soil),
    legacy = initialWork(mystery),
    variant = variants[1],
    observation = observe(page, variant.file);
  await load(page, variant.file, legacy);
  await btn(page, "Menü").tap();
  await btn(page, "Druckfassung / PDF").tap();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Teamname ändern",
  );
  await expect(page.locator('iframe[title="Druckvorschau"]')).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Teamname oder Vornamen", exact: true }),
  ).toHaveValue("");
  await close(page);
  await expect(btn(page, "Rückgängig")).toBeDisabled();
  await expect(btn(page, "Wiederholen")).toBeDisabled();
  await expect(page.locator("[data-card]")).toHaveCount(18);
  await btn(page, "Menü").tap();
  await btn(page, "Teamname ändern").tap();
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill("Bewusste Namensänderung");
  await btn(page, "Übernehmen").tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('iframe[title="Druckvorschau"]')).toHaveCount(0);
  await btn(page, "Rückgängig").tap();
  await expect(page.locator(".team-summary")).toHaveCount(0);
  await btn(page, "Menü").tap();
  await btn(page, "Druckfassung / PDF").tap();
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill("   ");
  await btn(page, "Übernehmen").tap();
  await expect(page.getByRole("alert")).toHaveText(
    "Bitte gebt eine Teambezeichnung oder Vornamen ein.",
  );
  const name = "Druckgruppe ÄÖÜ";
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill(name);
  await btn(page, "Übernehmen").tap();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Druckfassung / PDF",
  );
  const frame = (await (await page
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle())!.contentFrame())!;
  await expect(frame.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 60000 },
  );
  const expected = withTeam(legacy, name);
  await inspectPrint(frame, mystery, expected);
  await close(page);
  expect(restorePng(new Uint8Array(await save(page)), mystery)).toEqual(
    expected,
  );
  expect(observation).toEqual({ requests: [], errors: [] });
});
