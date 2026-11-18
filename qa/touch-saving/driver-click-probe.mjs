// Isolate Chromium automation from React and MysteryBoard. Native touch input
// from a temporary CDP session followed immediately by Playwright tap can omit
// a click even on a plain HTML button. No application code is loaded here.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const out = process.argv[2];
if (!out) throw new Error("Usage: node driver-click-probe.mjs OUTPUT_DIR");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 600, height: 800 },
  }),
  page = await context.newPage();
const inside = `<style>button{height:60px;touch-action:manipulation}svg{touch-action:none}</style><button>Sichern</button><svg width="580" height="700"><rect x="50" y="60" width="200" height="160" fill="green" /></svg><script>window.count=0;document.querySelector('button').onclick=()=>window.count++;let s=document.querySelector('svg');s.onpointerdown=e=>{e.preventDefault();s.setPointerCapture(e.pointerId)};s.onpointerup=e=>s.releasePointerCapture(e.pointerId)</script>`;
await page.setContent(
  '<iframe style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>',
);
await page.locator("iframe").evaluate((node, html) => {
  node.srcdoc = html;
}, inside);
const f = page.frames()[1];
await f.getByRole("button", { name: "Sichern" }).waitFor();
const results = [];
for (const frames of [0, 2]) {
  for (let i = 0; i < 40; i++) {
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: 150, y: 150 }],
    });
    for (let j = 1; j <= 4; j++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: 150 + j * 6, y: 150 + j * 3 }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
    if (frames)
      await f.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
    const before = await f.evaluate(() => window.count);
    await f.getByRole("button", { name: "Sichern" }).tap();
    const after = await f.evaluate(() => window.count);
    results.push({ frames, i, before, after, clicked: after === before + 1 });
  }
}
const summary = [0, 2].map((frames) => ({
  frames,
  total: 40,
  missed: results.filter((r) => r.frames === frames && !r.clicked).length,
}));
await mkdir(out, { recursive: true });
await writeFile(
  join(out, "minimal-clicks-comparison.json"),
  JSON.stringify({ summary, results }, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
await browser.close();
