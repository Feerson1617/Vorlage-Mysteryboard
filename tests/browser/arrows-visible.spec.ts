import {
  test,
  expect,
  type Browser,
  type Frame,
  type TestInfo,
} from "@playwright/test";
import { writeFile, mkdir, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  taskDocument,
  encodeDocument,
  studentDocument,
  type Student,
} from "../../src/core/documents";
import { initialWork, withTeam } from "../../src/core/model";
import { draftFromContent } from "../../src/core/authoring";
import {
  button,
  openUniversal,
  importMystery,
  type UI,
} from "./authoring-helpers";
import { scorm, connect, gestures, png, project } from "./help-runtime-helpers";
import { classroom, downloadClassroom } from "./pdf-region-helpers";

function task() {
  return taskDocument({
    id: "neutral-arrow-check",
    version: "1.0.0",
    title: "Sichtbare gerichtete Verbindungen",
    cardGroups: { required: { label: "Pflichtkarte", prefix: "" } },
    startLayout: { mode: "explicit" },
    cards: [1, 2, 3, 4].map((id) => ({
      id,
      title: `Information ${id}`,
      text: "Neutrale Beobachtung für die technische Pfeilprüfung.",
      group: "required",
    })),
    initial: {
      cards: [
        { id: 1, x: 0, y: 0, color: 0 },
        { id: 2, x: 620, y: 0, color: 0 },
        { id: 3, x: 620, y: 500, color: 0 },
        { id: 4, x: 0, y: 500, color: 0 },
      ],
      edges: [],
      categories: Array(6).fill(""),
    },
  });
}
async function direction(ui: UI, id: number, value: string) {
  await ui.locator(`[data-edge-label="${id}"]`).tap();
  await ui
    .getByRole("combobox", { name: "Richtung", exact: true })
    .selectOption(value);
  await button(ui, "Übernehmen").tap();
}
async function printPDF(browser: Browser, ui: UI, paper: string, path: string) {
  await button(ui, "Menü").tap();
  await button(ui, "Druckfassung / PDF").tap();
  await ui
    .getByRole("combobox", { name: "Papierformat", exact: true })
    .selectOption(paper);
  const frame = await (await ui
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle())!.contentFrame();
  await expect(frame!.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 60000 },
  );
  const html = await frame!.evaluate(() => document.documentElement.outerHTML),
    context = await browser.newContext({
      offline: true,
      viewport: { width: 1800, height: 1300 },
    }),
    page = await context.newPage();
  await page.setContent(html);
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator("svg.print-overview-svg").boundingBox();
  expect(bounds).not.toBeNull();
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  await context.close();
  await button(ui, "Schließen").tap();
  return bounds!;
}
test.use({ hasTouch: true });
for (const mode of ["html", "universal-scorm", "classroom-scorm"] as const)
  test(`Sichtbare Pfeile ${mode}: Standard, beide Richtungen, ohne Pfeil, PNG, A4/A3 und Wiederherstellung`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const input = task(),
      viewport = { width: 1024, height: 768 };
    let created:
      | Awaited<ReturnType<typeof scorm>>
      | Awaited<ReturnType<typeof classroom>>
      | null = null;
    if (mode === "universal-scorm")
      created = await scorm(browser, info, "blank-sco", viewport);
    if (mode === "classroom-scorm") {
      const c = await browser.newContext({ hasTouch: true, viewport }),
        p = await c.newPage();
      await openUniversal(p);
      await importMystery(
        p,
        Buffer.from(encodeDocument(draftFromContent(input.content, "QA"))),
      );
      const zip = await downloadClassroom(p, info, "neutrale-pfeile-SCORM.zip");
      await c.close();
      created = await classroom(
        browser,
        info,
        zip,
        input.content.title,
        viewport,
        "classroom-pfeile",
      );
    }
    const context =
        created?.context ??
        (await browser.newContext({ hasTouch: true, viewport })),
      page = created?.page ?? (await context.newPage()),
      ui: UI = created?.ui ?? page;
    if (!created) await openUniversal(page);
    if (mode !== "classroom-scorm")
      await importMystery(ui, Buffer.from(encodeDocument(input)));
    await ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Pfeiltest");
    await button(ui, "Beginnen").tap();
    await ui.locator('[data-number="1"]').tap();
    await button(ui, "Mit einer Karte verbinden").tap();
    await ui.locator('[data-number="2"]').tap();
    await expect(
      ui.getByRole("combobox", { name: "Richtung", exact: true }),
    ).toHaveValue("1");
    await ui
      .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
      .fill("Gerichtete Beobachtung");
    await button(ui, "Übernehmen").tap();
    const screen: Record<string, string> = {},
      pngs: Record<string, string> = {},
      pdfs: Record<string, Record<string, string>> = { a4: {}, a3: {} },
      clips: Record<string, unknown> = {};
    const tips = await ui.evaluate(() => {
      const edge = document.querySelector('[data-edge="1"]')!,
        line = edge.querySelectorAll("line")[1],
        m = (edge.parentElement as unknown as SVGGElement).getScreenCTM()!,
        b = document.querySelector("svg.board")!.getBoundingClientRect();
      return [
        new DOMPoint(
          Number(line.getAttribute("x2")),
          Number(line.getAttribute("y2")),
        ),
        new DOMPoint(
          Number(line.getAttribute("x1")),
          Number(line.getAttribute("y1")),
        ),
      ].map((p) => {
        const t = p.matrixTransform(m);
        return { x: t.x - b.x, y: t.y - b.y };
      });
    });
    for (const [key, value] of [
      ["forward", "1"],
      ["reverse", "2"],
      ["none", "0"],
    ]) {
      if (value !== "1") await direction(ui, 1, value);
      const state = await project(ui, info, `${mode}-${key}-daten`);
      expect((state.document as Student).work.edges[0].direction).toBe(
        Number(value),
      );
      await expect(ui.locator('[data-arrowhead="1"]')).toHaveCount(
        value === "0" ? 0 : 1,
      );
      screen[key] = info.outputPath(`${mode}-${key}-bildschirm.png`);
      await ui.locator("svg.board").screenshot({ path: screen[key] });
      const saved = await png(ui, info, `${mode}-${key}-original`);
      expect(saved.document).toEqual(state.document);
      pngs[key] = info.outputPath(`${mode}-${key}-original.png`);
      for (const paper of ["a4", "a3"]) {
        const path = info.outputPath(`${mode}-${key}-${paper}.pdf`);
        clips[`${key}-${paper}`] = await printPDF(browser, ui, paper, path);
        pdfs[paper][key] = path;
      }
    }
    const samples: any[] = [
      { name: `${mode}-Bildschirm`, ...screen, tips },
      { name: `${mode}-Original-PNG`, ...pngs, boardOnlyFraction: 0.65 },
    ];
    // Rasterize the actual generated PDF page, cropped to its vector overview.
    for (const paper of ["a4", "a3"]) {
      const images: Record<string, string> = {};
      for (const key of ["forward", "reverse", "none"]) {
        const out = info.outputPath(`${mode}-${key}-${paper}-raster.png`);
        images[key] = out;
        execFileSync("python3", [
          "-c",
          "import fitz,json,sys; d=fitz.open(sys.argv[1]); b=json.loads(sys.argv[3]); r=fitz.Rect(b['x']*.75,b['y']*.75,(b['x']+b['width'])*.75,(b['y']+b['height'])*.75); d[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=r,alpha=False).save(sys.argv[2])",
          pdfs[paper][key],
          out,
          JSON.stringify(clips[`${key}-${paper}`]),
        ]);
      }
      samples.push({ name: `${mode}-PDF-${paper}`, ...images });
    }
    const metadata = info.outputPath("sichtbare-pfeile.json");
    await writeFile(metadata, JSON.stringify(samples));
    const result = execFileSync(
      "python3",
      ["qa/pdf-regions/check-visible-arrows.py", metadata],
      { encoding: "utf8" },
    );
    await writeFile(info.outputPath("pixelpruefung.json"), result);
    expect(JSON.parse(result)).toHaveLength(4);
    if (process.env.PDF_REGION_DOWNLOADS) {
      await mkdir(process.env.PDF_REGION_DOWNLOADS, { recursive: true });
      for (const path of [
        ...Object.values(screen),
        ...Object.values(pngs),
        ...Object.values(pdfs).flatMap((x) => Object.values(x)),
        ...samples.slice(2).flatMap((x) => [x.forward, x.reverse, x.none]),
        info.outputPath("pixelpruefung.json"),
      ])
        await copyFile(
          path,
          join(
            process.env.PDF_REGION_DOWNLOADS,
            `${mode}-` + path.split("/").at(-1),
          ),
        );
    }
    // Existing deliberately ungerichtete work is retained; new crossings use
    // the same editor, and directions survive real PNG bytes in a fresh session.
    await connect(ui, 1, 3, "Kreuzung eins");
    await connect(ui, 2, 4, "Kreuzung zwei");
    await direction(ui, 3, "2");
    const oldPoints = await ui
      .locator('[data-arrowhead="2"]')
      .getAttribute("points");
    await gestures(ui);
    await expect(ui.locator('[data-arrowhead="2"]')).not.toHaveAttribute(
      "points",
      oldPoints!,
    );
    await direction(ui, 1, "2");
    await button(ui, "Rückgängig").tap();
    await expect(ui.locator('[data-arrowhead="1"]')).toHaveCount(0);
    await button(ui, "Wiederholen").tap();
    await expect(ui.locator('[data-arrowhead="1"]')).toHaveAttribute(
      "data-direction",
      "2",
    );
    await direction(ui, 1, "0");
    const saved = await png(ui, info, `${mode}-gemischte-richtungen`);
    expect(
      (saved.document as Student).work.edges.map((e) => e.direction),
    ).toEqual([0, 1, 2]);
    const c = await browser.newContext({ hasTouch: true, viewport }),
      p = await c.newPage();
    await openUniversal(p);
    await importMystery(p, saved.bytes, "Original.png");
    const restored = await project(p, info, `${mode}-frisch-wiederhergestellt`);
    expect(restored.document).toEqual(saved.document);
    await expect(p.locator("[data-arrowhead]")).toHaveCount(2);
    await expect(p.locator('[data-arrowhead="1"]')).toHaveCount(0);
    await p.screenshot({
      path: info.outputPath("gemischte-pfeile-wiederhergestellt.png"),
    });
    await c.close();
    if (created) await created.finish();
    else await context.close();
  });

test("Lehrkräfte-Vorschau: neue Pfeile, Richtungsänderung und keine Übernahme in den Entwurf", async ({
  page,
}, info) => {
  await openUniversal(page);
  await importMystery(
    page,
    Buffer.from(encodeDocument(draftFromContent(task().content, "QA"))),
  );
  await button(page, "Hilfen bearbeiten").tap();
  await button(page, "Hilfe aus Schülersicht ansehen").tap();
  const preview = page.locator(".student-help-preview");
  await button(preview, "Hilfe schließen").tap();
  await connect(preview, 1, 2, "Vorschaupfeil");
  await expect(preview.locator('[data-arrowhead="1"]')).toHaveAttribute(
    "data-direction",
    "1",
  );
  await preview.locator('[data-edge-label="1"]').tap();
  await preview
    .getByRole("combobox", { name: "Richtung", exact: true })
    .selectOption("2");
  await button(preview, "Übernehmen").tap();
  await expect(preview.locator('[data-arrowhead="1"]')).toHaveAttribute(
    "data-direction",
    "2",
  );
  await preview.screenshot({
    path: info.outputPath("lehrkraefte-vorschau-pfeil.png"),
  });
  await button(page, "Zurück zu den Hilfen").tap();
});
