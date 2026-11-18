import { saveProject, overview, chooseImportCard } from "./controls.mjs";
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-evidence",
);
await mkdir(out, { recursive: true });
const server = await host(out);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    page = await context.newPage(),
    errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => requests.push(r.url()));
  const files = [];
  await page.exposeFunction("qaSave", async (data, name) => {
    const bytes = Buffer.from(data);
    await writeFile(join(out, name), bytes);
    files.push({ name, bytes: bytes.length });
    return true;
  });
  await page.exposeFunction("qaProject", async () => ({
    bytes: [
      ...(await readFile("examples/universal/unterricht-entwurf.mysteryboard")),
    ],
    name: "Beispiel.mysteryboard",
  }));
  await page.exposeFunction("qaPdf", async (html) => {
    const p = await context.newPage();
    await p.setContent(html);
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({
      path: join(out, "Studio-A4-Karten.pdf"),
      printBackground: true,
      preferCSSPageSize: true,
    });
    await p.close();
    return true;
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      openProject: async () => {
        const d = await window.qaProject();
        return { ...d, bytes: new Uint8Array(d.bytes) };
      },
      openRecent: async () => null,
      recentProjects: async () => [],
      saveProject: async (b) => {
        await window.qaSave([...b], "Studio-Testprojekt.mysteryboard");
        return { name: "Studio-Testprojekt.mysteryboard" };
      },
      projectState: async () => {},
      detachProject: async () => {},
      saveExport: async (b, name) => window.qaSave([...b], name),
      printPDF: (html) => window.qaPdf(html),
      onSaved: () => () => {},
    };
  });
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await expect(
    page.getByRole("heading", { name: "MysteryBoard Studio", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: join(out, "Studio-Start.png") });
  console.log("Studio loaded");
  const evalBlocked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const script = document.createElement("script");
        const url = URL.createObjectURL(
          new Blob(
            [
              "try { eval('1+1'); document.documentElement.dataset.qaEval='allowed' } catch {document.documentElement.dataset.qaEval='blocked'}",
            ],
            { type: "text/javascript" },
          ),
        );
        script.src = url;
        script.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
        script.onload = () => {
          resolve(document.documentElement.dataset.qaEval === "blocked");
          script.remove();
          URL.revokeObjectURL(url);
        };
        document.head.append(script);
      }),
  );
  if (!evalBlocked) throw Error("CSP permits normal-script eval");
  console.log("CSP probe", evalBlocked);
  await page
    .getByRole("button", { name: "Mystery öffnen", exact: true })
    .click();
  await expect(page.locator(".author-editor")).toBeVisible();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Studio Küsten-Mystery");
  await saveProject(page);
  await expect
    .poll(() => files.some((f) => f.name === "Studio-Testprojekt.mysteryboard"))
    .toBeTruthy();
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  await page
    .getByRole("button", { name: "Als Druck-PDF speichern", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "PDF speichern", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.screenshot({ path: join(out, "Studio-PDF-Vorschau.png") });
  await page
    .getByRole("button", { name: "PDF speichern", exact: true })
    .click();
  await expect
    .poll(async () => {
      try {
        return (await readFile(join(out, "Studio-A4-Karten.pdf"))).length;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(1000);
  await page
    .getByRole("dialog", { name: "Als Druck-PDF speichern", exact: true })
    .getByRole("button", { name: "Schließen", exact: true })
    .click();
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Für itslearning exportieren",
      exact: true,
    })
    .click();
  await expect
    .poll(() => files.some((f) => f.name.endsWith(".zip")))
    .toBeTruthy();
  const name = files.find((f) => f.name.endsWith(".zip")).name;
  const scorm = unzipSync(new Uint8Array(await readFile(join(out, name))));
  for (const [n, b] of Object.entries(scorm)) {
    const dir = join(out, "player");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, n), b);
  }
  const html = Buffer.from(scorm["app.html"]).toString();
  for (const forbidden of [
    "Lehrkräftemodus öffnen",
    "Unterrichtsmaterial importieren",
    "Kartengrenzen und Text erkennen",
    "tesseract.min.js",
  ])
    if (html.includes(forbidden))
      throw Error("Author code leaked: " + forbidden);
  const player = await context.newPage();
  await player.goto(server.origin + "/qa-evidence/player/app.html");
  await expect(
    player.getByRole("heading", { name: "Studio Küsten-Mystery", exact: true }),
  ).toBeVisible();
  await player
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Team Studio");
  await player.getByRole("button", { name: "Beginnen", exact: true }).click();
  await expect(player.locator(".board")).toBeVisible();
  await player.screenshot({ path: join(out, "Studio-Player.png") });
  await writeFile(
    join(out, "browser.json"),
    JSON.stringify(
      {
        builtStudio: true,
        desktopNative: false,
        browser: browser.version(),
        cspEvalBlocked: evalBlocked,
        files,
        externalRequests: requests.filter(
          (u) => /^https?:/.test(u) && !u.startsWith(server.origin),
        ),
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Built Studio UI, actual PDF and independent Player-SCORM passed.",
  );
} finally {
  await browser.close();
  server.close();
}
