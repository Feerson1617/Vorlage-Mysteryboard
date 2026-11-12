import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import large from "../../src/content/large.json" with { type: "json" };
import { validateMystery, withTeam } from "../../src/core/model";
import { restorePng } from "../../src/core/png";
import { packWork } from "../../src/core/codec";

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const close = (page: Page) => button(page, "Schließen").tap();

async function rename(page: Page, name: string) {
  await button(page, "Menü").tap();
  await button(page, "Teamname ändern").tap();
  await page
    .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
    .fill(name);
  await button(page, "Übernehmen").tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function png(page: Page) {
  await button(page, "Menü").tap();
  await button(page, "Kleineres Sicherungsbild").tap();
  const link = page.getByRole("link", {
    name: "Sicherungsbild herunterladen",
    exact: true,
  });
  await expect(link).toBeVisible({ timeout: 60000 });
  const downloaded = page.waitForEvent("download");
  await link.tap();
  const bytes = await readFile((await (await downloaded).path())!);
  await close(page);
  return bytes;
}

async function openPrint(page: Page) {
  await button(page, "Menü").tap();
  await button(page, "Druckfassung / PDF").tap();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Druckfassung / PDF",
  );
}

async function historyAndDirty(page: Page) {
  return {
    undo: await button(page, "Rückgängig").isEnabled(),
    redo: await button(page, "Wiederholen").isEnabled(),
    dirty: await page.evaluate(
      () =>
        !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    ),
  };
}

test("Druck-Lebenszyklus: Touch-Abbruch während A4/A3-Vorbereitung, neuer A4-Auftrag und unveränderte PNG/History", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  const mystery = validateMystery(large);
  const original = await readFile(
    "tests/fixtures/review/60-90-Gruppenstand.png",
  );
  const legacy = restorePng(new Uint8Array(original), mystery);
  expect(legacy.schema).toBe(1);
  expect(legacy.team).toBeUndefined();
  const name = "Özlem und Jörg – Druckabbruch",
    changedName = "Özlem und Jörg – weitere Bearbeitung",
    expected = withTeam(legacy, name),
    expectedRedo = withTeam(legacy, changedName);
  const url = "http://localhost:5174/artifacts/MysteryBoard-umfangreich.html";
  const observation = {
    requests: [] as string[],
    errors: [] as string[],
    nativeDialogs: [] as string[],
  };
  page.on("request", (request) => {
    const initialDocument =
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      request.frame() === page.mainFrame() &&
      request.url() === url;
    if (/^https?:/.test(request.url()) && !initialDocument)
      observation.requests.push(request.url());
  });
  page.on("pageerror", (error) => observation.errors.push(error.message));
  page.on("dialog", async (dialog) => {
    observation.nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  // Controlled timing fault injection only: postpone the print renderer's
  // existing zero-delay yields while its iframe is present. This proves that
  // cancellation happens during preparation; no source, CSP or guard changes.
  await page.addInitScript(() => {
    const target = window as unknown as {
      printDelay: { enabled: boolean; pending: number; delayed: number };
    };
    const probe = (target.printDelay = {
      enabled: false,
      pending: 0,
      delayed: 0,
    });
    const originalTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: any[]
    ) => {
      if (
        probe.enabled &&
        delay === 0 &&
        typeof handler === "function" &&
        document.querySelector('iframe[title="Druckvorschau"]')
      ) {
        probe.pending++;
        probe.delayed++;
        return originalTimeout(() => {
          probe.pending--;
          handler(...args);
        }, 600);
      }
      return originalTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
  await page.goto(url);
  await context.setOffline(true);
  await button(page, "Fortsetzen").tap();
  const chooser = page.waitForEvent("filechooser");
  await button(page, "Sicherungsbild auswählen").tap();
  await (
    await chooser
  ).setFiles({
    name: "60-90-Gruppenstand.png",
    mimeType: "image/png",
    buffer: original,
  });
  await expect(page.locator("[data-card]")).toHaveCount(60);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await rename(page, name);
  await rename(page, changedName);
  await button(page, "Rückgängig").tap();
  const before = restorePng(new Uint8Array(await png(page)), mystery);
  expect(before).toEqual(expected);
  const beforeHistory = await historyAndDirty(page);
  expect(beforeHistory).toEqual({ undo: true, redo: true, dirty: true });

  await page.evaluate(() => {
    (window as any).printDelay.enabled = true;
  });
  await openPrint(page);
  const printButton = button(page, "Drucken / PDF speichern"),
    select = page.getByRole("combobox", { name: "Papierformat", exact: true }),
    preview = page.frameLocator('iframe[title="Druckvorschau"]');
  const switches: string[] = [];
  for (const paper of ["a4", "a3", "a4", "a3"]) {
    if (switches.length) await select.selectOption(paper);
    await expect(preview.locator("html")).toHaveAttribute(
      "data-print-paper",
      paper,
    );
    await expect(printButton).toBeDisabled();
    await expect(preview.locator("body")).not.toHaveAttribute(
      "data-print-ready",
      "true",
    );
    switches.push(paper);
  }
  await expect
    .poll(() => page.evaluate(() => (window as any).printDelay.pending))
    .toBeGreaterThan(0);
  await close(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).printDelay.enabled = false;
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).printDelay.pending))
    .toBe(0);
  await expect.poll(() => page.frames().length).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await historyAndDirty(page)).toEqual(beforeHistory);
  expect(observation).toEqual({ requests: [], errors: [], nativeDialogs: [] });

  await openPrint(page);
  await expect(select).toHaveValue("a4");
  await expect(preview.locator("html")).toHaveAttribute(
    "data-print-paper",
    "a4",
  );
  await expect(preview.locator("body")).toHaveAttribute(
    "data-print-ready",
    "true",
    { timeout: 60000 },
  );
  await expect(printButton).toBeEnabled();
  await expect(page.locator("iframe")).toHaveCount(1);
  expect(page.frames()).toHaveLength(2);
  await expect(preview.locator("article[data-card-id]")).toHaveCount(60);
  await expect(preview.locator("article[data-edge-id]")).toHaveCount(90);
  await expect(preview.locator(".print-team").first()).toHaveText(name);
  await close(page);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect.poll(() => page.frames().length).toBe(1);
  const after = restorePng(new Uint8Array(await png(page)), mystery);
  expect(after).toEqual(before);
  expect(Buffer.from(packWork(after))).toEqual(Buffer.from(packWork(before)));
  expect(await historyAndDirty(page)).toEqual(beforeHistory);

  // The pre-existing future and past still point to exactly the same states.
  await button(page, "Wiederholen").tap();
  expect(restorePng(new Uint8Array(await png(page)), mystery)).toEqual(
    expectedRedo,
  );
  await button(page, "Rückgängig").tap();
  expect(restorePng(new Uint8Array(await png(page)), mystery)).toEqual(
    expected,
  );
  expect(await historyAndDirty(page)).toEqual(beforeHistory);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(observation).toEqual({ requests: [], errors: [], nativeDialogs: [] });
  await info.attach("print-lifecycle.json", {
    body: JSON.stringify(
      {
        timingInjection:
          "600 ms for existing 0-ms yields only while print iframe is visible; disabled before final preparation",
        switches,
        delayedYields: await page.evaluate(
          () => (window as any).printDelay.delayed,
        ),
        canceledDuringPreparation: true,
        orphanIframes: 0,
        finalPaper: "a4",
        cards: 60,
        edges: 90,
        exactStateAndPackedBytesPreserved: true,
        beforeHistory,
        afterHistory: await historyAndDirty(page),
        observation,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
