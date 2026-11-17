import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";
import { canonical } from "./fixtures.mjs";

const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-evidence",
);
await mkdir(out, { recursive: true });
const base = JSON.parse(
  await readFile("examples/universal/unterricht-entwurf.mysteryboard", "utf8"),
);
const server = await host(out);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const [name, text] of [
    [
      "Langtext",
      "Messwert 1,5 °C, 1912 und 2,1 mg/l bleiben unverändert. ".repeat(65),
    ],
    [
      "Viele-Absaetze",
      "Ein eigener Abschnitt mit 1912 und 2,1 mg/l.\n\n".repeat(85),
    ],
  ]) {
    const draft = structuredClone(base);
    draft.content.id = "studio-pdf-grenze-" + name;
    draft.content.title = "PDF-Grenzprüfung " + name;
    draft.content.design = { font: "serif", fontSize: 18 };
    draft.content.cards = [
      {
        id: 1,
        title: "Vollständiger Originaltext",
        text: text.slice(0, 4000),
        source: "Eigener neutraler Grenztest.",
        group: "required",
      },
    ];
    draft.content.initial = {
      cards: [{ id: 1, x: 0, y: 0, color: 0 }],
      edges: [],
      categories: Array(6).fill(""),
    };
    delete draft.content.help;
    draft.author = { initials: "ST", status: "reviewed", hiddenCards: [] };
    draft.contentHash = createHash("sha256")
      .update(canonical(draft.content))
      .digest("hex");
    const path = join(out, "PDF-" + name + ".mysteryboard");
    await writeFile(path, canonical(draft));
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.exposeFunction("qaOpen", () => ({
      bytes: [...Buffer.from(canonical(draft))],
      name: "Grenztest.mysteryboard",
    }));
    await page.exposeFunction("qaPdf", async (html) => {
      const p = await context.newPage();
      await p.setContent(html);
      await p.evaluate(() => document.fonts.ready);
      await p.pdf({
        path: join(out, "PDF-" + name + ".pdf"),
        printBackground: true,
        preferCSSPageSize: true,
      });
      await p.close();
      return true;
    });
    await page.addInitScript(() => {
      window.mysteryStudio = {
        openProject: async () => {
          const d = await window.qaOpen();
          return { ...d, bytes: new Uint8Array(d.bytes) };
        },
        recentProjects: async () => [],
        projectState: async () => {},
        onSaved: () => () => {},
        printPDF: (html) => window.qaPdf(html),
      };
    });
    await page.goto(server.origin + "/studio/dist/studio/index.html");
    await page
      .getByRole("button", { name: "Mystery öffnen", exact: true })
      .click();
    await expect(page.locator(".studio-board [data-card]")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Exportieren", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Als Druck-PDF exportieren", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Als Druck-PDF exportieren",
      exact: true,
    });
    await expect
      .poll(
        async () =>
          (await dialog.getByRole("alert").count()) ||
          (await dialog
            .getByRole("button", { name: "PDF speichern", exact: true })
            .count()),
      )
      .toBeGreaterThan(0);
    const alerts = await dialog.getByRole("alert").allTextContents();
    if (alerts.length) {
      expect(alerts.join(" ")).toMatch(
        /passt auch als ganze Karte nicht lesbar/,
      );
      await expect(
        dialog.getByRole("button", { name: "PDF speichern", exact: true }),
      ).toHaveCount(0);
      results.push({
        name,
        textCharacters: draft.content.cards[0].text.length,
        exported: false,
        clearRejection: alerts,
      });
    } else {
      await dialog
        .getByRole("button", { name: "PDF speichern", exact: true })
        .click();
      await expect
        .poll(async () => {
          try {
            return (await readFile(join(out, "PDF-" + name + ".pdf"))).length;
          } catch {
            return 0;
          }
        })
        .toBeGreaterThan(1000);
      results.push({
        name,
        textCharacters: draft.content.cards[0].text.length,
        exported: true,
        warnings: await dialog.getByRole("status").allTextContents(),
      });
    }
    await page.screenshot({ path: join(out, "PDF-" + name + ".png") });
    await context.close();
  }
  await writeFile(
    join(out, "PDF-Grenzpruefung.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  server.close();
}
