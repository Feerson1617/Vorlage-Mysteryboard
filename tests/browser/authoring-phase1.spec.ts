import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import source from "../../examples/universal/content.json" with { type: "json" };
import {
  encodeDocument,
  readDocument,
  taskDocument,
} from "../../src/core/documents";
test.use({ hasTouch: true });
test("Phase 1: echte Blanko-HTML öffnet Aufgabe, sichert vollständige PNG und stellt sie offline frisch wieder her", async ({
  browser,
}, info) => {
  const requests: string[] = [];
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      requests.push(r.url());
  });
  await page.goto(
    "http://localhost:5174/artifacts/MysteryBoard-Universal.html",
  );
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Mystery bearbeiten", exact: true })
    .click();
  await page
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({
      name: "aufgabe.mysteryboard",
      mimeType: "application/json",
      buffer: Buffer.from(encodeDocument(taskDocument(source))),
    });
  await expect(
    page.getByRole("heading", { name: source.title, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Gruppe Phase 1");
  await page.getByRole("button", { name: "Beginnen", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(12);
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await page
    .getByRole("button", { name: "Kleineres Sicherungsbild", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Sicherungsbild herunterladen", exact: true })
    .click();
  const download = await downloadEvent,
    path = info.outputPath("phase1-original.png");
  await download.saveAs(path);
  const bytes = await readFile(path),
    doc = readDocument(bytes);
  expect(doc.kind).toBe("student");
  if (doc.kind !== "student") throw new Error("student missing");
  expect(doc.work.team).toBe("Gruppe Phase 1");
  expect(doc.content).toEqual(taskDocument(source).content);
  await context.close();
  const fresh = await browser.newContext({ hasTouch: true });
  const next = await fresh.newPage();
  await next.goto(
    "http://localhost:5174/artifacts/MysteryBoard-Universal.html",
  );
  await fresh.setOffline(true);
  await next
    .getByRole("button", { name: "Mystery bearbeiten", exact: true })
    .click();
  await next
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({
      name: "arbeit.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(next.locator(".card")).toHaveCount(12);
  await expect(
    next.getByLabel("Team: Gruppe Phase 1", { exact: true }),
  ).toBeVisible();
  await next.screenshot({ path: info.outputPath("phase1-restored.png") });
  expect(requests).toEqual([]);
  await fresh.close();
});
