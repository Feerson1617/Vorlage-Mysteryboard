import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { host } from "./web-host.mjs";
import { scanWorkflow } from "./scan-workflow.mjs";
const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-ux-evidence",
);
await mkdir(out, { recursive: true });
const server = await host(out),
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("dialog", (d) => d.accept());
  await page.exposeFunction("qaSave", async (bytes) => {
    await writeFile(join(out, "Scan-Entwurf.mysteryboard"), Buffer.from(bytes));
    return { name: "Scan-Entwurf.mysteryboard" };
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      recentProjects: async () => [],
      projectState: async () => {},
      detachProject: async () => {},
      onSaved: () => () => {},
      saveProject: (b) => window.qaSave([...b]),
    };
  });
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await page
    .getByRole("button", { name: "Neues Mystery erstellen", exact: true })
    .click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("UX");
  await page
    .getByRole("button", { name: "Mystery erstellen", exact: true })
    .click();
  const corrected = await scanWorkflow(page, out);
  const d = JSON.parse(
    await readFile(join(out, "Scan-Entwurf.mysteryboard"), "utf8"),
  );
  expect(d.content.cards[0].text).toBe(corrected);
  console.log(
    "Studio scan: automatic OCR, card correction, boundary correction, retained other data, individual review and saved draft passed.",
  );
} finally {
  await browser.close();
  server.close();
}
