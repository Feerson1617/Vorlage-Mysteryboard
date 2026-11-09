import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const artifact = (mode = "klein") =>
  `http://localhost:5174/artifacts/MysteryBoard-${mode}.html`;
const card = (page: Page, id = 1) => page.locator(`[data-card="${id}"]`);
async function start(page: Page, mode = "klein") {
  await page.goto(artifact(mode));
  await page.getByRole("button", { name: "Beginnen", exact: true }).click();
  await expect(card(page)).toBeVisible();
}
async function position(page: Page, id = 1) {
  return card(page, id).evaluate((el) => ({
    x: Number(el.getAttribute("data-x")),
    y: Number(el.getAttribute("data-y")),
  }));
}
async function download(page: Page) {
  await page.getByRole("button", { name: "Sichern", exact: true }).click();
  const link = page.getByRole("link", { name: "Sicherungsbild herunterladen" });
  await expect(link).toBeVisible({ timeout: 45000 });
  const event = page.waitForEvent("download");
  await link.click();
  const d = await event;
  const path = await d.path();
  expect(path).toBeTruthy();
  return path!;
}
async function resume(page: Page, path: string) {
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles(path);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page)).toBeVisible();
}
test("eigenständiges HTML läuft offline; keine externen Anfragen", async ({
  page,
  context,
}, info) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && r.url() !== artifact())
      requests.push(r.url());
  });
  await page.goto(artifact());
  await context.setOffline(true);
  await page.getByRole("button", { name: "Beginnen", exact: true }).click();
  await card(page, 3).click();
  await expect(page.getByRole("dialog", { name: "Karte 3" })).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Testdiagramm zu Beobachtung 3: fünf unterschiedlich hohe Balken.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  const offlinePng = await download(page);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await resume(page, offlinePng);
  expect(requests).toEqual([]);
  await expect(page.getByLabel("Sicherungsbild", { exact: true })).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(820);
  await page.screenshot({ path: info.outputPath("board-small.png") });
});
test("Lesen, Ziehen, Verschieben, Zoom, Farbe, Verbindung und Rückgängig", async ({
  page,
}) => {
  await start(page);
  const before = await position(page);
  const box = await card(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 55,
    box!.y + box!.height / 2 + 30,
    { steps: 6 },
  );
  await page.mouse.up();
  expect(await position(page)).not.toEqual(before);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  expect(await position(page)).toEqual(before);
  const transform = await page.locator(".board>g").getAttribute("transform");
  await page.mouse.move(1150, 790);
  await page.mouse.down();
  await page.mouse.move(1090, 760, { steps: 4 });
  await page.mouse.up();
  expect(await page.locator(".board>g").getAttribute("transform")).not.toEqual(
    transform,
  );
  const zoom = Number(await page.locator(".board").getAttribute("data-zoom"));
  await page.mouse.wheel(0, -300);
  await expect
    .poll(async () =>
      Number(await page.locator(".board").getAttribute("data-zoom")),
    )
    .toBeGreaterThan(zoom);
  await page.getByRole("button", { name: "Übersicht", exact: true }).click();
  // Undo restored the original geometry; wait for that exact overview before
  // using it as the reference for the color-only edit below (Q1).
  await expect(page.locator(".board>g")).toHaveAttribute(
    "transform",
    transform!,
  );
  const view = await page.locator(".board>g").getAttribute("transform");
  await card(page).click();
  await expect(page.getByRole("dialog", { name: "Karte 1" })).toBeVisible();
  await page.getByRole("button", { name: "Violett", exact: true }).click();
  await page.getByLabel("Name für diese Farbe").fill("Noch prüfen");
  await page.getByLabel("Name für diese Farbe").press("Tab");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  expect(await page.locator(".board>g").getAttribute("transform")).toEqual(
    view,
  );
  await expect(card(page).locator("rect").first()).toHaveAttribute(
    "fill",
    "#eadfea",
  );
  await card(page).click();
  await page.getByRole("button", { name: "Mit einer Karte verbinden" }).click();
  await card(page, 12).click();
  await page
    .getByLabel("Beschriftung")
    .fill("Eigene Verbindung: größer → kleiner, ÄÖÜ ß");
  await page.getByLabel("Richtung").selectOption("1");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator("[data-edge]")).toHaveCount(10);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.locator("[data-edge]")).toHaveCount(9);
});
test("kleine Original-PNG: A3-Export, neues Fenster, Import und weiter bearbeiten", async ({
  page,
  browser,
}, info) => {
  await start(page);
  await card(page).click();
  await page.getByRole("button", { name: "Rot", exact: true }).click();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  const path = await download(page);
  await expect(
    page.getByText("Großes Bild · 4961 × 3508 Bildpunkte"),
  ).toBeVisible();
  const bytes = await readFile(path);
  expect(bytes.readUInt32BE(16)).toBe(4961);
  expect(bytes.readUInt32BE(20)).toBe(3508);
  await writeFile(info.outputPath("small-a3.png"), bytes);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  const oldZoom = Number(
    await page.locator(".board").getAttribute("data-zoom"),
  );
  await page.mouse.move(550, 350);
  await page.mouse.wheel(0, -400);
  await expect
    .poll(async () =>
      Number(await page.locator(".board").getAttribute("data-zoom")),
    )
    .toBeGreaterThan(oldZoom);
  const zoomed = await download(page);
  expect(await readFile(zoomed)).toEqual(bytes);
  const fresh = await browser.newPage();
  await fresh.goto(artifact());
  await resume(fresh, path);
  await expect(card(fresh).locator("rect").first()).toHaveAttribute(
    "fill",
    "#f0ded8",
  );
  await card(fresh).click();
  await fresh.getByRole("button", { name: "Blau", exact: true }).click();
  await fresh.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(card(fresh).locator("rect").first()).toHaveAttribute(
    "fill",
    "#e0e9f1",
  );
  // Open an existing connection through the same two-card interaction, then edit it.
  await card(fresh).click();
  await fresh
    .getByRole("button", { name: "Mit einer Karte verbinden" })
    .click();
  await card(fresh, 2).click();
  await fresh.getByLabel("Beschriftung").fill("Nach dem Import bearbeitet");
  await fresh.getByLabel("Richtung").selectOption("2");
  await fresh.getByRole("button", { name: "Übernehmen" }).click();
  await expect(fresh.locator('[data-edge-label="1"]')).toContainText(
    "Nach dem Import bearbeitet",
  );
  await fresh.close();
});
test("60 Karten: PNG oberhalb QR-Limit, Wiederherstellung, Bearbeitung und beschädigter Import", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await start(page, "umfangreich");
  await expect(page.locator("[data-card]")).toHaveCount(60);
  await expect(page.locator("[data-edge]")).toHaveCount(90);
  const before = await position(page);
  const path = await download(page);
  await expect(page.getByRole("status")).toContainText(
    "zu groß für einen Code",
  );
  await writeFile(info.outputPath("large-a3.png"), await readFile(path));
  await page.goto(artifact("umfangreich"));
  await resume(page, path);
  expect(await position(page)).toEqual(before);
  await expect(page.locator("[data-edge]")).toHaveCount(90);
  // The group also includes the exterior number; click the painted card body.
  await card(page, 60).locator("rect").first().click();
  await page.getByRole("button", { name: "Gelb", exact: true }).click();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  const broken = await readFile(path);
  broken[100] ^= 1;
  await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: broken,
  });
  await expect(page.getByRole("status")).toContainText("PNG-Datei");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(card(page, 60).locator("rect").first()).toHaveAttribute(
    "fill",
    "#f3e8ce",
  );
  expect(await position(page)).toEqual(before);
});
test("abgebrochener Import verändert den geöffneten Stand nicht", async ({
  page,
}) => {
  await start(page);
  const path = await download(page);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await card(page).click();
  await page.getByRole("button", { name: "Violett", exact: true }).click();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((r) => setTimeout(r, 700));
      return original.call(this);
    };
  });
  await page.getByRole("button", { name: "Menü", exact: true }).click();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await page.getByLabel("Sicherungsbild", { exact: true }).setInputFiles(path);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.waitForTimeout(900);
  await expect(card(page).locator("rect").first()).toHaveAttribute(
    "fill",
    "#eadfea",
  );
});
test("Kamera verweigert: klare Meldung und Bildauswahl bleibt verfügbar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
      configurable: true,
    });
  });
  await page.goto(artifact());
  await page.getByRole("button", { name: "Fortsetzen" }).click();
  await page.getByRole("button", { name: "QR-Code scannen" }).click();
  await expect(
    page.getByText(/Die Kamera ist hier nicht verfügbar/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sicherungsbild auswählen" }),
  ).toBeEnabled();
});
test("Zwei-Finger-Geste auf einer Karte verwirft begonnenes Ziehen und erzeugt keinen Klick", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1180, height: 820 },
  });
  const page = await context.newPage();
  await start(page);
  const pos = await position(page),
    box = await card(page).boundingBox(),
    x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  const client = await context.newCDPSession(page);
  const touch = (type: string, pts: { x: number; y: number; id: number }[]) =>
    client.send("Input.dispatchTouchEvent", {
      type: type as "touchStart",
      touchPoints: pts,
    });
  await touch("touchStart", [{ x, y, id: 1 }]);
  await touch("touchMove", [{ x: x + 30, y: y + 20, id: 1 }]);
  await touch("touchStart", [
    { x: x + 30, y: y + 20, id: 1 },
    { x: x + 150, y: y + 20, id: 2 },
  ]);
  const zoom = Number(await page.locator(".board").getAttribute("data-zoom"));
  await touch("touchMove", [
    { x: x + 10, y, id: 1 },
    { x: x + 200, y: y + 20, id: 2 },
  ]);
  await touch("touchEnd", [{ x: x + 200, y: y + 20, id: 2 }]);
  await touch("touchMove", [{ x: x + 220, y: y + 40, id: 2 }]);
  await touch("touchEnd", []);
  expect(await position(page)).toEqual(pos);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rückgängig" })).toBeDisabled();
  expect(
    Number(await page.locator(".board").getAttribute("data-zoom")),
  ).toBeGreaterThan(zoom);
  await page.getByRole("button", { name: "Übersicht", exact: true }).click();
  await card(page).tap();
  await page.getByRole("button", { name: "Mit einer Karte verbinden" }).click();
  const c = await card(page, 12).boundingBox(),
    tx = c!.x + c!.width / 2,
    ty = c!.y + c!.height / 2;
  await touch("touchStart", [
    { x: tx, y: ty, id: 1 },
    { x: tx + 60, y: ty, id: 2 },
  ]);
  await touch("touchMove", [
    { x: tx - 15, y: ty, id: 1 },
    { x: tx + 80, y: ty, id: 2 },
  ]);
  await touch("touchEnd", []);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-edge]")).toHaveCount(9);
  await context.close();
});
test("gerenderte Sicherungen: zehn Zyklen, QR-Erkennung, zoomunabhängiger Export", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto("http://localhost:5173");
  const metrics = await page.evaluate(async () => {
    const { exportBoard } = await import(String("/src/core/export.ts"));
    const { restorePng } = await import(String("/src/core/png.ts"));
    const { initialWork, validateMystery } = await import(
      String("/src/core/model.ts")
    );
    const { fromQr } = await import(String("/src/core/codec.ts"));
    const { scanPixels } = await import(String("/src/core/qr.ts"));
    const { default: data } = await import(String("/src/content/small.json"));
    const m = validateMystery(data);
    let work = initialWork(m);
    const original = JSON.stringify(work),
      sizes = [];
    let decoded = false;
    for (let i = 0; i < 10; i++) {
      const exported = await exportBoard(work, m, "compact");
      sizes.push(exported.blob.size);
      work = restorePng(new Uint8Array(await exported.blob.arrayBuffer()), m);
      if (JSON.stringify(work) !== original)
        throw new Error("Datenverlust in Zyklus " + i);
      if (i === 0) {
        const image = await createImageBitmap(exported.blob),
          c = document.createElement("canvas");
        const q = exported.qrBounds;
        c.width = q.size;
        c.height = q.size;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(image, q.x, q.y, q.size, q.size, 0, 0, q.size, q.size);
        const found = scanPixels(ctx.getImageData(0, 0, q.size, q.size));
        image.close();
        if (!found)
          throw new Error("QR aus dem exportierten Bild nicht erkannt");
        decoded = JSON.stringify(fromQr(found.data, m)) === original;
      }
    }
    const a = await exportBoard(work, m, "compact"),
      b = await exportBoard(work, m, "compact");
    const aa = new Uint8Array(await a.blob.arrayBuffer()),
      bb = new Uint8Array(await b.blob.arrayBuffer());
    if (aa.length !== bb.length || !aa.every((v, i) => v === bb[i]))
      throw new Error("Export nicht deterministisch");
    return { cycles: 10, decoded, sizes };
  });
  expect(metrics.decoded).toBe(true);
  await writeFile(
    info.outputPath("cycles.json"),
    JSON.stringify(metrics, null, 2),
  );
});
test("kleiner Export als Rückfallweg bei fehlgeschlagenem großem Canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width === 4961) {
        callback(null);
        return;
      }
      original.call(this, callback, type, quality);
    };
  });
  await start(page);
  const path = await download(page);
  await expect(
    page.getByText("Kleineres Bild · 2480 × 1754 Bildpunkte"),
  ).toBeVisible();
  const data = await readFile(path);
  expect(data.readUInt32BE(16)).toBe(2480);
  expect(data.readUInt32BE(20)).toBe(1754);
  await page.goto(artifact());
  await resume(page, path);
});
test("vorhandene Linie direkt antippen, bearbeiten, löschen und rückgängig machen", async ({
  page,
}) => {
  await start(page);
  const line = page.locator('[data-edge-label="1"]');
  await line.click();
  await page.getByLabel("Beschriftung").fill("Direkt ausgewählt");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator('[data-edge-label="1"]')).toContainText(
    "Direkt ausgewählt",
  );
  await page.locator('[data-edge-label="1"]').click();
  await page.getByRole("button", { name: "Verbindung löschen" }).click();
  await expect(page.locator("[data-edge]")).toHaveCount(8);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.locator('[data-edge-label="1"]')).toContainText(
    "Direkt ausgewählt",
  );
});
test("Kameraablauf mit künstlichem Videostream: kompletter QR-Zustand und Stream-Ende", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  await page.evaluate(async () => {
    const { exportBoard } = await import(String("/src/core/export.ts"));
    const { initialWork, validateMystery } = await import(
      String("/src/core/model.ts")
    );
    const { default: data } = await import(String("/src/content/small.json"));
    const work = initialWork(validateMystery(data));
    work.cards[0].x = -77;
    work.cards[0].color = 5;
    const result = await exportBoard(work, validateMystery(data), "compact"),
      image = await createImageBitmap(result.blob),
      canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 640, 640);
    const q = result.qrBounds;
    ctx.drawImage(image, q.x, q.y, q.size, q.size, 0, 0, 640, 640);
    image.close();
    const stream = canvas.captureStream(10);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    Object.assign(window, { testStream: stream });
  });
  await page.getByRole("button", { name: "Fortsetzen" }).click();
  await page.getByRole("button", { name: "QR-Code scannen" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15000 });
  await expect(card(page).locator("rect").first()).toHaveAttribute(
    "fill",
    "#f0ded8",
  );
  expect((await position(page)).x).toBe(-77);
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStream: MediaStream }).testStream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
});
test("QR nahe der Kapazitätsgrenze ist aus dem kleineren PNG vollständig lesbar", async ({
  page,
}, info) => {
  await page.goto("http://localhost:5173");
  const metric = await page.evaluate(async () => {
    const { exportBoard } = await import(String("/src/core/export.ts"));
    const { packWork, toQr, fromQr } = await import(
      String("/src/core/codec.ts")
    );
    const { scanPixels } = await import(String("/src/core/qr.ts"));
    const { initialWork, validateMystery } = await import(
      String("/src/core/model.ts")
    );
    const { default: data } = await import(String("/src/content/small.json"));
    const m = validateMystery(data),
      work = initialWork(m);
    let seed = 327;
    let qr: string | null = "";
    for (let i = 0; i < 900; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      work.edges[Math.floor(i / 450)].label += String.fromCharCode(
        33 + (seed % 90),
      );
      qr = toQr(packWork(work));
      if (qr && qr.length >= 490) break;
    }
    if (!qr || qr.length < 490) throw new Error("Grenzfall nicht erreicht");
    const result = await exportBoard(work, m, "compact"),
      image = await createImageBitmap(result.blob),
      canvas = document.createElement("canvas");
    const q = result.qrBounds;
    canvas.width = q.size;
    canvas.height = q.size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, q.x, q.y, q.size, q.size, 0, 0, q.size, q.size);
    image.close();
    const found = scanPixels(ctx.getImageData(0, 0, q.size, q.size));
    if (
      !found ||
      JSON.stringify(fromQr(found.data, m)) !== JSON.stringify(work)
    )
      throw new Error("QR-Grenzfall nicht vollständig erkannt");
    return {
      qrCharacters: qr.length,
      width: result.width,
      height: result.height,
    };
  });
  expect(metric.qrCharacters).toBeLessThanOrEqual(500);
  await writeFile(
    info.outputPath("qr-boundary.json"),
    JSON.stringify(metric, null, 2),
  );
});
