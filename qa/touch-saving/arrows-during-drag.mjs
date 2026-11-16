// Independent screen-coordinate check against actual production HTML/SCO/PNG.
// No application geometry, state hooks or application codec is imported.
import { chromium } from "@playwright/test";
import { unzipSync } from "fflate";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const [htmlPath, scoPath, pngPath, out] = process.argv.slice(2);
if (!out)
  throw new Error(
    "Usage: arrows-during-drag.mjs UNIVERSAL.html UNIVERSAL-SCORM.zip ORIGINAL.png OUTPUT_DIR",
  );
const html = await readFile(htmlPath),
  archive = unzipSync(await readFile(scoPath));
assert.deepEqual(Buffer.from(archive["app.html"]), html);
const server = createServer((request, response) => {
  const path = request.url?.split("?")[0];
  const file =
    path === "/html/app.html"
      ? html
      : path?.startsWith("/scorm/")
        ? archive[path.slice(7)]
        : null;
  response.writeHead(file ? 200 : 404, {
    "Content-Type": path?.endsWith(".js")
      ? "application/javascript"
      : "text/html; charset=utf-8",
  });
  response.end(file || "missing");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const rows = [];
const frame = (ui) =>
  ui.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
const geometry = (ui, edge) =>
  ui.evaluate((edge) => {
    const rect = (id) => {
      const n = document.querySelector(`[data-card="${id}"]`),
        b = n.querySelector("rect").getBoundingClientRect(),
        m = n.getScreenCTM();
      return {
        id,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        origin: { x: m.e, y: m.f },
        z: m.a,
      };
    };
    const target = edge === 1 ? 2 : 3,
      other = edge === 1 ? 1 : 4;
    const line = document.querySelector(
        `[data-edge="${edge}"] line:last-child`,
      ),
      polygon = document.querySelector(`[data-arrowhead="${edge}"]`);
    const point = (n, x, y) => {
      const p = new DOMPoint(x, y).matrixTransform(n.getScreenCTM());
      return { x: p.x, y: p.y };
    };
    return {
      target: rect(target),
      other: rect(other),
      direction: Number(polygon.dataset.direction),
      vertices: [...polygon.points].map((p) => point(polygon, p.x, p.y)),
      endpoint:
        edge === 1
          ? point(line, line.x2.baseVal.value, line.y2.baseVal.value)
          : point(line, line.x1.baseVal.value, line.y1.baseVal.value),
    };
  }, edge);
function check(g) {
  const [tip, a, b] = g.vertices,
    r = g.target;
  const distance = Math.hypot(tip.x - g.endpoint.x, tip.y - g.endpoint.y);
  assert(distance < 0.2, "arrow apex must equal the visible line endpoint");
  const gap = Math.hypot(
    Math.max(r.x - tip.x, 0, tip.x - r.x - r.width),
    Math.max(r.y - tip.y, 0, tip.y - r.y - r.height),
  );
  assert(
    gap > 0 && gap <= 8 * r.z + 0.3,
    "head must stay just outside the target card",
  );
  const dx = r.x + r.width / 2 - g.other.x - g.other.width / 2,
    dy = r.y + r.height / 2 - g.other.y - g.other.height / 2;
  const headX = tip.x - (a.x + b.x) / 2,
    headY = tip.y - (a.y + b.y) / 2;
  const cosine =
    (headX * dx + headY * dy) / Math.hypot(headX, headY) / Math.hypot(dx, dy);
  assert(cosine > 0.999, "visible head must point toward its saved target");
  return {
    apexEndpointErrorCssPx: distance,
    gapCssPx: gap,
    directionCosine: cosine,
  };
}
try {
  for (const mode of ["html", "scorm"])
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 600, height: 800 },
      { width: 320, height: 700 },
    ]) {
      const context = await browser.newContext({ hasTouch: true, viewport }),
        page = await context.newPage(),
        requests = [];
      page.on("request", (r) => {
        if (/^https?:/.test(r.url()) && !r.url().startsWith(origin + "/"))
          requests.push(r.url());
      });
      await page.addInitScript(() => {
        if (window !== window.top) return;
        window.__calls = [];
        window.API = Object.fromEntries(
          [
            "LMSInitialize",
            "LMSFinish",
            "LMSGetValue",
            "LMSSetValue",
            "LMSCommit",
          ].map((n) => [
            n,
            (...args) => {
              window.__calls.push([n, ...args]);
              return "true";
            },
          ]),
        );
      });
      await page.goto(
        origin + (mode === "html" ? "/html/app.html" : "/scorm/launch.html"),
      );
      const ui =
        mode === "html"
          ? page
          : page.frames().find((f) => f.url().endsWith("/app.html"));
      await ui
        .getByRole("button", { name: "Arbeit fortsetzen", exact: true })
        .click();
      await ui
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles(pngPath);
      await ui.locator('[data-arrowhead="2"]').waitFor();
      await frame(ui);
      await context.setOffline(true);
      const session = await context.newCDPSession(page),
        samples = [];
      for (const zoom of [0.15, 0.75, 2])
        for (const edge of [1, 2]) {
          const initial = await geometry(ui, edge),
            tip = initial.vertices[0],
            old = Number(
              await ui.locator("svg.board").getAttribute("data-zoom"),
            );
          await page.mouse.move(tip.x, tip.y);
          await page.mouse.wheel(0, -Math.log(zoom / old) / 0.0015);
          await frame(ui);
          assert(
            Math.abs(
              Number(await ui.locator("svg.board").getAttribute("data-zoom")) -
                zoom,
            ) < 0.001,
            "requested wheel zoom must be applied before measurement",
          );
          const before = await geometry(ui, edge),
            r = before.target;
          const x = Math.max(
              r.x + Math.min(12, r.width / 2),
              Math.min(
                r.x + r.width - Math.min(12, r.width / 2),
                before.vertices[0].x,
              ),
            ),
            y = Math.max(
              r.y + 4,
              Math.min(r.y + r.height - 4, before.vertices[0].y),
            );
          assert.equal(
            await ui.evaluate(
              ({ x, y }) =>
                Number(
                  document
                    .elementFromPoint(x, y)
                    ?.closest("[data-card]")
                    ?.getAttribute("data-card"),
                ),
              { x, y },
            ),
            r.id,
          );
          await session.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, x, y }],
          });
          for (const [dx, dy] of [
            [20, 10],
            [40, -15],
            [-10, 8],
            [12, -10],
          ]) {
            await session.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ id: 1, x: x + dx, y: y + dy }],
            });
            await frame(ui);
            const actual = await geometry(ui, edge),
              errors = check(actual),
              cardError = Math.hypot(
                actual.target.origin.x - r.origin.x - dx,
                actual.target.origin.y - r.origin.y - dy,
              );
            assert(cardError < 0.2);
            assert.equal(actual.direction, edge === 1 ? 1 : 2);
            samples.push({
              zoom,
              edge,
              finger: { x: x + dx, y: y + dy },
              before,
              actual,
              cardErrorCssPx: cardError,
              ...errors,
            });
          }
          const final = await geometry(ui, edge);
          await session.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await frame(ui);
          assert.deepEqual(
            (await geometry(ui, edge)).target.origin,
            final.target.origin,
          );
          await ui.locator("svg.board").screenshot({
            path: join(
              out,
              `${mode}-${viewport.width}-zoom${zoom}-richtung${edge}.png`,
            ),
          });
          await ui
            .getByRole("button", { name: "Rückgängig", exact: true })
            .click();
          await ui
            .getByRole("button", { name: "Übersicht", exact: true })
            .click();
          await frame(ui);
        }
      assert.deepEqual(requests, []);
      assert.deepEqual(
        await page.evaluate(() => window.__calls),
        mode === "scorm" ? [["LMSInitialize", ""]] : [],
      );
      rows.push({
        mode,
        viewport,
        samples,
        externalRequests: requests,
        status: "passed",
      });
      await context.close();
      console.log(
        `${mode} ${viewport.width}x${viewport.height}: ${samples.length} arrow/card measurements passed`,
      );
    }
  await writeFile(
    join(out, "arrows-during-drag.json"),
    JSON.stringify(rows, null, 2) + "\n",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
