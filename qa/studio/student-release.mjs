import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";

export const studentBoard = (ui) => ui.locator("svg.board");
export async function cardPosition(ui, id) {
  return studentBoard(ui)
    .locator(`[data-card="${id}"]`)
    .evaluate((e) => [Number(e.dataset.x), Number(e.dataset.y)]);
}

export async function releaseOnly(
  ui,
  id,
  { dx, dy, type = "mouse", phase = "pointerup", afterDown },
) {
  const board = studentBoard(ui);
  const card = board.locator(`[data-card="${id}"]`);
  const before = await cardPosition(ui, id);
  const rect = await card.locator("rect").first().boundingBox();
  const boardRect = await board.boundingBox();
  const zoom = Number(await board.getAttribute("data-zoom"));
  // Pointer event client coordinates are relative to the SCORM iframe.
  const local = await board.evaluate((e) => {
    const { left, top } = e.getBoundingClientRect();
    return { left, top };
  });
  const x = rect.x + rect.width / 2 - boardRect.x + local.left;
  const y = rect.y + rect.height / 2 - boardRect.y + local.top;
  const event = {
    pointerId: 42,
    pointerType: type,
    button: 0,
    isPrimary: true,
  };
  await card.dispatchEvent("pointerdown", {
    ...event,
    buttons: 1,
    clientX: x,
    clientY: y,
  });
  if (afterDown) await afterDown({ board, event, x, y });
  await board.dispatchEvent(phase, {
    ...event,
    clientX: x + dx,
    clientY: y + dy,
  });
  if (phase === "lostpointercapture")
    await board.dispatchEvent("pointerup", {
      ...event,
      clientX: x + dx,
      clientY: y + dy,
    });
  await board.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const target = before.map(
    (value, i) => Math.round((value + [dx, dy][i] / zoom) * 100) / 100,
  );
  return {
    id,
    type,
    before,
    target,
    actual: await cardPosition(ui, id),
    zoom,
    dx,
    dy,
  };
}

export async function extractScorm(file, root, name) {
  const files = unzipSync(new Uint8Array(await readFile(file))),
    dir = join(root, name);
  assert.deepEqual(Object.keys(files).sort(), [
    "app.html",
    "imsmanifest.xml",
    "launch.html",
    "session.js",
  ]);
  await mkdir(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(files))
    await writeFile(join(dir, name), bytes);
}

export function browserOptions() {
  const executablePath = process.env.WEBKIT_EXECUTABLE || undefined;
  if (process.env.MB_ENGINE === "webkit")
    return { engine: webkit, options: { executablePath } };
  return {
    engine: chromium,
    options: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox"],
    },
  };
}

export async function startStudent(browser, origin, resource, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${origin}/qa-evidence/${resource}/launch.html`);
  const ui = page.frameLocator("iframe");
  return { context, page, ui };
}

async function reproduce() {
  const [file, outPath, mode] = process.argv.slice(2);
  const out = resolve(outPath);
  await mkdir(out, { recursive: true });
  await extractScorm(resolve(file), out, "example");
  const server = await host(out);
  const { engine, options } = browserOptions();
  const browser = await engine.launch(options);
  try {
    const { ui } = await startStudent(browser, server.origin, "example", {
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
    });
    await ui.getByLabel("Teamname oder Vornamen").fill("Testgruppe");
    await ui.getByRole("button", { name: "Beginnen", exact: true }).click();
    await expect(studentBoard(ui)).toBeVisible();
    const results = [];
    for (const type of ["mouse", "touch"])
      results.push(await releaseOnly(ui, 1, { dx: 44, dy: 19, type }));
    await writeFile(
      join(out, "release-only.json"),
      JSON.stringify({ engine: browser.version(), results }, null, 2) + "\n",
    );
    for (const result of results) {
      assert.notDeepEqual(result.before, result.target);
      assert.deepEqual(
        result.actual,
        mode === "--expect-regression" ? result.before : result.target,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  await reproduce();
