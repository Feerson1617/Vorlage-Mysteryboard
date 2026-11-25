import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
import { releaseOnly, cardPosition } from "./student-release.mjs";
const [archive, output, phase] = process.argv.slice(2),
  out = resolve(output);
await mkdir(out, { recursive: true });
const dir = join(out, "sco");
await mkdir(dir, { recursive: true });
for (const [k, v] of Object.entries(unzipSync(await readFile(archive)))) {
  assert(!k.includes("/"));
  await writeFile(join(dir, k), v);
}
const server = await host(out);
const old = phase === "before",
  result = [];
try {
  for (const [name, type, path] of [
    ["Chromium", chromium, process.env.CHROMIUM_PATH],
    ["WebKit", webkit, process.env.WEBKIT_PATH],
  ]) {
    const b = await type.launch({ executablePath: path || undefined });
    try {
      for (const [w, h] of [
        [768, 1024],
        [1024, 768],
        [768, 620],
      ]) {
        const p = await b.newPage({
          viewport: { width: w, height: h },
          hasTouch: true,
        });
        p.on("dialog", (d) => d.accept().catch(() => {}));
        await p.goto(server.origin + "/qa-evidence/sco/launch.html");
        const ui = p.frameLocator("iframe"),
          button = (n) => ui.getByRole("button", { name: n, exact: true });
        await expect(button("ESA")).toBeVisible();
        await p.screenshot({
          path: join(out, name + "-" + w + "x" + h + "-Start.png"),
        });
        await button("ESA").click();
        await ui
          .getByLabel(/Gruppenname|Teamname oder Vornamen/)
          .first()
          .fill("Gruppe Wiese");
        await button("Beginnen").click();
        const board = ui.locator("svg.board");
        const frame = () =>
          p.frames().find((f) => f.url().endsWith("/app.html"));
        const warns = () =>
          frame().evaluate(
            () =>
              !window.dispatchEvent(
                new Event("beforeunload", { cancelable: true }),
              ),
          );
        await releaseOnly(ui, 1, { dx: 32, dy: 12 });
        await expect(ui.locator(".recovery-status")).toContainText(
          "Automatisch gespeichert",
        );
        const warned = await warns();
        assert.equal(warned, old);
        const pos = await cardPosition(ui, 1);
        const z = () => board.getAttribute("data-zoom");
        const initial = await z();
        await board.dispatchEvent("wheel", {
          deltaY: -240,
          clientX: 300,
          clientY: 300,
        });
        await expect.poll(z).not.toEqual(initial);
        const zoom = await z();
        const savedZoom = () =>
          frame().evaluate(() => {
            const k = Object.keys(sessionStorage).find((k) =>
              k.startsWith("mysteryboard.028.["),
            );
            return JSON.parse(sessionStorage.getItem(k)).view?.z;
          });
        if (!old) await expect.poll(savedZoom).toBe(Number(zoom));
        else await p.waitForTimeout(400);
        const stored = await savedZoom();
        await p.reload();
        await expect(board).toBeVisible();
        assert.deepEqual(await cardPosition(ui, 1), pos);
        const restored = await z();
        if (old) assert.notEqual(restored, zoom);
        else assert.equal(restored, zoom);
        await p.screenshot({
          path: join(out, name + "-" + w + "x" + h + "-Pinnwand.png"),
        });
        await ui.locator('[data-card="1"]').press("Enter");
        await button("Text bearbeiten").click();
        await ui
          .getByLabel("Kartentext", { exact: true })
          .fill("Ein noch offener Entwurf.");
        await expect(ui.locator(".recovery-status")).toContainText(
          "Automatisch gespeichert",
        );
        assert.equal(await warns(), old);
        await p.reload();
        await expect(ui.getByLabel("Kartentext", { exact: true })).toHaveValue(
          "Ein noch offener Entwurf.",
        );
        await button("Änderungen übernehmen").click();
        await button("Schließen").click();
        const box = await board.boundingBox();
        assert.equal(
          await frame().evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await button("Export").click();
        await expect(
          ui.getByRole("link", {
            name: old ? "Sicherungsbild herunterladen" : "PNG herunterladen",
          }),
        ).toBeVisible({ timeout: 60000 });
        await p.screenshot({
          path: join(out, name + "-" + w + "x" + h + "-Export.png"),
        });
        await button("Schließen").click();
        await button("Menü").click();
        await button(
          old ? "Zur Startansicht" : "Neue Gruppenarbeit beginnen",
        ).click();
        await expect(button("ESA")).toBeVisible();
        await p.reload();
        if (old) await expect(board).toBeVisible();
        else {
          await expect(button("ESA")).toBeVisible();
          await button("ESA").click();
          await expect(ui.getByLabel("Gruppenname")).toHaveValue("");
        }
        result.push({
          previousGroupReopenedAfterHome: old,
          engine: name,
          version: b.version(),
          viewport: [w, h],
          board: box,
          warnedAfterSave: warned,
          initialZoom: initial,
          zoom,
          stored,
          restored,
        });
        await p.close();
      }
    } finally {
      await b.close();
    }
  }
  await writeFile(
    join(out, "Messwerte-" + phase + ".json"),
    JSON.stringify(result, null, 2),
  );
} finally {
  server.close();
}
