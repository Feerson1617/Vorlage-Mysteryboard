import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { button, openUniversal } from "./authoring-helpers";
test.use({ hasTouch: true });
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 600, height: 800 },
  { width: 320, height: 700 },
])
  test(`PDF-Grenzen ${viewport.width}x${viewport.height}: teilen, zusammenführen, entfernen, ergänzen, Touch-Abbruch und Entwurfsschutz`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await openUniversal(page);
    await button(page, "Lehrkräfteeditor").tap();
    await page.getByLabel("Lehrkraftkürzel", { exact: true }).fill("GE");
    await button(page, "Lehrkräftemodus öffnen").tap();
    await page
      .getByLabel("Mystery-Titel", { exact: true })
      .fill("Unveränderter Entwurf");
    await page
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles(resolve("tests/fixtures/pdf-regions/Rahmen-20.pdf"));
    await expect(
      page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    await expect(page.locator(".import-step-body")).toBeEnabled();
    const picker = page.getByRole("combobox", {
      name: "Importkarte auswählen",
      exact: true,
    });
    await picker.selectOption("1");
    const original = await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .inputValue();
    expect(original).toContain("\n\n");
    await button(page, "Original ansehen").tap();
    await page
      .getByRole("spinbutton", { name: "Teilungsposition (%)", exact: true })
      .fill("40");
    await button(page, "Bereich teilen").tap();
    await expect(page.locator("[data-pdf-region]")).toHaveCount(16);
    await button(page, "Karten ansehen").tap();
    await expect(picker.locator("option")).toHaveCount(21);
    const first = await page
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .inputValue();
    expect(first).toBe(original.split("\n\n")[0]);
    await picker.selectOption("2");
    await expect(
      page.getByRole("textbox", { name: "Kartentext", exact: true }),
    ).toHaveValue(original.split("\n\n")[1]);
    await picker.selectOption("1");
    await button(page, "Original ansehen").tap();
    await page
      .getByRole("combobox", { name: "Anderer Kartenbereich", exact: true })
      .selectOption({ label: "Bereich 3" });
    await button(page, "Bereiche zusammenführen").tap();
    await expect(page.locator("[data-pdf-region]")).toHaveCount(15);
    await button(page, "Karten ansehen").tap();
    await expect(picker.locator("option")).toHaveCount(20);
    await expect(
      page.getByRole("textbox", { name: "Kartentext", exact: true }),
    ).toHaveValue(original);
    await button(page, "Original ansehen").tap();
    await button(page, "Kartengrenze markieren").tap();
    const fields = ["Links (%)", "Oben (%)", "Breite (%)", "Höhe (%)"],
      before = await Promise.all(
        fields.map((name) =>
          page.getByRole("spinbutton", { name, exact: true }).inputValue(),
        ),
      );
    const preview = page.locator(".import-page"),
      box = (await preview.boundingBox())!;
    const session = await page.context().newCDPSession(page),
      point = (id: number, x: number, y: number) => ({ id, x, y });
    await preview.scrollIntoViewIfNeeded();
    const rect = (await preview.boundingBox())!;
    const x = Math.max(10, rect.x + rect.width * 0.2),
      y = Math.max(
        80,
        Math.min(viewport.height - 80, rect.y + rect.height * 0.3),
      );
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(1, x, y)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(1, x + 25, y + 20)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(1, x + 25, y + 20), point(2, x + 55, y + 30)],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await session.detach();
    expect(
      await Promise.all(
        fields.map((name) =>
          page.getByRole("spinbutton", { name, exact: true }).inputValue(),
        ),
      ),
    ).toEqual(before);
    await expect(page.locator("[data-pdf-region]")).toHaveCount(15);
    await button(page, "Bereich entfernen").tap();
    await expect(page.locator("[data-pdf-region]")).toHaveCount(14);
    await button(page, "Markierung als Textkarte hinzufügen").tap();
    await expect(page.locator("[data-pdf-region]")).toHaveCount(15);
    await button(page, "Karten ansehen").tap();
    await expect(picker.locator("option")).toHaveCount(20);
    await expect(
      page.getByRole("textbox", { name: "Kartentext", exact: true }),
    ).toHaveValue(original);
    await page.screenshot({
      path: info.outputPath("manuelle-kartengrenzen.png"),
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await button(page, "Zurück zum Entwurf").tap();
    await expect(page.getByLabel("Mystery-Titel", { exact: true })).toHaveValue(
      "Unveränderter Entwurf",
    );
    await expect(page.locator(".author-card-list > li")).toHaveCount(0);
    await page
      .getByLabel("Mystery-Datei", { exact: true })
      .setInputFiles(
        resolve("tests/fixtures/pdf-regions/Unklare-Bereiche.pdf"),
      );
    await expect(
      page.getByRole("heading", { name: "2. Karten prüfen", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    await expect(page.locator(".import-step-body")).toBeEnabled();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Auf dieser PDF-Seite könnten mehrere" }),
    ).toBeVisible();
    await button(page, "Original ansehen").tap();
    await expect(
      button(page, "Markierung als Textkarte hinzufügen"),
    ).toBeVisible();
  });
