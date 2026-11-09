import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import smallData from "../../src/content/small.json" with { type: "json" };
import { initialWork, validateMystery } from "../../src/core/model";
import { embedWork } from "../../src/core/png";
import { validPng } from "../fixtures/png";
const artifact = "http://localhost:5174/artifacts/MysteryBoard-klein.html";
const card = (page: Page, id = 1) => page.locator(`[data-card="${id}"]`);
const close = (page: Page) =>
  page.getByRole("button", { name: "Schließen", exact: true }).click();
async function begin(page: Page, url = artifact) {
  await page.goto(url);
  await page.getByRole("button", { name: "Beginnen", exact: true }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-card]")].map((c) => [
      c.getAttribute("data-card"),
      c.getAttribute("data-x"),
      c.getAttribute("data-y"),
      c.querySelector("rect")!.getAttribute("fill"),
    ]),
    edges: [...document.querySelectorAll("[data-edge]")].map((e) => [
      e.getAttribute("data-edge"),
      e.textContent,
      e.querySelectorAll("line")[1].getAttribute("marker-start"),
      e.querySelectorAll("line")[1].getAttribute("marker-end"),
    ]),
  }));
}
const warnsOnLeave = (page: Page) =>
  page.evaluate(
    () =>
      !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  );
async function loadInitial(page: Page) {
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles({
    name: "original.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      embedWork(validPng(), initialWork(validateMystery(smallData))),
    ),
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("mehrere Aktionen rückgängig/wiederholen, neue Bearbeitung und Import setzen Zukunft korrekt zurück", async ({
  page,
}) => {
  await begin(page);
  const baseline = await snapshot(page);
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeDisabled();
  const b = (await card(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 30, {
    steps: 5,
  });
  await page.mouse.up();
  await card(page).click();
  await page.getByRole("button", { name: "Violett", exact: true }).click();
  await page.getByLabel("Name für diese Farbe").fill("Prüfen");
  await page.getByLabel("Name für diese Farbe").press("Tab");
  await page.getByRole("button", { name: "Mit einer Karte verbinden" }).click();
  await card(page, 12).click();
  await page.getByLabel("Beschriftung").fill("Neue Verbindung");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await card(page).click();
  await page.getByRole("button", { name: "Mit einer Karte verbinden" }).click();
  await card(page, 12).click();
  await page.getByLabel("Beschriftung").fill("Überarbeitete Verbindung");
  await page.getByLabel("Richtung").selectOption("2");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  const beforeDelete = await snapshot(page);
  await card(page).click();
  await page.getByRole("button", { name: "Mit einer Karte verbinden" }).click();
  await card(page, 12).click();
  await page.getByRole("button", { name: "Verbindung löschen" }).click();
  const afterDelete = await snapshot(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  expect(await snapshot(page)).toEqual(baseline);
  await expect(
    page.getByRole("button", { name: "Rückgängig", exact: true }),
  ).toBeDisabled();
  expect(await warnsOnLeave(page)).toBe(false);
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
  expect(await snapshot(page)).toEqual(beforeDelete);
  await card(page).click();
  await expect(page.getByLabel("Name für diese Farbe")).toHaveValue("Prüfen");
  await close(page);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  expect(await snapshot(page)).toEqual(afterDelete);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await card(page).click();
  await page.getByRole("button", { name: "Blau", exact: true }).click();
  await close(page);
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeEnabled();
  await loadInitial(page);
  expect(await snapshot(page)).toEqual(baseline);
  await expect(
    page.getByRole("button", { name: "Rückgängig", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeDisabled();
});

test("erzeugtes Bild, Download und erfolgreiches oder abgebrochenes Teilen bestätigen keine dauerhafte Ablage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {},
    });
  });
  await begin(page);
  expect(await warnsOnLeave(page)).toBe(false);
  await card(page).click();
  await page.getByRole("button", { name: "Rot", exact: true }).click();
  await close(page);
  expect(await warnsOnLeave(page)).toBe(true);
  await page.getByRole("button", { name: "Sichern", exact: true }).click();
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible();
  await expect(
    page.getByText(
      /nicht prüfen, ob die Datei dort tatsächlich abgelegt wurde/,
    ),
  ).toBeVisible();
  expect(await warnsOnLeave(page)).toBe(true);
  const event = page.waitForEvent("download");
  await link.click();
  await event;
  expect(await warnsOnLeave(page)).toBe(true);
  await page.getByRole("button", { name: "Datei teilen oder ablegen" }).click();
  expect(await warnsOnLeave(page)).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Abgebrochen", "AbortError");
      },
    }),
  );
  await page.getByRole("button", { name: "Datei teilen oder ablegen" }).click();
  expect(await warnsOnLeave(page)).toBe(true);
  const leaving = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const warning = await leaving;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  expect(page.isClosed()).toBe(false);
  await close(page);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  expect(await warnsOnLeave(page)).toBe(false);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  expect(await warnsOnLeave(page)).toBe(true);
  await loadInitial(page);
  expect(await warnsOnLeave(page)).toBe(false);
});

