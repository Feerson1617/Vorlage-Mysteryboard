import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { chromium, webkit, expect } from "@playwright/test";
import { host } from "./web-host.mjs";
import { button } from "./controls.mjs";
import { releaseOnly, cardPosition } from "./student-release.mjs";

const out = resolve(process.argv[2]);
const server = await host(out);
const url = server.origin + "/qa-evidence/sco/launch.html";
const catalogueHtml = await readFile(join(out, "sco/app.html"), "utf8");
const tag =
  /(<script id="mysteryboard-levels" type="application\/json">)([^<]+)(<\/script>)/;
const catalogue = JSON.parse(catalogueHtml.match(tag)[2]);
const viewport = { width: 768, height: 1024 };
const view = (page) => page.frameLocator("iframe");
const frame = (page) =>
  page.frames().find((f) => f.url().endsWith("/app.html"));
const board = (page) => view(page).locator("[data-card]");
const status = (page) => view(page).locator(".recovery-status");
const label = "Doppelgruppe";
const mainLevel = catalogue.levels[0];
const extended = catalogue.levels.find((l) => l.mode === "extended");
async function open(c) {
  const page = await c.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(url);
  return page;
}
async function start(page, l) {
  await button(view(page), l.name).click();
  await view(page)
    .getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/)
    .fill(label);
  await button(view(page), "Beginnen").click();
  await expect(board(page).first()).toBeVisible();
}
async function stored(page, expire = false) {
  return frame(page).evaluate(
    (expire) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("MysteryBoard-Unterricht");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("work", expire ? "readwrite" : "readonly");
          const s = tx.objectStore("work"),
            read = s.getAll();
          let rows;
          read.onsuccess = () => {
            rows = read.result;
            if (expire)
              for (const r of rows)
                s.put({ ...r, time: Date.now() - 4 * 3600000 });
          };
          tx.oncomplete = () => {
            db.close();
            resolve(rows);
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    expire,
  );
}
const canonical = (v) =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? "[" + v.map(canonical).join(",") + "]"
      : "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
    : JSON.stringify(v);
async function variant(page, recovery, version, other, count) {
  const l = { ...mainLevel };
  const filename = "level-" + l.id + ".json";
  const doc = JSON.parse(await readFile(join(out, "sco", filename), "utf8"));
  const id = other || catalogue.id;
  Object.assign(doc.content, { recovery, version, id: id + "." + l.id });
  if (count) {
    doc.content.instructions =
      "Vergleicht die Messpunkte und begründet die Verbindung.";
    doc.content.cards = Array.from({ length: count }, (_, i) => ({
      ...doc.content.cards[0],
      id: i + 1,
      title: "Messpunkt " + (i + 1),
    }));
    doc.content.initial.cards = doc.content.cards.map((card, i) => ({
      id: card.id,
      x: (i % 10) * 480,
      y: Math.floor(i / 10) * 300,
      color: 0,
    }));
  }
  doc.contentHash = createHash("sha256")
    .update(canonical(doc.content))
    .digest("hex");
  Object.assign(l, { mode: recovery, version, hash: doc.contentHash });
  const html = catalogueHtml.replace(
    tag,
    (_, a, b, c) =>
      a +
      JSON.stringify({
        ...catalogue,
        id,
        levels: [l, ...catalogue.levels.slice(1, 2)],
      }) +
      c,
  );
  await page.route("**/app.html", (r) =>
    r.fulfill({ body: html, contentType: "text/html" }),
  );
  await page.route("**/" + filename, (r) => r.fulfill({ json: doc }));
}
async function test(engine, name) {
  const evidence = { engine: engine.version(), scenarios: [] };
  const run = async (title, fn) => {
    const c = await engine.newContext({ viewport, hasTouch: true });
    try {
      await fn(c);
      evidence.scenarios.push(title);
    } finally {
      await c.close();
    }
  };
  await run(
    "Zwei parallele gleichnamige Gruppen, explizite Auswahl, Ablauf und Löschung",
    async (c) => {
      const a = await open(c),
        b = await open(c);
      await start(a, extended);
      await start(b, extended);
      await releaseOnly(view(a), 1, { dx: 38, dy: 4 });
      await releaseOnly(view(b), 1, { dx: -40, dy: 8 });
      for (const p of [a, b])
        await expect(status(p)).toContainText("Automatisch gespeichert");
      const rows = await stored(a);
      assert.equal(rows.length, 2);
      assert.equal(new Set(rows.map((r) => r.session)).size, 2);
      assert(
        rows.every(
          (r) =>
            r.work.team === label &&
            !("content" in r) &&
            !JSON.stringify(r).includes("data:image/"),
        ),
      );
      const p = await open(c);
      const choices = view(p).getByRole("button", {
        name: /Doppelgruppe · AHR/,
      });
      await expect(choices).toHaveCount(2);
      await expect(board(p)).toHaveCount(0);
      await choices.first().click();
      await expect(board(p)).toHaveCount(5);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      // An explicit second writer forks the selected snapshot.
      assert.equal((await stored(p)).length, 3);
      await button(view(p), "Menü").click();
      await button(view(p), "Lokalen Arbeitsstand löschen").click();
      await expect(board(p)).toHaveCount(0);
      assert.equal((await stored(p)).length, 2);
      await stored(a, true);
      const after = await open(c);
      await expect(button(view(after), extended.name)).toBeVisible();
      await expect(
        view(after).getByRole("button", { name: /Doppelgruppe · AHR/ }),
      ).toHaveCount(0);
      assert.equal((await stored(after)).length, 0);
    },
  );
  await run("Beschädigter Sitzungsstand", async (c) => {
    const p = await open(c);
    await start(p, mainLevel);
    await expect(status(p)).toContainText("Automatisch gespeichert");
    await frame(p).evaluate(() => {
      const key = Object.keys(sessionStorage).find((k) =>
        k.startsWith("mysteryboard.028.["),
      );
      sessionStorage.setItem(key, "beschädigt");
    });
    await p.reload();
    await expect(button(view(p), mainLevel.name)).toBeVisible();
    await expect(board(p)).toHaveCount(0);
  });
  await run(
    "Versionswechsel, unabhängige Aufgabe und freiwilliger Niveauwechsel",
    async (c) => {
      const p = await open(c);
      await start(p, mainLevel);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      await button(view(p), "Menü").click();
      await button(view(p), "Niveau wechseln").click();
      await start(p, catalogue.levels[1]);
      await button(view(p), "Menü").click();
      await button(view(p), "Niveau wechseln").click();
      await button(view(p), mainLevel.name).click();
      await expect(board(p)).toHaveCount(2);
      await variant(p, "session", "7.0.0");
      await p.reload();
      await expect(board(p)).toHaveCount(0);
      await start(p, mainLevel);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      await variant(
        p,
        "session",
        "7.0.0",
        "733503c7-8ac7-4e85-bb39-fb25019da617",
      );
      await p.reload();
      await start(p, mainLevel);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      const sessions = await frame(p).evaluate(() =>
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("mysteryboard.028.["))
          .map((k) => JSON.parse(sessionStorage.getItem(k))),
      );
      assert(
        sessions.some(
          (r) => r.version === "7.0.0" && r.collection === catalogue.id,
        ),
      );
      assert(
        sessions.some(
          (r) => r.collection !== catalogue.id && r.work.team === label,
        ),
      );
    },
  );
  await run("Deaktivierte Speicherung", async (c) => {
    const p = await open(c);
    await variant(p, "off", "7.0.1");
    await p.reload();
    await start(p, mainLevel);
    await releaseOnly(view(p), 1, { dx: 21, dy: 9 });
    assert.equal(
      await frame(p).evaluate(
        () => !dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
      true,
    );
    assert.equal(await frame(p).evaluate(() => sessionStorage.length), 0);
    await expect(status(p)).toHaveCount(0);
    await p.reload();
    await expect(button(view(p), mainLevel.name)).toBeVisible();
    await expect(board(p)).toHaveCount(0);
  });
  for (const blocked of ["session", "idb", "both"])
    await run("Blockierte Speicherstufe " + blocked, async (c) => {
      await c.addInitScript((mode) => {
        if (mode !== "idb") {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) {
            if (this === sessionStorage)
              throw new DOMException("Speicher voll", "QuotaExceededError");
            return original.call(this, k, v);
          };
        }
        if (mode !== "session")
          IDBFactory.prototype.open = function () {
            throw new DOMException("Zugriff blockiert", "SecurityError");
          };
      }, blocked);
      const p = await open(c);
      await start(p, extended);
      const expected =
        blocked === "both"
          ? "Automatische Speicherung nicht verfügbar"
          : blocked === "session"
            ? "Lokal gespeichert"
            : "Nur während der Sitzung gespeichert";
      await expect(status(p)).toContainText(expected);
      await releaseOnly(view(p), 1, { dx: 30, dy: 8 });
      assert.equal(
        await frame(p).evaluate(
          () => !dispatchEvent(new Event("beforeunload", { cancelable: true })),
        ),
        true,
      );
      await button(view(p), "Export").click();
      await expect(
        view(p).getByRole("link", {
          name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/,
        }),
      ).toBeVisible({ timeout: 60000 });
    });
  await run(
    "Neue Gruppenarbeit und Ladefehler mit erneutem Versuch",
    async (c) => {
      const p = await open(c),
        ui = view(p);
      await p.route(
        "**/level-" + mainLevel.id + ".json",
        (r) => r.fulfill({ status: 404 }),
        { times: 1 },
      );
      await button(ui, mainLevel.name).click();
      await expect(ui.getByRole("alert")).toContainText("Aufgabendatei fehlt");
      await start(p, mainLevel);
      await releaseOnly(ui, 1, { dx: 34, dy: 12 });
      await button(ui, "Menü").click();
      await button(ui, "Neue Gruppenarbeit beginnen").click();
      await expect(button(ui, mainLevel.name)).toBeVisible();
      await p.reload();
      await button(ui, mainLevel.name).click();
      await expect(ui.getByLabel("Gruppenname")).toHaveValue("");
      await expect(board(p)).toHaveCount(0);
    },
  );
  await run(
    "Formal intakter Stand mit ungültigen Karten und Ansichtsbereich",
    async (c) => {
      const p = await open(c);
      await start(p, mainLevel);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      for (const defect of ["view", "cards"]) {
        await frame(p).evaluate(async (defect) => {
          const key = Object.keys(sessionStorage).find((k) =>
            k.startsWith("mysteryboard.028.["),
          );
          const { checksum, ...row } = JSON.parse(sessionStorage.getItem(key));
          if (defect === "view")
            row.view = { x: 100000, y: 100000, z: 1, width: 768, height: 1024 };
          else row.work.cards[0].id = 999999;
          const bytes = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(row)),
          );
          sessionStorage.setItem(
            key,
            JSON.stringify({
              ...row,
              checksum: Array.from(new Uint8Array(bytes), (v) =>
                v.toString(16).padStart(2, "0"),
              ).join(""),
            }),
          );
        }, defect);
        await p.reload();
        if (defect === "view") {
          const visible = () =>
            board(p).evaluateAll((cards) =>
              cards.some((e) => {
                const b = e.getBoundingClientRect();
                return (
                  b.right > 0 &&
                  b.left < innerWidth &&
                  b.bottom > 100 &&
                  b.top < innerHeight
                );
              }),
            );
          await expect.poll(visible).toBe(true);
          await p.setViewportSize({ width: 1024, height: 768 });
          await expect.poll(visible).toBe(true);
          await expect(status(p)).toContainText("Automatisch gespeichert");
          await p.waitForTimeout(200);
        } else {
          await expect(view(p).getByRole("alert")).toContainText(
            "konnte nicht gelesen werden",
          );
          await expect(view(p).getByLabel("Gruppenname")).toBeVisible();
        }
      }
    },
  );
  await run(
    "Ausstehender Datenbankabschluss und gleichzeitige Löschung",
    async (c) => {
      await c.addInitScript(() => {
        const prop = Object.getOwnPropertyDescriptor(
          IDBTransaction.prototype,
          "oncomplete",
        );
        Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
          ...prop,
          set(callback) {
            prop.set.call(this, function (event) {
              if (window.deferWrites && this.mode === "readwrite") {
                window.delayedCompletions.push(() =>
                  callback.call(this, event),
                );
              } else callback.call(this, event);
            });
          },
        });
        window.delayedCompletions = [];
      });
      const p = await open(c),
        ui = view(p);
      await start(p, extended);
      await expect(status(p)).toContainText("Automatisch gespeichert");
      const warns = () =>
        frame(p).evaluate(
          () => !dispatchEvent(new Event("beforeunload", { cancelable: true })),
        );
      assert.equal(await warns(), false);
      await frame(p).evaluate(() => {
        window.deferWrites = true;
      });
      await releaseOnly(ui, 1, { dx: 37, dy: 11 });
      await expect
        .poll(() => frame(p).evaluate(() => window.delayedCompletions.length))
        .toBeGreaterThan(0);
      assert.equal(await warns(), true);
      await button(ui, "Menü").click();
      await button(ui, "Lokalen Arbeitsstand löschen").click();
      await releaseOnly(ui, 1, { dx: 24, dy: 7 });
      await frame(p).evaluate(() => {
        window.deferWrites = false;
        for (const finish of window.delayedCompletions.splice(0)) finish();
      });
      await expect(button(ui, extended.name)).toBeVisible();
      assert.deepEqual(await stored(p), []);
      await p.reload();
      await expect(
        ui.getByRole("button", { name: /Doppelgruppe · AHR/ }),
      ).toHaveCount(0);
      assert.equal(
        await frame(p).evaluate(() =>
          Object.keys(sessionStorage).some((k) =>
            k.startsWith("mysteryboard.028.["),
          ),
        ),
        false,
      );
    },
  );
  for (const count of [5, 20, 30, 60, 100])
    await run(
      "Sitzungswiederherstellung mit " + count + " Karten",
      async (c) => {
        const p = await open(c);
        await variant(p, "session", "7.1." + count, undefined, count);
        await p.reload();
        await start(p, mainLevel);
        await expect(board(p)).toHaveCount(count);
        await releaseOnly(view(p), 1, { dx: 15, dy: 10 });
        const pos = await cardPosition(view(p), 1),
          ui = view(p);
        await button(ui, "Aufgabe").click();
        await expect(ui.getByRole("dialog")).toContainText(
          "Vergleicht die Messpunkte",
        );
        await button(ui, "Schließen").click();
        await button(ui, "Hilfe").click();
        await expect(ui.getByRole("dialog", { name: "Hilfe" })).toContainText(
          "Denkimpuls",
        );
        await button(ui, "Hilfe schließen").click();
        const card = (i) => ui.locator('[data-card="' + i + '"]');
        await card(1).press("Enter");
        await button(ui, "Mit einer Karte verbinden").click();
        await card(2).press("Enter");
        await ui.getByLabel(/Beschriftung/).fill("Beobachtung");
        await button(ui, "Übernehmen").click();
        await card(1).press("Enter");
        await button(ui, "Text bearbeiten").click();
        await ui
          .getByLabel("Kartentext", { exact: true })
          .fill("Begründung " + count);
        await button(ui, "Änderungen übernehmen").click();
        await button(ui, "Schließen").click();
        await p.reload();
        await expect(board(p)).toHaveCount(count);
        assert.deepEqual(await cardPosition(view(p), 1), pos);
        await expect(card(1)).toContainText("Begründung " + count);
        await button(ui, "Export").click();
        await expect(
          ui.getByRole("link", { name: "PNG herunterladen" }),
        ).toHaveAttribute("download", /\.png$/, { timeout: 60000 });
      },
    );
  await writeFile(
    join(out, name + "-Speichergrenzen.json"),
    JSON.stringify(evidence, null, 2),
  );
}
async function crashTest() {
  const profile = await mkdtemp(join(tmpdir(), "mb028-crash-"));
  const options = {
    viewport,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  };
  let c = await chromium.launchPersistentContext(profile, options);
  try {
    const page = await open(c);
    await start(page, extended);
    await releaseOnly(view(page), 1, { dx: 46, dy: 9 });
    await expect(status(page)).toContainText("Automatisch gespeichert");
    const position = await cardPosition(view(page), 1);
    const cdp = await c.newCDPSession(page);
    const crashed = page.waitForEvent("crash");
    void cdp.send("Page.crash").catch(() => {});
    await crashed;
    await c.close();
    c = await chromium.launchPersistentContext(profile, options);
    const restarted = await open(c);
    const ui = view(restarted);
    await expect(board(restarted)).toHaveCount(0);
    await ui.getByRole("button", { name: /Doppelgruppe · AHR/ }).click();
    await expect(board(restarted)).toHaveCount(5);
    assert.deepEqual(await cardPosition(ui, 1), position);
    await writeFile(
      join(out, "Chromium-Prozessabbruch.json"),
      JSON.stringify(
        {
          action:
            "CDP Page.crash, Browserprofil neu gestartet, bewusste Gruppenwahl",
          position,
          restored: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await c.close();
  }
}
try {
  for (const [name, type, path] of [
    ["Chromium", chromium, process.env.CHROMIUM_PATH],
    ["WebKit", webkit, process.env.WEBKIT_PATH],
  ]) {
    const browser = await type.launch({ executablePath: path || undefined });
    try {
      await test(browser, name);
    } finally {
      await browser.close();
    }
  }
  await crashTest();
} finally {
  server.close();
}
