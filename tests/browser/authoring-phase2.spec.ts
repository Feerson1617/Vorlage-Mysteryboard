import { test, expect } from "@playwright/test";
import {
  button,
  openUniversal,
  importMystery,
  getFile,
  createTwelve,
} from "./authoring-helpers";
test.use({ hasTouch: true, viewport: { width: 768, height: 1024 } });
test("Phase 2: zwölf Karten mit drei Medien erstellen, Entwurf schließen und erneut bearbeiten", async ({
  browser,
}, info) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 768, height: 1024 },
    }),
    page = await context.newPage();
  await openUniversal(page);
  await createTwelve(page);
  await page.screenshot({
    path: info.outputPath("author-twelve.png"),
    fullPage: true,
  });
  await button(page, "Entwurf sichern").click();
  const draft = await getFile(page, info, "beispiel-entwurf.mysteryboard");
  expect(draft.document.kind).toBe("draft");
  if (draft.document.kind !== "draft") throw new Error();
  expect(draft.document.author.initials).toBe("AB");
  expect(
    draft.document.content.cards.filter((c) => c.group === "required"),
  ).toHaveLength(9);
  expect(draft.document.content.cards.filter((c) => c.image)).toHaveLength(3);
  expect(draft.document.content.cards[3].text).toBe(
    "Nachträglich geprüfter Kartentext 4.",
  );
  await context.close();
  const fresh = await browser.newContext({
      hasTouch: true,
      viewport: { width: 768, height: 1024 },
    }),
    next = await fresh.newPage();
  await openUniversal(next);
  await importMystery(next, draft.bytes);
  await expect(next.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
    draft.document.content.title,
  );
  await expect(next.locator(".author-card-list li")).toHaveCount(12);
  await button(next, "Karte 1 bearbeiten").click();
  await expect(next.locator(".media-view > img")).toBeVisible();
  await expect(
    next.getByLabel("Bildbeschreibung (optional)", { exact: true }),
  ).toHaveValue("Diagramm 1 mit Kreis und Legende");
  await button(next, "Karte übernehmen").click();
  await button(
    next,
    "Mystery für Schülerinnen und Schüler bereitstellen",
  ).click();
  await button(next, "Neue Schülerversion exportieren").click();
  const task = await getFile(next, info, "beispiel-aufgabe.mysteryboard");
  expect(task.document.kind).toBe("task");
  expect(task.document).not.toHaveProperty("author");
  expect(task.document).not.toHaveProperty("work");
  expect(task.document.content.initial.edges).toEqual([]);
  await fresh.close();
});
