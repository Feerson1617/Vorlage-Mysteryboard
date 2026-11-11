// Independent event comparison when the supplied Touch-Vergleich.cjs is absent.
// Use a matching Playwright package/browser for each engine; never relabel an
// installed engine. Serve the HTMLs locally, then pass their two URLs.
import { writeFile } from "node:fs/promises";
const { chromium, webkit } = await import(
  process.env.MB_PLAYWRIGHT_MODULE || "playwright"
);
const engine = process.env.MB_ENGINE || "chromium";
const mode = process.env.MB_EVENT_MODE || "native";
const urls = process.argv.slice(2);
if (
  urls.length !== 2 ||
  !["chromium", "webkit"].includes(engine) ||
  !["native", "pointer-only"].includes(mode)
)
  throw new Error(
    "Pass small and large HTML URLs; MB_ENGINE=chromium|webkit, MB_EVENT_MODE=native|pointer-only.",
  );
const browser = await (engine === "webkit" ? webkit : chromium).launch(
  engine === "chromium"
    ? {
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
        args: ["--no-sandbox"],
      }
    : {},
);
const result = {
  engine,
  version: browser.version(),
  mode,
  expected: Number(process.env.MB_EXPECTED_DIALOGS || 10),
  correct: 0,
  trials: [],
};
try {
  for (const [index, url] of urls.entries()) {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1180, height: 820 },
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole("button", { name: "Beginnen", exact: true }).click();
    await page.locator('[data-card="1"]').waitFor();
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.evaluate((mode) => {
      window.r1Trace = [];
      window.r1Opens = [];
      const show = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function () {
        window.r1Opens.push(this.getAttribute("aria-label"));
        return show.call(this);
      };
      for (const name of [
        "pointerdown",
        "pointerup",
        "touchstart",
        "touchend",
        "click",
      ])
        window.addEventListener(
          name,
          (e) =>
            window.r1Trace.push({
              type: e.type,
              pointerId: e.pointerId,
              pointerType: e.pointerType,
              detail: e.detail,
              trusted: e.isTrusted,
            }),
          true,
        );
      if (mode === "pointer-only") {
        const svg = document.querySelector(".board"),
          held = new Set();
        svg.setPointerCapture = (id) => held.add(id);
        svg.hasPointerCapture = (id) => held.has(id);
        svg.releasePointerCapture = (id) => held.delete(id);
      }
    }, mode);
    const tips = [
      ['[data-card="1"] > rect', "Karte 1"],
      ['[data-card="12"] circle', "Karte 12"],
      ['[data-edge-label="1"], [data-edge="1"] rect', "Verbindung 1 und 2"],
      [`[data-card="${index ? 60 : 12}"] > rect`, `Karte ${index ? 60 : 12}`],
      ['[data-card="1"] circle', "Karte 1"],
    ];
    for (const [i, [selector, expected]] of tips.entries()) {
      const b = await page.locator(selector).boundingBox(),
        p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      await page.evaluate(() => {
        window.r1Trace = [];
        window.r1Opens = [];
      });
      if (mode === "native") await page.touchscreen.tap(p.x, p.y);
      else
        await page.evaluate(
          ({ p, id }) => {
            const svg = document.querySelector(".board");
            const opts = {
              bubbles: true,
              cancelable: true,
              pointerType: "touch",
              pointerId: id,
              isPrimary: true,
              clientX: p.x,
              clientY: p.y,
              button: 0,
            };
            document
              .elementFromPoint(p.x, p.y)
              .dispatchEvent(
                new PointerEvent("pointerdown", { ...opts, buttons: 1 }),
              );
            svg.dispatchEvent(
              new PointerEvent("pointerup", { ...opts, buttons: 0 }),
            );
          },
          { p, id: 101 + i },
        );
      // Observe a deliberately missing event without blocking the other tips.
      await page.waitForTimeout(100);
      const observation = await page.evaluate(() => ({
        opens: window.r1Opens,
        events: window.r1Trace,
        title:
          document.querySelector("dialog[open]")?.getAttribute("aria-label") ??
          null,
      }));
      const correct =
        observation.title === expected && observation.opens.length === 1;
      result.correct += Number(correct);
      result.trials.push({ url, selector, expected, correct, ...observation });
      if (observation.title)
        await page
          .getByRole("button", { name: "Schließen", exact: true })
          .click();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
if (process.env.MB_REPORT)
  await writeFile(
    process.env.MB_REPORT,
    JSON.stringify(result, null, 2) + "\n",
  );
if (result.correct !== result.expected) process.exitCode = 1;
