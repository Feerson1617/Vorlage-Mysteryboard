import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { roundtrip } from "./roundtrip.mjs";
import { host } from "../web-host.mjs";
import { button } from "../controls.mjs";

const [fixtures, out] = process.argv.slice(2).map((f) => resolve(f));
await mkdir(out, { recursive: true });
const expected = JSON.parse(await readFile(join(fixtures, "soll.json")));
const server = await host(out);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const report = { browser: browser.version(), cases: {} };
try {
  for (const [id, spec] of Object.entries(expected).sort()) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    page.setDefaultTimeout(20000);
    const external = [];
    try {
      await page.route("**/*", (r) => {
        if (
          /^https?:/.test(r.request().url()) &&
          !r
            .request()
            .url()
            .startsWith(server.origin + "/")
        ) {
          external.push(r.request().url());
          return r.abort();
        }
        return r.continue();
      });
      await page.exposeFunction("qaDiskWrite", async (kind, b64) =>
        writeFile(
          join(out, id + (kind === "project" ? ".mysteryboard" : ".zip")),
          Buffer.from(b64, "base64"),
        ),
      );
      await page.exposeFunction("qaDiskRead", async () =>
        (await readFile(join(out, id + ".mysteryboard"))).toString("base64"),
      );
      await page.addInitScript(() => {
        window.mysteryStudio = {
          recentProjects: async () => [],
          saveProject: async (bytes) => {
            await window.qaDiskWrite(
              "project",
              new Uint8Array(bytes).toBase64(),
            );
            return { name: "Material.mysteryboard" };
          },
          openProject: async () => ({
            name: "Material.mysteryboard",
            bytes: Uint8Array.fromBase64(await window.qaDiskRead()),
          }),
          saveExport: async (bytes) =>
            window.qaDiskWrite("export", new Uint8Array(bytes).toBase64()),
          projectState: async () => {},
          detachProject: async () => {},
          onSaved: () => () => {},
        };
        const WorkerClass = window.Worker;
        window.Worker = class extends WorkerClass {
          constructor(...args) {
            super(...args);
            this.addEventListener("message", ({ data }) => {
              if (data.type === "parsed") window.observedImport = data.result;
            });
          }
        };
      });
      await page.goto(server.origin + "/studio/dist/studio/index.html");
      await button(page, "Neues Mystery erstellen").click();
      await page.getByLabel("Lehrkraftkürzel").fill("QA");
      await button(page, "Mystery erstellen").click();
      await page
        .getByLabel("Mystery-Datei", { exact: true })
        .setInputFiles(
          spec.file
            ? resolve(spec.file)
            : join(fixtures, id + (spec.warning ? ".docx" : ".pdf")),
        );
      if (spec.reject) {
        await expect(page.getByRole("alert")).toContainText(
          /ungültig|gültige|beschädigt|lokal/i,
        );
        await button(page, "Zur Pinnwand").click();
        await expect(page.locator(".studio-board [data-card]")).toHaveCount(0);
        report.cases[id] = { state: "sicher abgelehnt", fallback: true };
        continue;
      }
      const audit = page.locator(".import-audit");
      await expect(audit).toBeVisible({ timeout: 150000 });
      if (spec.ocr) {
        await expect(
          page
            .locator(".import-cards")
            .getByText(/OCR-Karte/)
            .first(),
        ).toBeVisible({ timeout: 240000 });
        await expect(button(page, "Weiter zur Übernahme")).toBeDisabled();
      }
      await audit.locator("summary").click();
      const text = await audit.innerText();
      let measured = {};
      if (!spec.ocr) {
        const result = await page.evaluate(() => window.observedImport);
        assert.equal(result.cards.length, spec.count, id);
        const images = result.cards.flatMap((c) =>
          [c.image, ...(c.extraImages ?? []).map((i) => i.src)].filter(Boolean),
        );
        if (spec.images !== undefined)
          assert.equal(images.length, spec.images, id + " images");
        for (const [i, image] of images.entries())
          await writeFile(
            join(out, id + "-image-" + i + ".png"),
            Buffer.from(image.split(",")[1], "base64"),
          );
        if (spec.text)
          for (const t of spec.text)
            assert(
              JSON.stringify(
                result.cards.map(({ title, text, source }) => ({
                  title,
                  text,
                  source,
                })),
              ).includes(t),
              t,
            );
        if (spec.order)
          assert.deepEqual(
            result.cards.map((c) => c.title),
            spec.order,
          );
        if (spec.warning)
          assert(text.includes(spec.warning) && text.includes("PDF"), text);
        if (spec.table)
          assert(
            JSON.stringify(result.cards.map((c) => c.table)).includes("782,5"),
          );
        if (spec.visual)
          assert(
            result.cards.every((c) => !c.text.trim()),
            "duplicated visual card text",
          );
        if (spec.review)
          assert(
            text.includes("Bitte prüfen") || text.includes("Aufteilung prüfen"),
            text,
          );
        if (spec.sections)
          for (const section of spec.sections)
            assert(
              result.pdfLayout.sections.some((s) => s.text.includes(section)),
              section,
            );
        if (spec.unassigned)
          assert.equal(
            result.pdfLayout.unassignedGraphics.length,
            spec.unassigned,
          );
        for (const [p, x0, y0, x1, y1] of spec.regions ?? []) {
          assert(
            result.pdfLayout.regions.some(
              ({ page, bounds: b }) =>
                page === p &&
                [
                  b.x - x0,
                  b.y - y0,
                  b.width - x1 + x0,
                  b.height - y1 + y0,
                ].every((d) => Math.abs(d) < 2),
            ),
            "bounds " + [p, x0, y0, x1, y1],
          );
        }
        measured = {
          cards: result.cards.length,
          images: images.length,
          findings: result.findings,
          regions: result.pdfLayout?.regions,
        };
      } else {
        const count = await page
          .getByLabel("Importkarte auswählen", { exact: true })
          .locator("option")
          .count();
        if (spec.count !== null) assert.equal(count, spec.count);
        measured = { ocrCards: count, blockedBeforeReview: true };
      }
      if (spec.manual) {
        await button(page, "Fehlenden Bildbereich markieren").click();
        const crop = id === "P17" ? [60, 52.5, 30, 15] : [6, 12, 47, 27];
        for (const [i, label] of ["Links", "Oben", "Breite", "Höhe"].entries())
          await page
            .getByLabel(label + " (%)", { exact: true })
            .fill(String(crop[i]));
        await button(
          page,
          "Markierten Ausschnitt als Bildkarte übernehmen",
        ).click();
        await expect(page.locator(".import-cards img").first()).toBeVisible();
        await expect(
          page
            .getByLabel("Importkarte auswählen", { exact: true })
            .locator("option"),
        ).toHaveCount(spec.count + 1);
        measured.manualCrop = true;
      }
      if (["P04", "P05", "P11", "P13", "P14", "P17", "P18"].includes(id))
        await page.screenshot({ path: join(out, id + ".png") });
      Object.assign(measured, await roundtrip(page, id, spec, fixtures, out));
      assert.deepEqual(external, []);
      report.cases[id] = {
        state:
          spec.unassigned ||
          spec.review ||
          spec.warning ||
          spec.ocr ||
          spec.manual ||
          spec.sections ||
          spec.visual
            ? "geprüfter Vorschlag"
            : "erkannt",
        summary: text,
        ...measured,
      };
    } catch (e) {
      report.cases[id] = { state: "fehlgeschlagen", error: String(e) };
      await page.screenshot({ path: join(out, id + "-Fehler.png") });
    } finally {
      await page.close();
      await writeFile(
        join(out, "Matrix.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(id, report.cases[id].state, report.cases[id].error ?? "");
    }
  }
} finally {
  await browser.close();
  server.close();
}
assert(
  !Object.values(report.cases).some((r) => r.state === "fehlgeschlagen"),
  "Matrix contains failures",
);
