import { existsSync } from "node:fs";
// Independent pre-correction evidence against the already-built HTMLs only.
// Does not build or modify the application. A private local server is stopped
// in finally; no deployment or policy changes are performed.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
// Optional third argument points at a preserved, unmodified baseline checkout.
const root = resolve(process.argv[3] || resolve(import.meta.dirname, ".."));
const destination =
  process.argv[2] || resolve(root, "artifacts/previews/team-reproduction");
await mkdir(destination, { recursive: true });
const server = spawn(
  "python3",
  ["-m", "http.server", "5176", "--bind", "127.0.0.1", "--directory", root],
  { stdio: "ignore" },
);
const url = "http://127.0.0.1:5176/artifacts/MysteryBoard-Boden-Klasse11.html";
let browser;
const result = {
  generatedAt: new Date().toISOString(),
  browser: null,
  inputs: [],
  nameless: [],
  layout: [],
};
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page) =>
  page.getByRole("textbox", { name: /Teamname oder Vornamen/ });
function unpack(png) {
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset),
      type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "mySt") {
      const packed = png.subarray(offset + 8, offset + 8 + length),
        raw = inflateSync(packed.subarray(40));
      if (
        !createHash("sha256")
          .update(raw)
          .digest()
          .equals(packed.subarray(8, 40))
      )
        throw new Error("Invalid checksum");
      const c = JSON.parse(raw.toString("utf8"));
      return {
        schema: c[0],
        mystery: c[1],
        version: c[2],
        cards: c[3].length,
        team: c[6] ?? "",
      };
    }
    offset += length + 12;
  }
  throw new Error("No work chunk");
}
async function save(page, stem) {
  await button(page, "Sichern").tap();
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await link.waitFor({ state: "visible" });
  const event = page.waitForEvent("download");
  await link.tap();
  const png = await readFile(await (await event).path());
  await writeFile(resolve(destination, `${stem}.png`), png);
  await page.screenshot({ path: resolve(destination, `${stem}-offered.png`) });
  const fresh = await browser.newContext({ hasTouch: true });
  try {
    const q = await fresh.newPage();
    await q.goto(url);
    await button(q, "Fortsetzen").tap();
    await q.getByLabel("Sicherungsbild", { exact: true }).setInputFiles({
      name: "Legacy.png",
      mimeType: "image/png",
      buffer: png,
    });
    await q.locator("[data-card]").first().waitFor();
    return {
      ...unpack(png),
      bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"),
      freshImportCards: await q.locator("[data-card]").count(),
      freshImportTeamElements: await q.locator(".team-summary").count(),
    };
  } finally {
    await fresh.close();
  }
}
try {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) break;
    } catch {}
    if (i === 49) throw new Error("Local evidence server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const name of [
    "MysteryBoard-klein.html",
    "MysteryBoard-umfangreich.html",
    "MysteryBoard-Boden-Klasse11.html",
  ]) {
    const bytes = await readFile(resolve(root, "artifacts", name));
    result.inputs.push({
      file: name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  result.browser = browser.version();
  for (const variant of ["empty-start", "empty-change", "whitespace-change"]) {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    });
    try {
      const page = await context.newPage();
      await page.goto(url);
      if (variant !== "empty-start")
        await field(page).fill("Emma, Leon und Mia");
      await button(page, "Beginnen").tap();
      const startCards = await page.locator("[data-card]").count();
      if (variant !== "empty-start") {
        await button(page, "Menü").tap();
        await button(page, "Teamname ändern").tap();
        await field(page).fill(variant === "empty-change" ? "" : "   ");
        await button(page, "Übernehmen").tap();
      }
      result.nameless.push({
        variant,
        startCards,
        ...(await save(page, variant)),
      });
    } finally {
      await context.close();
    }
  }
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 480, height: 800 },
  ]) {
    const context = await browser.newContext({ hasTouch: true, viewport });
    try {
      const page = await context.newPage();
      await page.goto(url);
      await field(page).fill("Emma, Leon und Mia");
      await button(page, "Beginnen").tap();
      const metrics = await page.evaluate(() => {
        const team = document.querySelector(".team-summary"),
          toolbar = document.querySelector(".toolbar"),
          nav = toolbar.querySelector("nav");
        const box = (el) => {
          const b = el.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            right: b.right,
            bottom: b.bottom,
          };
        };
        const range = document.createRange();
        range.selectNodeContents(team);
        const textBox = range.getBoundingClientRect();
        return {
          text: team.textContent,
          team: box(team),
          toolbar: box(toolbar),
          nav: box(nav),
          clientWidth: team.clientWidth,
          scrollWidth: team.scrollWidth,
          textBounds: {
            x: textBox.x,
            y: textBox.y,
            width: textBox.width,
            right: textBox.right,
          },
          style: {
            overflow: getComputedStyle(team).overflow,
            textOverflow: getComputedStyle(team).textOverflow,
          },
          clipped: team.scrollWidth > team.clientWidth,
          leftHalf: team.getBoundingClientRect().right < innerWidth / 2,
          separateNameRow:
            team.getBoundingClientRect().bottom <=
            nav.getBoundingClientRect().top,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      await page.screenshot({
        path: resolve(destination, `layout-${viewport.width}.png`),
      });
      result.layout.push({ viewport, ...metrics });
    } finally {
      await context.close();
    }
  }
  await writeFile(
    resolve(destination, "before.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.nameless.every((x) => x.team === "" && x.freshImportCards === 18))
    throw new Error("Expected nameless-export defect did not reproduce");
  if (
    !result.layout
      .filter((x) => x.viewport.width !== 480)
      .every((x) => x.leftHalf)
  )
    throw new Error("Expected left-position defect did not reproduce");
  if (!result.layout.find((x) => x.viewport.width === 480).separateNameRow)
    throw new Error("Expected mobile extra row did not reproduce");
} finally {
  await browser?.close();
  server.kill();
}
