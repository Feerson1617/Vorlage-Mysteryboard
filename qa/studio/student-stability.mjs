import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { embedTask } from "../../scripts/embed-task.mjs";
import { host } from "./web-host.mjs";
import { canonical } from "./fixtures.mjs";
import {
  browserOptions,
  cardPosition,
  extractScorm,
  releaseOnly,
  startStudent,
  studentBoard,
} from "./student-release.mjs";

const out = resolve(process.argv[2]);
const scorm = resolve(process.argv[3] || join(out, "Starthilfe-SCORM.zip"));
await mkdir(out, { recursive: true });
await extractScorm(scorm, out, "task-5");
const original = await readFile(join(out, "task-5/app.html"), "utf8");
const task = JSON.parse(
  Buffer.from(
    JSON.parse(
      original.match(
        /<script id="mysteryboard-launch" type="application\/json">([\s\S]*?)<\/script>/,
      )[1],
    ).task,
    "base64",
  ),
);
const enc = new TextEncoder();
for (const count of [12, 20, 60]) {
  const content = {
    ...task.content,
    id: `student-stability-${count}`,
    title: `Prüfaufgabe mit ${count} Karten`,
    cards: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Karte ${i + 1}`,
      text: `Eine Beobachtung mit dem Messwert ${i + 1},5 °C.`,
      group: "required",
    })),
    startLayout: { mode: "ordered" },
    initial: {
      cards: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        x: i * 480,
        y: 0,
        color: 0,
      })),
      edges: [2, 3, 4].map((to, i) => ({
        id: i + 1,
        from: 1,
        to,
        direction: 1,
        label: i === 0 ? "Startzusammenhang" : "",
      })),
      categories: Array(6).fill(""),
    },
  };
  delete content.help;
  const fixture = {
    ...task,
    content,
    contentHash: createHash("sha256").update(canonical(content)).digest("hex"),
  };
  const dir = join(out, `task-${count}`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "app.html"),
    embedTask(original, enc.encode(canonical(fixture)), true),
  );
  for (const file of ["launch.html", "session.js", "imsmanifest.xml"])
    await writeFile(join(dir, file), await readFile(join(out, "task-5", file)));
}
const server = await host(out);
const { engine, options } = browserOptions();
const browser = await engine.launch(options);
const report = {
  passed: false,
  engine: engine.name(),
  version: browser.version(),
  motions: [],
  checks: [],
  externalRequests: [],
  cdpDrags: [],
};
const button = (ui, name) => ui.getByRole("button", { name, exact: true });
const verify = (result) =>
  assert.deepEqual(result.actual, result.target, JSON.stringify(result));
const boardSnapshot = (ui) =>
  studentBoard(ui).evaluate((e) => ({
    cards: [...e.querySelectorAll("[data-card]")].map((card) => [
      card.dataset.card,
      card.dataset.x,
      card.dataset.y,
    ]),
    edges: [...e.querySelectorAll("[data-edge]")].map((edge) =>
      edge.getAttribute("aria-label"),
    ),
  }));
const frames = (ui) =>
  studentBoard(ui).evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
async function learner(count, viewport) {
  const flow = await startStudent(browser, server.origin, `task-${count}`, {
    viewport,
    hasTouch: true,
  });
  await flow.context.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(server.origin + "/")) {
      report.externalRequests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  return flow;
}
async function begin(ui, count) {
  await ui.getByLabel("Teamname oder Vornamen").fill("Prüfteam");
  await button(ui, "Beginnen").tap();
  await expect(studentBoard(ui).locator("[data-card]")).toHaveCount(count);
  await frames(ui);
}
async function mouseDrag(page, ui, id, dx, dy, steps) {
  const card = studentBoard(ui).locator(`[data-card="${id}"] rect`).first();
  const pos = await card.boundingBox(),
    x = Math.round(pos.x + pos.width / 2),
    y = Math.round(pos.y + pos.height / 2);
  const zoom = Number(await studentBoard(ui).getAttribute("data-zoom"));
  const before = await cardPosition(ui, id);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await frames(ui);
  return {
    id,
    type: "mouse",
    before,
    target: before.map(
      (v, i) => Math.round((v + [dx, dy][i] / zoom) * 100) / 100,
    ),
    actual: await cardPosition(ui, id),
    dx,
    dy,
    zoom,
    steps,
  };
}
const closeCard = (ui) => button(ui.getByRole("dialog"), "Schließen");
let page;
try {
  for (const [count, width, height] of [
    [5, 1024, 768],
    [12, 768, 1024],
    [20, 1024, 768],
    [60, 768, 1024],
  ]) {
    const flow = await learner(count, { width, height });
    page = flow.page;
    const ui = flow.ui;
    await begin(ui, count);
    const board = studentBoard(ui);
    if (count === 5) {
      const card = board.locator('[data-card="1"]');
      const original = await cardPosition(ui, 1);
      await card.locator("rect").first().tap();
      await expect(ui.getByRole("dialog")).toBeVisible();
      await closeCard(ui).tap();
      assert.deepEqual(await cardPosition(ui, 1), original);
      const sub = await releaseOnly(ui, 1, { dx: 7, dy: 0, type: "touch" });
      assert.deepEqual(sub.actual, sub.before);
      await expect(ui.getByRole("dialog")).toBeVisible();
      await closeCard(ui).tap();
      for (const dx of [8.5, 83]) {
        const moved = await releaseOnly(ui, 1, { dx, dy: 0, type: "touch" });
        verify(moved);
        await expect(ui.getByRole("dialog")).toHaveCount(0);
        await button(ui, "Rückgängig").click();
        assert.deepEqual(await cardPosition(ui, 1), moved.before);
        await button(ui, "Wiederholen").click();
        assert.deepEqual(await cardPosition(ui, 1), moved.target);
        await button(ui, "Rückgängig").click();
      }
      for (const [dx, dy, steps] of [
        [37, 22, 18],
        [66, 13, 1],
      ]) {
        verify(await mouseDrag(page, ui, 1, dx, dy, steps));
        await button(ui, "Rückgängig").click();
      }
      for (const phase of ["pointercancel", "lostpointercapture"]) {
        const stopped = await releaseOnly(ui, 1, {
          dx: 42,
          dy: 13,
          type: "touch",
          phase,
          afterDown: ({ board, event, x, y }) =>
            board.dispatchEvent("pointermove", {
              ...event,
              clientX: x + 17,
              clientY: y + 9,
            }),
        });
        assert.deepEqual(stopped.actual, stopped.before);
        await expect(ui.getByRole("dialog")).toHaveCount(0);
      }
      // Move again with an actual history entry on another card, so the
      // following Undo crosses a session without changing card 1's coordinates.
      verify(await releaseOnly(ui, 2, { dx: 32, dy: 15, type: "mouse" }));
      const stale = await releaseOnly(ui, 1, {
        dx: 25,
        dy: 14,
        type: "touch",
        afterDown: async () => {
          await button(ui, "Rückgängig").press("Enter");
          await expect(button(ui, "Wiederholen")).toBeEnabled();
        },
      });
      assert.deepEqual(stale.actual, stale.before);
      const resize = await releaseOnly(ui, 1, {
        dx: 30,
        dy: 15,
        type: "mouse",
        afterDown: async () => {
          await page.setViewportSize({ width: 1090, height: 790 });
          await frames(ui);
        },
      });
      verify(resize);
      await page.setViewportSize({ width, height });
      await button(ui, "Übersicht").click();
      const core = await board.boundingBox(),
        centreX = core.x + core.width / 2,
        centreY = core.y + core.height / 2;
      const zoom = Number(await board.getAttribute("data-zoom"));
      const saved = await boardSnapshot(ui);
      if (engine.name() === "chromium") {
        const cdp = await flow.context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { id: 11, x: centreX - 30, y: centreY },
            { id: 12, x: centreX + 30, y: centreY },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { id: 11, x: centreX - 55, y: centreY },
            { id: 12, x: centreX + 55, y: centreY },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        const native = await board.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        const send = (phase, id, x) =>
          board.dispatchEvent(phase, {
            pointerType: "touch",
            pointerId: id,
            button: 0,
            clientX: x,
            clientY: native.y,
            bubbles: true,
          });
        await send("pointerdown", 71, native.x - 30);
        await send("pointerdown", 72, native.x + 30);
        await send("pointermove", 71, native.x - 55);
        await send("pointermove", 72, native.x + 55);
        await send("pointerup", 71, native.x - 55);
        await send("pointerup", 72, native.x + 55);
      }
      await expect
        .poll(async () => Number(await board.getAttribute("data-zoom")))
        .toBeGreaterThan(zoom);
      assert.deepEqual(await boardSnapshot(ui), saved);
      verify(await releaseOnly(ui, 1, { dx: 21, dy: 17, type: "touch" }));
      await button(ui, "Übersicht").click();
      // Connecting mode consumes displacement and does not open another card.
      await card.locator("rect").first().tap();
      await button(ui, "Mit einer Karte verbinden").tap();
      const connected = await releaseOnly(ui, 2, {
        dx: 60,
        dy: 18,
        type: "touch",
      });
      assert.deepEqual(connected.actual, connected.before);
      await expect(ui.getByRole("dialog")).toHaveCount(0);
      await card.locator("rect").first().tap();
      report.checks.push(
        "tap, threshold, mouse speeds, touch release, cancel, lost capture, history session, React resize, pinch, connection mode",
      );
    }
    if (count === 20) {
      const endpoints = () =>
        board
          .locator("[data-edge] line[marker-end]")
          .evaluateAll((lines) => lines.map((line) => line.getAttribute("x1")));
      const before = await endpoints();
      verify(await releaseOnly(ui, 1, { dx: 31, dy: 23, type: "mouse" }));
      const after = await endpoints();
      assert.equal(after.length, 3);
      after.forEach((value, i) => assert.notEqual(value, before[i]));
      report.checks.push("moving a card reroutes all three connected arrows");
    }
    if (count === 60 && engine.name() === "chromium") {
      const cdp = await flow.context.newCDPSession(page);
      for (let index = 0; index < 24; index++) {
        if (index % 4 === 0) {
          await button(ui, "Übersicht").click();
          await frames(ui);
        }
        const grip = await board.evaluate((svg, index) => {
          const bounds = svg.getBoundingClientRect();
          const cards = [...svg.querySelectorAll("[data-card]")];
          for (let offset = 0; offset < cards.length; offset++) {
            const card = cards[(index * 7 + offset) % cards.length];
            const rect = card.querySelector("rect").getBoundingClientRect();
            const x = Math.round(rect.x + rect.width / 2);
            const y = Math.round(rect.y + rect.height / 2);
            if (
              x < bounds.left + 20 ||
              x > bounds.right - 20 ||
              y < bounds.top + 20 ||
              y > bounds.bottom - 20
            )
              continue;
            if (
              document.elementFromPoint(x, y)?.closest("[data-card]") === card
            )
              return {
                id: Number(card.dataset.card),
                x: x - bounds.x,
                y: y - bounds.y,
              };
          }
          throw Error("Keine sichtbare Karte für die CDP-Geste.");
        }, index);
        const box = await board.boundingBox();
        const x = box.x + grip.x,
          y = box.y + grip.y;
        const dx = (index % 2 ? -1 : 1) * (14 + (index % 5));
        const dy = 10 + (index % 4);
        const zoom = Number(await board.getAttribute("data-zoom"));
        const before = await cardPosition(ui, grip.id);
        const send = (type, x, y) =>
          cdp.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: x === undefined ? [] : [{ id: 9, x, y }],
          });
        await send("touchStart", x, y);
        await send("touchMove", x + dx, y + dy);
        await send("touchEnd");
        await frames(ui);
        const target = before.map(
          (v, i) => Math.round((v + [dx, dy][i] / zoom) * 100) / 100,
        );
        const motion = {
          id: grip.id,
          before,
          target,
          actual: await cardPosition(ui, grip.id),
          zoom,
          dx,
          dy,
        };
        verify(motion);
        await expect(ui.getByRole("dialog")).toHaveCount(0);
        report.cdpDrags.push(motion);
      }
      report.checks.push(
        "24 consecutive browser-dispatched touch drags on 60 cards",
      );
    }
    for (let index = 0; index < 25; index++) {
      if (index % 5 === 0) {
        await button(ui, "Übersicht").click();
        await frames(ui);
      }
      const sign = index % 2 === 0 ? 1 : -1;
      const result = await releaseOnly(ui, ((index * 7) % count) + 1, {
        dx: sign * (13 + index),
        dy: sign * (8 + (index % 9)),
        type: index % 2 ? "mouse" : "touch",
      });
      verify(result);
      report.motions.push({ count, index, ...result });
    }
    if (count === 5) {
      await button(ui, "Übersicht").click();
      await page.screenshot({
        path: join(out, "Schuelerbewegung-" + engine.name() + ".png"),
      });
      const baseline = await boardSnapshot(ui);
      await button(ui, "Menü").tap();
      await button(ui, "Kleineres Sicherungsbild").tap();
      const downloadPromise = page.waitForEvent("download");
      await ui
        .getByRole("link", { name: "Sicherungsbild herunterladen" })
        .tap();
      const download = await downloadPromise,
        png = join(out, "Schuelerbewegung-" + engine.name() + ".png");
      const original = png.replace(".png", "-Original.png");
      await download.saveAs(original);
      await flow.context.close();
      const fresh = await learner(5, { width, height });
      await button(fresh.ui, "Fortsetzen").tap();
      await fresh.ui.getByLabel("Schüler-Sicherung").setInputFiles(original);
      await expect(studentBoard(fresh.ui).locator("[data-card]")).toHaveCount(
        5,
      );
      assert.deepEqual(await boardSnapshot(fresh.ui), baseline);
      verify(await releaseOnly(fresh.ui, 1, { dx: 24, dy: 13, type: "touch" }));
      await fresh.context.close();
      report.checks.push(
        "PNG restored exactly and subsequent movement succeeded",
      );
    } else await flow.context.close();
  }
  assert.deepEqual(report.externalRequests, []);
  assert.equal(report.motions.length, 100);
  report.passed = true;
} catch (error) {
  report.error = String(error);
  if (page && !page.isClosed())
    await page
      .screenshot({ path: join(out, `Fehler-${engine.name()}.png`) })
      .catch(() => {});
  throw error;
} finally {
  await writeFile(
    join(out, `Schueler-Stress-${engine.name()}.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  server.close();
}
