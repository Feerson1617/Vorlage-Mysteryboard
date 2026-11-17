import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";
import { button, saveProject } from "./controls.mjs";
const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-ux-evidence",
);
await mkdir(out, { recursive: true });
const original = JSON.parse(
  await readFile(
    "tests/fixtures/document-import/ORIGINAL-INHALTE.json",
    "utf8",
  ),
);
const server = await host(out);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.exposeFunction("qaSave", async (bytes) => {
    await writeFile(join(out, "Word-12.mysteryboard"), Buffer.from(bytes));
    return { name: "Word-12.mysteryboard" };
  });
  await page.addInitScript(() => {
    window.mysteryStudio = {
      recentProjects: async () => [],
      projectState: async () => {},
      detachProject: async () => {},
      onSaved: () => () => {},
      saveProject: (bytes) => window.qaSave([...bytes]),
    };
  });
  await page.goto(server.origin + "/studio/dist/studio/index.html");
  await button(page, "Neues Mystery erstellen").click();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("UX");
  await button(page, "Mystery erstellen").click();
  await button(page, "Importieren").click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles(
      resolve("tests/fixtures/document-import/A-Word-12-Karten.docx"),
    );
  await expect(page.locator(".studio-import-summary")).toContainText(
    "12 Karten erkannt",
  );
  for (let i = 0; i < 12; i++) {
    await page
      .getByRole("button", { name: `Bereich ${i + 1} auswählen`, exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: `Karte ${i + 1} von 12`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Überschrift", exact: true }),
    ).toHaveValue(original.A[i].title);
    await expect(
      page.getByRole("textbox", { name: "Kartentext", exact: true }),
    ).toHaveValue(original.A[i].paragraphs.join("\n\n"));
  }
  await page.screenshot({ path: join(out, "Word-12-Original-und-Karte.png") });
  await button(page, "Weiter zur Übernahme").click();
  await page.getByRole("checkbox", { name: /Ich habe Texte/ }).check();
  await button(page, "Karten übernehmen").click();
  await expect(page.locator(".studio-board [data-card]")).toHaveCount(12);
  await saveProject(page);
  const saved = JSON.parse(
    await readFile(join(out, "Word-12.mysteryboard"), "utf8"),
  );
  expect(
    saved.content.cards.filter((c) => c.group === "extension").map((c) => c.id),
  ).toEqual([3, 8, 12]);
  await writeFile(
    join(out, "Word-UX.json"),
    JSON.stringify(
      {
        passed: true,
        cards: 12,
        everyOriginalRegionSelectable: true,
        allTitlesAndParagraphsEqual: true,
        extensionCards: [3, 8, 12],
        wordPageLayoutNotPixelIdentical: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Studio Word: all 12 original cards selected and checked, paragraphs and extension assignment preserved.",
  );
} finally {
  await browser.close();
  server.close();
}
