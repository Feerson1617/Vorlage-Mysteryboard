import {compactBackup} from "./controls.mjs";
import { expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { execFileSync } from "node:child_process";
const snap = (ui) =>
  ui.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((e) => ({
      id: e.getAttribute("data-card"),
      x: e.getAttribute("data-x"),
      y: e.getAttribute("data-y"),
      fill: e.querySelector("rect")?.getAttribute("fill"),
    })),
    edges: [...document.querySelectorAll("[data-edge]")].map((e) => ({
      id: e.getAttribute("data-edge"),
      label: e.getAttribute("aria-label"),
      line: [...e.querySelectorAll("line")]
        .at(-1)
        ?.outerHTML.replace(/url\(#[^)]+\)/g, "url(#marker)"),
    })),
    team: document.querySelector(".team-summary")?.textContent,
  }));
export async function playerWorkflow(
  browser,
  origin,
  out,
  zipPath,
  name,
  expected,
  options = {},
) {
  const zipBytes = await readFile(zipPath);
  // Keep each actual export immutable even when a later design export uses
  // the same suggested filename as the earlier default version.
  zipPath = join(out, name + "-SCORM.zip");
  await writeFile(zipPath, zipBytes);
  const files = unzipSync(new Uint8Array(zipBytes)),
    dir = join(out, name);
  await mkdir(dir, { recursive: true });
  for (const [n, b] of Object.entries(files)) await writeFile(join(dir, n), b);
  const html = Buffer.from(files["app.html"]).toString();
  for (const text of [
    "Lehrkräftemodus öffnen",
    "Foto oder Scan importieren",
    "tesseract.min.js",
    "Kartengrenzen und Text erkennen",
  ])
    if (html.includes(text)) throw Error("Teacher code in Player: " + text);
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
  });
  const requests = [];
  const offline = (r) => {
    const u = r.request().url();
    requests.push(u);
    return /^https?:/.test(u) && !u.startsWith(origin)
      ? r.abort()
      : r.continue();
  };
  await context.route("**/*", offline);
  let page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${origin}/qa-evidence/${name}/launch.html`);
  let ui = page.frames().find((f) => f.url().endsWith("/app.html"));
  await expect(
    ui.getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/, { exact: true }),
  ).toBeVisible();
  await ui
    .getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/, { exact: true })
    .fill("Team Studio");
  await ui.getByRole("button", { name: "Beginnen", exact: true }).tap();
  await expect(ui.locator("[data-card]")).toHaveCount(expected);
  await ui.locator('[data-number="1"]').tap();
  await ui
    .getByRole("button", { name: "Mit einer Karte verbinden", exact: true })
    .tap();
  await ui.locator('[data-number="2"]').tap();
  await expect(
    ui.getByRole("combobox", { name: "Richtung", exact: true }),
  ).toHaveValue("1");
  await ui
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill("Begründeter Zusammenhang");
  await ui.getByRole("button", { name: "Übernehmen", exact: true }).tap();
  const card = ui.locator('[data-card="1"]'),
    box = await card.boundingBox();
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(20, box.height / 2),
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 36,
    box.y + Math.min(20, box.height / 2) + 20,
    { steps: 6 },
  );
  await page.mouse.up();
  const edited = await snap(ui);
  await ui.getByRole("button", { name: "Rückgängig", exact: true }).tap();
  await ui.getByRole("button", { name: "Rückgängig", exact: true }).tap();
  await expect(ui.locator("[data-edge]")).toHaveCount(0);
  await ui.getByRole("button", { name: "Wiederholen", exact: true }).tap();
  await ui.getByRole("button", { name: "Wiederholen", exact: true }).tap();
  expect(await snap(ui)).toEqual(edited);
  if (!options.skipCDPPinch) {
    const board = await ui.locator("svg.board").boundingBox(),
      cdp = await context.newCDPSession(page),
      zoom = Number(await ui.locator("svg.board").getAttribute("data-zoom"));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        {
          id: 1,
          x: board.x + board.width / 2 - 30,
          y: board.y + board.height / 2,
        },
        {
          id: 2,
          x: board.x + board.width / 2 + 30,
          y: board.y + board.height / 2,
        },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          id: 1,
          x: board.x + board.width / 2 - 65,
          y: board.y + board.height / 2,
        },
        {
          id: 2,
          x: board.x + board.width / 2 + 65,
          y: board.y + board.height / 2,
        },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Number(await ui.locator("svg.board").getAttribute("data-zoom")),
      )
      .not.toBe(zoom);
    expect(await snap(ui)).toEqual(edited);
    await expect(ui.getByRole("dialog")).toHaveCount(0);
  }
  await compactBackup(ui);
  await expect(
    ui.getByRole("link", { name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/, exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const pending = page.waitForEvent("download");
  await ui
    .getByRole("link", { name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/, exact: true })
    .tap();
  const download = await pending,
    png = join(out, name + "-Original.png");
  await download.saveAs(png);
  // WebKit's download layer replaces spaces by underscores; the team/title
  // components and PNG suffix must remain present in both browser variants.
  expect(download.suggestedFilename()).toMatch(/^Team(?: |_)Studio_.+\.png$/);
  await page.screenshot({ path: join(out, name + "-Player.png") });
  await context.close();
  const fresh = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
  });
  await fresh.route("**/*", offline);
  page = await fresh.newPage();
  await page.goto(`${origin}/qa-evidence/${name}/launch.html`);
  ui = page.frames().find((f) => f.url().endsWith("/app.html"));
  await ui.getByRole("button", { name: /^(Fortsetzen|Original-PNG öffnen)$/, exact: true }).tap();
  await ui.getByLabel("Schüler-Sicherung", { exact: true }).setInputFiles(png);
  await expect(ui.locator("[data-card]")).toHaveCount(expected, {
    timeout: 30000,
  });
  expect(await snap(ui)).toEqual(edited);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  expect(
    await ui.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await fresh.close();
  // Generate an old-style v3 student document as an IMPORT fixture with the
  // independent PNG decoder; the Player still offers only a PNG save.
  const legacyPath = join(out,name+"-Altimport.mysteryboard");
  execFileSync("python3",["qa/touch-saving/verify-png.py",png,legacyPath]);
  const legacy = await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
  await legacy.route("**/*",offline);
  const legacyPage = await legacy.newPage();
  await legacyPage.goto(`${origin}/qa-evidence/${name}/launch.html`);
  const legacyUI = legacyPage.frames().find((f)=>f.url().endsWith("/app.html"));
  await legacyUI.getByRole("button",{name:/^(Fortsetzen|Original-PNG öffnen)$/,exact:true}).tap();
  await legacyUI.getByLabel("Schüler-Sicherung",{exact:true}).setInputFiles(legacyPath);
  await expect(legacyUI.locator("[data-card]")).toHaveCount(expected,{timeout:30000});
  expect(await snap(legacyUI)).toEqual(edited);
  await expect(legacyUI.getByRole("button",{name:/JSON|mysteryboard|Arbeitsstand.*Datei/i})).toHaveCount(0);
  await legacy.close();
  expect(
    requests.filter((u) => /^https?:/.test(u) && !u.startsWith(origin)),
  ).toEqual([]);
  const proof = {
    cards: expected,
    scorm: zipPath,
    originalPNG: png,
    filename: download.suggestedFilename(),
    restoredEqual: true,
    undoRedo: true,
    pinchNoAction: options.skipCDPPinch
      ? "not run: CDP multitouch is Chromium-specific"
      : true,
    teacherAndOCRCodeAbsent: true,
    oldStudentDocumentImportEqual: true,
    studentNonPNGExportButtons: 0,
    externalRequests: requests.filter(
      (u) => /^https?:/.test(u) && !u.startsWith(origin),
    ),
    snapshot: edited,
  };
  await writeFile(
    join(out, name + "-Wiederherstellung.json"),
    JSON.stringify(proof, null, 2),
  );
  return proof;
}
