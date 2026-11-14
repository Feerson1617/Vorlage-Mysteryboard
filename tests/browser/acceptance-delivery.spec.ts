import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { unzipSync } from "fflate";
import { readDocument } from "../../src/core/documents";
import {
  button,
  importMystery,
  openUniversal,
  getFile,
} from "./authoring-helpers";

test("Lieferbeispiele mit Tabelle: Editor, echte PNG, neue Sitzung und tatsächliche SCORM-Einbettung", async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const files = resolve("examples/abnahme");
  const task = await readFile(
    join(files, "MysteryBoard-Beispiel-Schuelerversion.mysteryboard"),
  );
  const draft = await readFile(
    join(files, "MysteryBoard-Beispiel-Lehrkraftentwurf.mysteryboard"),
  );
  const initial = await readFile(
    join(files, "MysteryBoard-Beispiel-Schuelerstand.mysteryboard"),
  );
  const revision = await readFile(
    join(files, "MysteryBoard-Beispiel-Ueberarbeitet.mysteryboard"),
  );
  const original = readDocument(task),
    teacher = readDocument(draft),
    student = readDocument(initial),
    newVersion = readDocument(revision);
  expect(original.kind).toBe("task");
  expect(teacher.kind).toBe("draft");
  expect(student.kind).toBe("student");
  expect(newVersion.kind).toBe("task");
  expect(teacher.content).toEqual(original.content);
  expect(student.content).toEqual(original.content);
  expect(original.content.cards).toHaveLength(12);
  expect(
    original.content.cards.filter((c) => c.group === "required"),
  ).toHaveLength(9);
  expect(
    original.content.cards.filter((c) => c.group === "extension"),
  ).toHaveLength(3);
  expect(
    original.content.cards.filter((c) => c.image).length,
  ).toBeGreaterThanOrEqual(2);
  expect(original.content.cards[3].table?.rows[1][1]).toBe("17");
  expect(newVersion.content.version).not.toBe(original.content.version);
  expect(newVersion.content.id).toBe(original.content.id);
  expect(newVersion.content.cards.at(-1)?.title).toBe(
    "Neu ergänzte Pflichtkarte",
  );
  expect(newVersion.content.cards[2].text).toContain("präzisiert");
  expect(newVersion.content.cards[0].image).not.toBe(
    original.content.cards[0].image,
  );
  expect(
    newVersion.content.cards.some(
      (c) => c.title === original.content.cards[5].title,
    ),
  ).toBe(false);
  const ctx = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    }),
    page = await ctx.newPage();
  await openUniversal(page);
  await importMystery(page, task);
  await button(page, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await button(page, "Lehrkräftemodus öffnen").tap();
  await button(page, "Karte 4 bearbeiten").tap();
  await expect(
    page.getByLabel("Zeile 2, Spalte 2", { exact: true }),
  ).toHaveValue("17");
  await ctx.close();
  const c2 = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    }),
    p2 = await c2.newPage();
  await openUniversal(p2);
  await importMystery(p2, initial);
  await expect(p2.locator("[data-card]")).toHaveCount(12);
  await button(p2, "Menü").tap();
  await button(p2, "Kleineres Sicherungsbild").tap();
  await expect(
    p2.getByRole("link", { name: "Sicherungsbild herunterladen", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const pending = p2.waitForEvent("download");
  await p2
    .getByRole("link", { name: "Sicherungsbild herunterladen", exact: true })
    .tap();
  const download = await pending;
  const pngPath = join(files, "MysteryBoard-Beispiel-Schuelerarbeitsstand.png");
  await download.saveAs(pngPath);
  const png = await readFile(pngPath);
  expect(readDocument(png)).toEqual(student);
  await c2.close();
  const c3 = await browser.newContext({ hasTouch: true }),
    p3 = await c3.newPage();
  await openUniversal(p3);
  await importMystery(p3, png, "arbeit.png");
  await button(p3, "Menü").tap();
  await button(p3, "Projektdatei sichern").tap();
  const restored = await getFile(p3, info, "restored.mysteryboard");
  expect(restored.document).toEqual(student);
  await c3.close();
  const folder = info.outputPath("scorm");
  await mkdir(folder, { recursive: true });
  for (const [name, data] of Object.entries(
    unzipSync(await readFile("artifacts/MysteryBoard-Universal-SCORM-1.2.zip")),
  ))
    await writeFile(join(folder, name), data);
  const c4 = await browser.newContext({ hasTouch: true }),
    p4 = await c4.newPage();
  const requests: string[] = [];
  c4.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://localhost:5174/")
    )
      requests.push(r.url());
  });
  await p4.addInitScript(() => {
    if (window !== window.top) return;
    const calls: unknown[][] = [];
    (window as any).__calls = calls;
    (window as any).API = Object.fromEntries(
      [
        "LMSInitialize",
        "LMSFinish",
        "LMSSetValue",
        "LMSGetValue",
        "LMSCommit",
      ].map((n) => [
        n,
        (...args: unknown[]) => {
          calls.push([n, ...args]);
          return "true";
        },
      ]),
    );
  });
  await p4.goto(
    "http://localhost:5174/" +
      relative(process.cwd(), join(folder, "launch.html")),
  );
  const frame = p4.frameLocator("iframe");
  await expect(
    frame.getByRole("button", { name: "Mystery bearbeiten", exact: true }),
  ).toBeVisible();
  const ui = p4.frames().find((f) => f.url().endsWith("/app.html"))!;
  await c4.setOffline(true);
  await importMystery(ui, png, "arbeit.png");
  await expect(ui.locator("[data-card]")).toHaveCount(12);
  await button(ui, "Menü").tap();
  await button(ui, "Projektdatei sichern").tap();
  const inScorm = await getFile(ui, info, "scorm-restored.mysteryboard");
  expect(inScorm.document).toEqual(student);
  await button(ui, "Schließen").tap();
  await button(ui, "Menü").tap();
  await button(ui, "Fortsetzen").tap();
  await ui
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({
      name: "revision.mysteryboard",
      mimeType: "application/json",
      buffer: revision,
    });
  await ui
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Neue Fassung");
  await button(ui, "Beginnen").tap();
  await button(ui, "Menü").tap();
  await button(ui, "Fortsetzen").tap();
  await ui
    .getByLabel("Mystery-Datei", { exact: true })
    .setInputFiles({ name: "alt.png", mimeType: "image/png", buffer: png });
  await expect(
    ui.getByLabel("Team: Gruppe Abnahme", { exact: true }),
  ).toBeVisible();
  await button(ui, "Menü").tap();
  await button(ui, "Projektdatei sichern").tap();
  const oldAgain = await getFile(ui, info, "old-again.mysteryboard");
  expect(oldAgain.document).toEqual(student);
  expect(requests).toEqual([]);
  expect(await p4.evaluate(() => (window as any).__calls)).toEqual([
    ["LMSInitialize", ""],
  ]);
  await p4.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    ),
  );
  expect(await p4.evaluate(() => (window as any).__calls)).toEqual([
    ["LMSInitialize", ""],
    ["LMSFinish", ""],
  ]);
  await c4.close();
});
