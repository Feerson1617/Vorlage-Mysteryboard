import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
import { createHash } from "node:crypto";
import { inflateSync, deflateSync, crc32 } from "node:zlib";
import { releaseOnly } from "./student-release.mjs";
// Independently encode a valid backup for a different version of this exact task.
function priorVersion(bytes) {
  const canonical = (v) =>
    Array.isArray(v)
      ? "[" + v.map(canonical).join(",") + "]"
      : v && typeof v === "object"
        ? "{" +
          Object.keys(v)
            .sort()
            .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
            .join(",") +
          "}"
        : JSON.stringify(v);
  const hash = (b) => createHash("sha256").update(b).digest();
  for (let p = 8; p + 12 <= bytes.length;) {
    const n = bytes.readUInt32BE(p),
      end = p + 12 + n;
    if (bytes.toString("ascii", p + 4, p + 8) === "mySt") {
      const doc = JSON.parse(inflateSync(bytes.subarray(p + 48, p + 8 + n)));
      doc.work.version = doc.content.version = "0.0.1";
      doc.contentHash = hash(canonical(doc.content)).toString("hex");
      const raw = Buffer.from(canonical(doc)),
        header = Buffer.from(bytes.subarray(p + 8, p + 48));
      header.writeUInt32BE(raw.length, 4);
      hash(raw).copy(header, 8);
      const body = Buffer.concat([
          Buffer.from("mySt"),
          header,
          deflateSync(raw),
        ]),
        size = Buffer.alloc(4),
        crc = Buffer.alloc(4);
      size.writeUInt32BE(body.length - 4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([
        bytes.subarray(0, p),
        size,
        body,
        crc,
        bytes.subarray(end),
      ]);
    }
    p = end;
  }
  throw Error("Sicherungsblock fehlt");
}
const persistent = (frame) =>
  frame.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("MysteryBoard-Unterricht", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("work"),
            read = tx.objectStore("work").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
const [folder, destination, phase] = process.argv.slice(2),
  old = phase === "before";
const out = resolve(destination),
  archive = unzipSync(await readFile(join(folder, "Wasser-SCORM.zip")));
await mkdir(join(out, "sco"), { recursive: true });
for (const [k, v] of Object.entries(archive)) {
  assert(!k.includes("/"));
  await writeFile(join(out, "sco", k), v);
}
const server = await host(out),
  url = server.origin + "/qa-evidence/sco/launch.html",
  results = [];
try {
  for (const [name, type, path] of [
    ["Chromium", chromium, process.env.CHROMIUM_PATH],
    ["WebKit", webkit, process.env.WEBKIT_PATH],
  ]) {
    const browser = await type.launch({ executablePath: path || undefined });
    try {
      for (const [level, title] of [
        ["ESA", "Wasser Wege"],
        ["AHR", "Wasser im Einzugsgebiet"],
      ]) {
        const page = await browser.newPage({
          viewport: { width: 1024, height: 768 },
        });
        page.on("dialog", (d) => d.accept().catch(() => {}));
        await page.goto(url);
        const ui = page.frameLocator("iframe"),
          button = (n) => ui.getByRole("button", { name: n, exact: true });
        const frame = () =>
          page.frames().find((f) => f.url().endsWith("/app.html"));
        const stored = () =>
          frame().evaluate(() =>
            Object.keys(sessionStorage)
              .filter((k) => k.startsWith("mysteryboard.028.["))
              .map((k) => JSON.parse(sessionStorage[k])),
          );
        const row = async () => (await stored())[0];
        const pick = async (file) => {
          await button("Menü").click();
          await button("Original-PNG öffnen").click();
          await ui.getByLabel("Schüler-Sicherung").setInputFiles(file);
        };
        const card = ui.locator('[data-card="1"]'),
          png = join(folder, "Gruppe 3_" + title + ".png");
        await button(level).click();
        await ui.getByLabel("Gruppenname", { exact: true }).fill("Team Birke");
        await button("Beginnen").click();
        await card.press("Enter");
        await button("Text bearbeiten").click();
        await ui
          .getByLabel("Kartentext", { exact: true })
          .fill("Neuer Befund aus unserer Gruppe.");
        await button("Änderungen übernehmen").click();
        await button("Schließen").click();
        await expect(ui.locator(".recovery-status")).toContainText(
          "Automatisch gespeichert",
        );
        const prior = await row();
        const additional = [];
        if (!old) {
          const reject = async (file, message) => {
            const before = await stored();
            await pick(file);
            await expect(ui.getByRole("alert")).toContainText(message);
            await button("Schließen").click();
            assert.deepEqual(await stored(), before);
            await expect(card).toContainText("Neuer Befund");
          };
          await reject(
            {
              name: "Defekt.png",
              mimeType: "image/png",
              buffer: Buffer.from([137, 80, 78, 71]),
            },
            /PNG|Datei|Format|Signatur/i,
          );
          additional.push("Beschädigte PNG");
          await reject(
            {
              name: "Alte Version.png",
              mimeType: "image/png",
              buffer: priorVersion(await readFile(png)),
            },
            /anderen Aufgabe oder Inhaltsversion/,
          );
          additional.push("Abweichende Inhaltsversion");
          if (process.argv[5]) {
            await reject(
              process.argv[5],
              /anderen Aufgabe oder Inhaltsversion/,
            );
            additional.push("Fremde Aufgabe");
          }
          if (level === "ESA") {
            const catalogue = await frame()
              .locator("#mysteryboard-levels")
              .textContent()
              .then(JSON.parse);
            const other = catalogue.levels.find((l) => l.name === "AHR"),
              otherPNG = join(folder, "Gruppe 3_Wasser im Einzugsgebiet.png");
            const pattern = "**/level-" + other.id + ".json";
            await page.route(pattern, (r) =>
              r.fulfill({ status: 404, body: "" }),
            );
            await reject(otherPNG, /Aufgabendatei fehlt/);
            await page.unroute(pattern);
            await pick(otherPNG);
            await expect(
              ui.getByRole("dialog", { name: "Arbeitsstand ersetzen?" }),
            ).toContainText("AHR");
            await button("Bisherige Arbeit behalten").click();
            assert.deepEqual(await row(), prior);
            additional.push(
              "Fehlende Zielaufgabe",
              "Niveauwechsel abgebrochen",
            );
          }
        }
        await pick(png);
        if (!old) {
          await expect(
            ui.getByRole("dialog", { name: "Arbeitsstand ersetzen?" }),
          ).toContainText("Team Birke");
          await button("Bisherige Arbeit behalten").click();
          assert.deepEqual((await row()).work, prior.work);
          await page.reload();
          await expect(card).toContainText("Neuer Befund");
          if (level === "AHR") {
            await frame().evaluate(() => {
              const desc = Object.getOwnPropertyDescriptor(
                IDBTransaction.prototype,
                "oncomplete",
              );
              window.held = [];
              Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
                ...desc,
                set(fn) {
                  desc.set.call(this, function (e) {
                    if (this.mode === "readwrite")
                      window.held.push(() => fn.call(this, e));
                    else fn.call(this, e);
                  });
                },
              });
              window.resumeCompletions = () => {
                Object.defineProperty(
                  IDBTransaction.prototype,
                  "oncomplete",
                  desc,
                );
                for (const cb of window.held.splice(0).reverse()) cb();
              };
            });
            await releaseOnly(ui, 1, { dx: 29, dy: 6 });
            await expect
              .poll(() => frame().evaluate(() => window.held.length))
              .toBeGreaterThan(0);
          }
          await pick(png);
          await button("Ausgewählte PNG öffnen").click();
        }
        await expect.poll(async () => (await row()).work.team).toBe("Gruppe 3");
        const imported = (await row()).work;
        assert.notDeepEqual(imported.textEdits, prior.work.textEdits);
        if (!old) {
          if (level === "AHR") {
            await frame().evaluate(() => window.resumeCompletions());
            await expect
              .poll(
                async () =>
                  (await persistent(frame())).find(
                    (r) => r.session === prior.session,
                  )?.work,
              )
              .toEqual(imported);
            additional.push("Vertauschte Schreibbestätigungen und IndexedDB");
          }
          await pick(png);
          await expect(ui.getByRole("dialog")).toHaveCount(0);
          await page.reload();
          await expect(card).toBeVisible();
          assert.deepEqual((await row()).work, imported);
          if (level === "ESA") {
            await pick(join(folder, "Gruppe 3_Wasser im Einzugsgebiet.png"));
            await button("Ausgewählte PNG öffnen").click();
            await expect(ui.locator("[data-card]")).toHaveCount(5);
            await page.reload();
            await expect(ui.locator("[data-card]")).toHaveCount(5);
            const all = await stored();
            assert.equal(all.length, 2);
            assert.deepEqual(
              all.find((r) => r.level === prior.level).work,
              imported,
            );
            additional.push("Bestätigter Niveauwechsel und Reload");
          }
        }
        results.push({
          name,
          engine: browser.version(),
          level,
          prior: prior.work.team,
          opened: imported.team,
          confirmation: !old,
          additional,
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(join(out, phase + ".json"), JSON.stringify(results, null, 2));
} finally {
  server.close();
}
