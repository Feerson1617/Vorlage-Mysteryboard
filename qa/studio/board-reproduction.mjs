import { chromium, expect } from "@playwright/test";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { host } from "./web-host.mjs";
import { button } from "./controls.mjs";
import { displacedRelease } from "./board-gestures.mjs";

const out = await mkdtemp(join(tmpdir(), "mb-drag-"));
const server = await host(out);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
  });
  const bytes = [
    ...(await readFile("examples/universal/unterricht-entwurf.mysteryboard")),
  ];
  await page.addInitScript((bytes) => {
    let state;
    let saved;
    window.qaNotifySaved = () => saved({ bytes: state.bytes });
    window.mysteryStudio = {
      openProject: async () => ({
        bytes: new Uint8Array(bytes),
        name: "Bestehendes Mystery.mysteryboard",
      }),
      recentProjects: async () => [],
      projectState: async (next) => {
        state = next;
      },
      onSaved: (listener) => {
        saved = listener;
        return () => {
          saved = undefined;
        };
      },
    };
  }, bytes);
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await button(page, "Mystery öffnen").click();
  await expect(page.locator('.studio-board [data-card="1"]')).toBeVisible();
  console.log(await displacedRelease(page, 1));
  await expect(page.locator(".studio-unsaved")).toBeVisible();
  const render = await displacedRelease(page, 2, {
    during: async () => {
      await page.evaluate(() => window.qaNotifySaved());
      await expect(page.locator(".studio-unsaved")).toHaveCount(0);
    },
  });
  await expect(page.locator(".studio-unsaved")).toBeVisible();
  console.log("Actual Studio React rerender during gesture:", render);
} finally {
  await browser.close();
  server.close();
}
