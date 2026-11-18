import { saveProject, overview, chooseImportCard } from "./controls.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { host } from "./web-host.mjs";
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
  await page.exposeFunction("qaSave", async (bytes) => {
    await writeFile(
      join(out, "Diagramm-Entwurf.mysteryboard"),
      Buffer.from(bytes),
    );
    return { name: "Diagramm-Entwurf.mysteryboard" };
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      recentProjects: async () => [],
      detachProject: async () => {},
      projectState: async () => {},
      saveProject: async (b) => window.qaSave([...b]),
      onSaved: () => () => {},
    };
  });
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await page
    .getByRole("button", { name: "Neues Mystery erstellen", exact: true })
    .click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("ST");
  await page
    .getByRole("button", { name: "Mystery erstellen", exact: true })
    .click();
  await page
    .getByLabel("Mystery-Titel", { exact: true })
    .fill("Grafiken bleiben Originale");
  await page
    .getByRole("navigation", { name: "Mystery bearbeiten" })
    .getByRole("button", { name: "Importieren", exact: true })
    .click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles(resolve("tests/fixtures/studio/Foto-Diagramm.png"));
  await expect(
    page.getByRole("heading", { name: "Karten kontrollieren", exact: true }),
  ).toBeVisible({ timeout: 60000 });

  await expect(page.locator(".import-step-body")).not.toHaveAttribute(
    "disabled",
    "",
    { timeout: 240000 },
  );
  await expect(page.getByRole("alert")).toHaveCount(0);

  const picker = page.getByLabel("Importkarte auswählen", { exact: true });
  await expect(picker.locator("option")).toHaveCount(2, { timeout: 240000 });
  await chooseImportCard(page, 0);
  await expect(
    page.getByRole("img", {
      name: "Originalausschnitt aus der importierten Karte",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: join(out, "Studio-Originaldiagramm-OCR.png"),
    fullPage: true,
  });
  for (let i = 0; i < 2; i++) {
    await chooseImportCard(page, i);
    await page.getByRole("checkbox", { name: /Diese OCR-Karte/ }).check();
  }
  await page
    .getByRole("button", { name: "Weiter zur Übernahme", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
  await page
    .getByRole("button", { name: "Karten übernehmen", exact: true })
    .click();
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(2, {
    timeout: 240000,
  });
  await saveProject(page);
  await expect
    .poll(async () => {
      try {
        return JSON.parse(
          await readFile(join(out, "Diagramm-Entwurf.mysteryboard"), "utf8"),
        ).content.cards.length;
      } catch {
        return 0;
      }
    })
    .toBe(2);
  const d = JSON.parse(
    await readFile(join(out, "Diagramm-Entwurf.mysteryboard"), "utf8"),
  );
  expect(d.content.cards[0].image).toMatch(/^data:image\/(png|jpeg);base64,/);
  expect(d.content.cards[0].table).toBeUndefined();
  await writeFile(
    join(out, "Diagramm-Nachweis.json"),
    JSON.stringify(
      {
        cards: d.content.cards.length,
        originalCropPreserved: true,
        notConvertedToInventedTable: true,
        imageBytes: d.content.cards[0].image.length,
        rawOCR: d.content.cards.map((c) => ({ title: c.title, text: c.text })),
      },
      null,
      2,
    ),
  );
  console.log("Original diagram crop preserved; two cards, no invented table.");
} finally {
  await browser.close();
  server.close();
}
