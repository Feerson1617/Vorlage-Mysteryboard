import { chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const [zip, output] = process.argv.slice(2);

const bytes = await readFile(zip),
  files = unzipSync(bytes);
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1);
  if (!Object.hasOwn(files, name)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html; charset=utf-8",
      ".json": "application/json",
      ".js": "text/javascript",
    }[extname(name)] || "application/octet-stream",
  );
  res.end(files[name]);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port,
  rows = [];
try {
  for (const [browserType, name, executablePath] of [
    [chromium, "Chromium", process.env.CHROMIUM_PATH],
    [webkit, "WebKit", process.env.WEBKIT_PATH],
  ]) {
    const browser = await browserType.launch({ executablePath });
    try {
      for (const [width, height] of [
        [768, 1024],
        [1024, 768],
        [1024, 570],
      ]) {
        const page = await browser.newPage({
          viewport: { width, height },
          hasTouch: true,
        });
        page.on("dialog", (d) => d.accept().catch(() => {}));
        const external = [];
        await page.route("**/*", (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            external.push(route.request().url());
            return route.abort();
          }
          return route.continue();
        });
        await page.goto(origin + "/launch.html");
        const ui = page.frameLocator("iframe"),
          button = (n) => ui.getByRole("button", { name: n, exact: true });
        await button("ESA").click();
        await ui.getByLabel("Gruppenname", { exact: true }).fill("Team Bach");
        await button("Beginnen").click();
        const board = ui.locator("svg.board"),
          world = board.locator(":scope > g[transform]").first();
        const input = () =>
          page.frames().find((f) => f.url().endsWith("/app.html"));
        const warns = () =>
          input().evaluate(
            () =>
              !dispatchEvent(new Event("beforeunload", { cancelable: true })),
          );
        await expect(board).toBeVisible();
        const rects = await ui
          .locator(".toolbar nav button")
          .evaluateAll((es) =>
            es.map((e) => {
              const { x, y, width, height } = e.getBoundingClientRect();
              return {
                label: e.getAttribute("aria-label") || e.textContent.trim(),
                x,
                y,
                width,
                height,
              };
            }),
          );
        assert(
          rects.every(
            (b) =>
              b.width >= 44 &&
              b.height >= 44 &&
              b.x >= 0 &&
              b.x + b.width <= width + 1,
          ),
        );
        const coords = () =>
          ui
            .locator("[data-card]")
            .evaluateAll((es) =>
              es.map((e) => [e.dataset.card, e.dataset.x, e.dataset.y]),
            );
        const positions = await coords(),
          before = await world.getAttribute("transform");
        for (const [type, x, y, buttons] of [
          ["pointerdown", 40, 180, 1],
          ["pointermove", 64, 209, 1],
          ["pointerup", 64, 209, 0],
        ]) {
          await board.dispatchEvent(type, {
            pointerId: 77,
            pointerType: "touch",
            button: 0,
            isPrimary: true,
            clientX: x,
            clientY: y,
            buttons,
          });
        }
        const pan = await world.getAttribute("transform");
        assert.notEqual(pan, before);
        await page.reload();
        await expect(world).toHaveAttribute("transform", pan);
        assert.deepEqual(await coords(), positions);
        await ui.locator('[data-card="1"]').press("Enter");
        await expect(ui.getByRole("dialog")).toBeVisible();
        await page.reload();
        await expect(ui.getByRole("dialog")).toBeVisible();
        await button("Schließen").click();
        await button("Menü").click();
        await button("Gruppenname ändern").click();
        await ui.getByLabel("Gruppenname", { exact: true }).fill("Ersatzname");
        assert.equal(await warns(), true);
        await button("Übernehmen").click();
        await expect.poll(warns).toBe(false);
        assert.deepEqual(external, []);
        rows.push({
          engine: name,
          version: browser.version(),
          size: [width, height],
          before,
          pan,
          buttons: rects,
          cardPositionsUnchanged: true,
          openCardRestored: true,
          warnForUncommittedGroupName: true,
          warnAfterCommit: false,
          external,
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        scormSHA256: createHash("sha256").update(bytes).digest("hex"),
        checks: rows,
      },
      null,
      2,
    ),
  );
} finally {
  server.close();
}
