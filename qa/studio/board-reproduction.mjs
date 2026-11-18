import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { host } from "./web-host.mjs";
import { button } from "./controls.mjs";
import { displacedRelease } from "./board-gestures.mjs";
import { readFile } from "node:fs/promises";

const out = await mkdtemp(join(tmpdir(), "mb-drag-"));
const server = await host(out);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
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
    window.mysteryStudio = {
      openProject: async () => ({
        bytes: new Uint8Array(bytes),
        name: "Bestehendes Mystery.mysteryboard",
      }),
      recentProjects: async () => [],
      projectState: async () => {},
      onSaved: () => () => {},
    };
  }, bytes);
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await button(page, "Mystery öffnen").click();
  await expect(page.locator('.studio-board [data-card="1"]')).toBeVisible();
  console.log(await displacedRelease(page, 1));
} finally {
  await browser.close();
  server.close();
}