async function inflateCanvasPng(page: Page, allModes: boolean) {
  await page.evaluate(async (all) => {
    const { crc32, MAX_PNG_BYTES } = await import(String("/src/core/png.ts"));
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const target = this;
      original.call(
        this,
        async (blob) => {
          if (!blob || (!all && target.width !== 4961)) {
            callback(blob);
            return;
          }
          const raw = new Uint8Array(await blob.arrayBuffer()),
            size = MAX_PNG_BYTES - 1;
          const out = new Uint8Array(size),
            length = size - raw.length - 12,
            start = raw.length - 12,
            view = new DataView(out.buffer);
          out.set(raw.subarray(0, -12));
          view.setUint32(start, length);
          out.set(new TextEncoder().encode("teSt"), start + 4);
          view.setUint32(
            start + length + 8,
            crc32(out.subarray(start + 4, start + 8 + length)),
          );
          out.set(raw.subarray(-12), size - 12);
          callback(new Blob([out], { type: "image/png" }));
        },
        type,
        quality,
      );
    };
  }, allModes);
}
for (const failBoth of [false, true])
  test(`PNG-Größenüberschreitung: ${failBoth ? "beide Größen scheitern ohne unbrauchbaren Download" : "kleiner Rückfallweg liefert wiederherstellbare Sicherung"}`, async ({
    page,
  }) => {
    await begin(page, "http://localhost:5173");
    await inflateCanvasPng(page, failBoth);
    await card(page).click();
    await page.getByRole("button", { name: "Rot", exact: true }).click();
    await close(page);
    const before = await snapshot(page);
    await page.getByRole("button", { name: "Sichern", exact: true }).click();
    if (failBoth) {
      await expect(page.getByRole("status")).toContainText(
        "Es konnte kein Sicherungsbild erstellt werden",
        { timeout: 45000 },
      );
      await expect(page.getByRole("status")).toContainText("größer als 30 MB");
      await expect(
        page.getByRole("link", { name: "Sicherungsbild herunterladen" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Datei teilen oder ablegen" }),
      ).toHaveCount(0);
      await close(page);
      expect(await snapshot(page)).toEqual(before);
      expect(await warnsOnLeave(page)).toBe(true);
    } else {
      await expect(
        page.getByText("Kleineres Bild · 2480 × 1754 Bildpunkte"),
      ).toBeVisible({ timeout: 45000 });
      const event = page.waitForEvent("download");
      await page
        .getByRole("link", { name: "Sicherungsbild herunterladen" })
        .click();
      const data = await readFile((await (await event).path())!);
      expect(data.length).toBeLessThanOrEqual(30_000_000);
      expect(data.readUInt32BE(16)).toBe(2480);
      await close(page);
      await page.getByRole("button", { name: "Menü", exact: true }).click();
      await page
        .getByRole("button", { name: "Fortsetzen", exact: true })
        .click();
      await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles({
        name: "fallback.png",
        mimeType: "image/png",
        buffer: data,
      });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await snapshot(page)).toEqual(before);
    }
  });

for (const format of ["svg", "png"])
  test(`quadratische, hochformatige und breite ${format}-Bilder behalten in Board und PNG identische Proportionen`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 2360, height: 1640 });
    const data = structuredClone(smallData),
      shapes = [
        [120, 120],
        [120, 300],
        [480, 120],
      ],
      colors = ["#f11117", "#17f111", "#1117f1"];
    for (let i = 0; i < 3; i++)
      Object.assign(data.cards[i], {
        image:
          "data:image/svg+xml;base64," +
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${shapes[i][0]}" height="${shapes[i][1]}"><rect width="100%" height="100%" fill="${colors[i]}"/></svg>`,
          ).toString("base64"),
        imageAlt: "Proportionstest",
      });
    if (format === "png")
      for (let i = 0; i < 3; i++)
        Object.assign(data.cards[i], {
          image:
            "data:image/png;base64," +
            Buffer.from(
              validPng(
                shapes[i][0],
                shapes[i][1],
                [
                  [241, 17, 23],
                  [23, 241, 17],
                  [17, 23, 241],
                ][i],
              ),
            ).toString("base64"),
        });
    await page.route("**/src/content/small.json*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "export default " + JSON.stringify(data),
      }),
    );
    await begin(page, "http://localhost:5173");
    await expect(page.locator('[data-card="1"] image')).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid meet",
    );
    const screen = await page.screenshot();
    const measurements = await page.evaluate(
      async ({ content, pixels }) => {
        const { exportBoard } = await import(String("/src/core/export.ts"));
        const { initialWork, validateMystery } = await import(
          String("/src/core/model.ts")
        );
        const m = validateMystery(content),
          work = initialWork(m);
        async function bounds(blob: Blob) {
          const img = await createImageBitmap(blob),
            canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          img.close();
          const raw = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          return [
            [241, 17, 23],
            [23, 241, 17],
            [17, 23, 241],
          ].map((color) => {
            let left = canvas.width,
              top = canvas.height,
              right = -1,
              bottom = -1;
            for (let y = 0; y < canvas.height; y++)
              for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                if (color.every((v, c) => Math.abs(v - raw[i + c]) < 3)) {
                  left = Math.min(left, x);
                  right = Math.max(right, x);
                  top = Math.min(top, y);
                  bottom = Math.max(bottom, y);
                }
              }
            if (right < left) throw new Error("Testbild fehlt");
            return {
              width: right - left + 1,
              height: bottom - top + 1,
              ratio: (right - left + 1) / (bottom - top + 1),
            };
          });
        }
        return {
          screen: await bounds(
            new Blob([new Uint8Array(pixels)], { type: "image/png" }),
          ),
          exported: await bounds((await exportBoard(work, m, "compact")).blob),
        };
      },
      { content: data, pixels: [...screen] },
    );
    await writeFile(
      info.outputPath("proportions.json"),
      JSON.stringify(measurements, null, 2),
    );
    for (let i = 0; i < 3; i++) {
      const expected = shapes[i][0] / shapes[i][1];
      expect(
        Math.abs(measurements.screen[i].ratio - expected) / expected,
      ).toBeLessThan(0.04);
      expect(
        Math.abs(measurements.exported[i].ratio - expected) / expected,
      ).toBeLessThan(0.02);
    }
  });

test("Werkzeugleiste bleibt mit Wiederholen bei 320 Pixeln ohne horizontales Scrollen bedienbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await begin(page);
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  for (const name of [
    "Übersicht",
    "Rückgängig",
    "Wiederholen",
    "Sichern",
    "Menü",
  ]) {
    const b = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(48);
    expect(b.height).toBeGreaterThanOrEqual(48);
    expect(b.x + b.width).toBeLessThanOrEqual(320);
  }
});
