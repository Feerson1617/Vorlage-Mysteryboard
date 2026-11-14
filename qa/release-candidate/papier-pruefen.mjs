// Independent black-box QA. No application source or application codec is imported.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";
import { unzipSync } from "fflate";
const root = resolve(process.argv[2] || ".."),
  output = join(root, "browserpruefung", "ergebnisse", "papier");
await mkdir(output, { recursive: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = unzipSync(
  await readFile(join(root, "MysteryBoard-Universal-SCORM-1.2.zip")),
);
assert.deepEqual(Object.keys(files).sort(), [
  "app.html",
  "imsmanifest.xml",
  "launch.html",
  "session.js",
]);
assert.equal(
  sha(files["app.html"]),
  sha(await readFile(join(root, "MysteryBoard-Universal.html"))),
);
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/__scorm/")) {
      const data = files[pathname.slice(9)];
      assert(data);
      res.setHeader(
        "Content-Type",
        pathname.endsWith(".js") ? "text/javascript" : "text/html",
      );
      res.end(data);
      return;
    }
    const path = resolve(root, "." + pathname);
    assert(!relative(root, path).startsWith(".."));
    const data = await readFile(path);
    res.setHeader(
      "Content-Type",
      extname(path) === ".html"
        ? "text/html"
        : extname(path) === ".js"
          ? "text/javascript"
          : "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Nicht gefunden");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
function pngDocument(bytes) {
  assert(bytes.length <= 30_000_000);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  let payload,
    count = 0;
  for (let pos = 8; pos < bytes.length;) {
    const len = bytes.readUInt32BE(pos),
      end = pos + len + 12;
    assert(end <= bytes.length);
    const tag = bytes.subarray(pos + 4, pos + 8).toString();
    if (tag === "mySt") {
      payload = bytes.subarray(pos + 8, end - 4);
      count++;
    }
    pos = end;
  }
  assert.equal(count, 1);
  assert.equal(payload.subarray(0, 4).toString("hex"), "4d425803");
  const size = payload.readUInt32BE(4);
  assert(size <= 20_000_000);
  const raw = inflateSync(payload.subarray(40), {
    maxOutputLength: 20_000_000,
  });
  assert.equal(raw.length, size);
  assert.equal(sha(raw), payload.subarray(8, 40).toString("hex"));
  return JSON.parse(raw.toString());
}
const report = {
  status: "running",
  applicationSha256: sha(files["app.html"]),
  checks: [],
  screenshots: [],
  scormCalls: [],
};
let browser;
const btn = (ui, name) => ui.getByRole("button", { name, exact: true });
async function app(mode, viewport = { width: 1024, height: 768 }) {
  const context = await browser.newContext({
      hasTouch: true,
      viewport,
    }),
    page = await context.newPage(),
    requests = [];
  const postLoadRequests = [];
  let offline = false;
  page.setDefaultTimeout(20000);
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(origin + "/"))
      requests.push(r.url());
    if (
      offline &&
      /^https?:/.test(r.url()) &&
      !(
        new URL(r.url()).pathname === "/favicon.ico" &&
        !new URL(r.url()).search &&
        r.method() === "GET"
      )
    )
      postLoadRequests.push(r.url());
  });
  if (mode === "scorm")
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const calls = [];
      window.__reviewCalls = calls;
      window.API = Object.fromEntries(
        [
          "LMSInitialize",
          "LMSFinish",
          "LMSGetValue",
          "LMSSetValue",
          "LMSCommit",
        ].map((n) => [
          n,
          (...args) => {
            calls.push([n, ...args]);
            return "true";
          },
        ]),
      );
    });
  await page.goto(
    origin +
      (mode === "scorm"
        ? "/__scorm/launch.html"
        : "/MysteryBoard-Universal.html"),
  );
  const ui =
    mode === "scorm"
      ? (await page
          .frameLocator("iframe")
          .getByRole("button", { name: "Mystery bearbeiten", exact: true })
          .waitFor(),
        page.frames().find((f) => f.url().endsWith("/app.html")))
      : page;
  await btn(ui, "Mystery bearbeiten").waitFor();
  await context.setOffline(true);
  offline = true;
  return {
    context,
    page,
    ui,
    async finish() {
      assert.deepEqual(requests, []);
      assert.deepEqual(postLoadRequests, []);
      assert.deepEqual(
        await ui.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      if (mode === "scorm") {
        assert.deepEqual(await page.evaluate(() => window.__reviewCalls), [
          ["LMSInitialize", ""],
        ]);
        await page.evaluate(() =>
          window.dispatchEvent(
            new PageTransitionEvent("pagehide", { persisted: false }),
          ),
        );
        const calls = await page.evaluate(() => window.__reviewCalls);
        assert.deepEqual(calls, [
          ["LMSInitialize", ""],
          ["LMSFinish", ""],
        ]);
        report.scormCalls.push(calls);
      }
      await context.close();
    },
  };
}
async function load(a, bytes, name = "datei.mysteryboard", menu = false) {
  if (menu) {
    await btn(a.ui, "Menü").tap();
    await btn(a.ui, "Fortsetzen").tap();
  } else await btn(a.ui, "Mystery bearbeiten").tap();
  await a.ui.getByLabel("Mystery-Datei", { exact: true }).setInputFiles({
    name,
    mimeType: name.endsWith(".png") ? "image/png" : "application/json",
    buffer: bytes,
  });
}
async function download(a, name, link = "Datei herunterladen") {
  const pending = a.page.waitForEvent("download");
  await a.ui.getByRole("link", { name: link, exact: true }).tap();
  const file = await pending;
  await file.saveAs(join(output, name));
  const bytes = await readFile(join(output, name));
  await btn(a.ui, "Schließen").tap();
  return {
    bytes,
    filename: file.suggestedFilename(),
    doc: name.endsWith(".png")
      ? pngDocument(bytes)
      : JSON.parse(bytes.toString()),
  };
}
async function project(a, name) {
  await btn(a.ui, "Menü").tap();
  await btn(a.ui, "Projektdatei sichern").tap();
  return download(a, name + ".mysteryboard");
}
async function screenshot(a, name) {
  await a.page.screenshot({ path: join(output, name), fullPage: true });
  report.screenshots.push(name);
}
async function connection(a, from, to, label) {
  await a.ui.locator(`[data-number="${from}"]`).tap();
  await btn(a.ui, "Mit einer Karte verbinden").tap();
  await a.ui.locator(`[data-number="${to}"]`).tap();
  await a.ui
    .getByRole("textbox", { name: "Beschriftung (freiwillig)", exact: true })
    .fill(label);
  await btn(a.ui, "Übernehmen").tap();
}
async function touch(a) {
  const session = await a.context.newCDPSession(a.page),
    board = a.ui.locator("svg.board"),
    b = await board.boundingBox(),
    z = Number(await board.getAttribute("data-zoom"));
  const point = (id, x, y) => ({ id, x, y });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      point(1, b.x + b.width / 2 - 40, b.y + b.height / 2),
      point(2, b.x + b.width / 2 + 40, b.y + b.height / 2),
    ],
  });
  for (let i = 1; i <= 4; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        point(1, b.x + b.width / 2 - 40 - i * 10, b.y + b.height / 2),
        point(2, b.x + b.width / 2 + 40 + i * 10, b.y + b.height / 2),
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert(Number(await board.getAttribute("data-zoom")) > z * 1.3);
  await btn(a.ui, "Übersicht").tap();
  await a.ui.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  const card = a.ui.locator('[data-card="1"]'),
    c = await card.boundingBox(),
    old = await card.getAttribute("data-x");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(1, c.x + c.width / 2, c.y + c.height / 2)],
  });
  for (let i = 1; i <= 4; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        point(1, c.x + c.width / 2 + i * 6, c.y + c.height / 2 + i * 3),
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(await card.getAttribute("data-x"), old);
  // CDP's acknowledgement can precede Chromium's final pointer/capture events.
  // Observe settled frames before starting a separate real button gesture.
  await a.ui.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await session.detach();
}
try {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  report.browserVersion = browser.version();
  report.foreignAiTrial = "OPEN — no independent external AI was run";
  const baseBytes = await readFile(
    join(root, "papierprobe/Parkteich-Aufgabe-v1.mysteryboard"),
  );
  const original = JSON.parse(baseBytes.toString());
  const expected = JSON.parse(
    await readFile(
      join(root, "papierprobe/ERWARTETE-INHALTSSTRUKTUR.json"),
      "utf8",
    ),
  );
  assert.equal(original.content.cards.length, 10);
  for (const c of original.content.cards) {
    const e = expected.cards.find((x) => x.id === c.id);
    for (const key of ["title", "text", "source", "group"])
      assert.equal(c[key], e[key]);
    if (e.table) assert.deepEqual(c.table, e.table);
    if (e.imageSha256)
      assert.equal(
        sha(Buffer.from(c.image.split(",")[1], "base64")),
        e.imageSha256,
      );
  }
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 600, height: 800 },
    { width: 320, height: 700 },
  ]) {
    const key = `papier-${viewport.width}x${viewport.height}`;
    const author = await app("html", viewport);
    await load(author, baseBytes);
    await author.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Papierprobe original");
    await btn(author.ui, "Beginnen").tap();
    for (const c of original.content.cards) {
      await author.ui.locator(`[data-number="${c.id}"]`).tap();
      await author.ui
        .getByRole("heading", { name: c.title, exact: true })
        .waitFor();
      assert.equal(
        await author.ui.locator(".reading > p").first().textContent(),
        c.text,
      );
      assert.equal(
        await author.ui.locator(".reading > p.small").textContent(),
        "Quelle: " + c.source,
      );
      if (c.table) {
        assert.deepEqual(
          await author.ui.locator(".reading th").allTextContents(),
          c.table.headers,
        );
        assert.deepEqual(
          await author.ui
            .locator(".reading tbody tr")
            .evaluateAll((rs) =>
              rs.map((r) =>
                [...r.querySelectorAll("td")].map((c) => c.textContent),
              ),
            ),
          c.table.rows,
        );
      }
      if (c.image) {
        assert.equal(
          await author.ui.locator(".media-view > img").getAttribute("src"),
          c.image,
        );
        await btn(author.ui, "Bild vergrößern").tap();
        await author.ui
          .getByRole("slider", { name: "Bildvergrößerung", exact: true })
          .press("End");
        assert.equal(
          await author.ui
            .getByRole("slider", { name: "Bildvergrößerung", exact: true })
            .inputValue(),
          "4",
        );
        const width = await author.ui
          .locator(".media-scroll img")
          .evaluate((e) => e.getBoundingClientRect().width);
        assert((width / 900) * 21 >= 14);
        await screenshot(author, `${key}-diagramm-lesefenster.png`);
        const enlarged = author.ui.getByLabel("Vergrößertes Bild", {
          exact: true,
        });
        await enlarged.scrollIntoViewIfNeeded();
        await enlarged.press("End");
        for (let i = 0; i < 60; i++) await enlarged.press("ArrowRight");
        await author.ui.waitForFunction(() => {
          const e = document.querySelector(".media-scroll");
          return (
            e.scrollLeft >= e.scrollWidth - e.clientWidth - 2 &&
            e.scrollTop >= e.scrollHeight - e.clientHeight - 2
          );
        });
        await screenshot(author, `${key}-diagramm-rechts-unten.png`);
      }
      await btn(author.ui, "Schließen").tap();
    }
    await connection(author, 1, 2, "Originalbeobachtungen");
    await btn(author.ui, "Menü").tap();
    await btn(author.ui, "Kleineres Sicherungsbild").tap();
    const old = await download(
      author,
      `${key}-alte-schuelerarbeit.png`,
      "Sicherungsbild herunterladen",
    );
    assert.deepEqual(old.doc.content, original.content);
    await btn(author.ui, "Menü").tap();
    author.page.once("dialog", (d) => d.accept());
    await btn(author.ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
    await author.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("RC");
    await btn(author.ui, "Lehrkräftemodus öffnen").tap();
    await btn(author.ui, "Karte hinzufügen").tap();
    await author.ui
      .getByLabel("Kartenüberschrift", { exact: true })
      .fill("Zusätzliche Prüfbeobachtung");
    await author.ui
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(
        "Eine spätere Prüfung soll mehrere Messorte vergleichen. Dies ist eine Ergänzung der zweiten Fassung.",
      );
    await btn(author.ui, "Karte übernehmen").tap();
    author.page.once("dialog", (d) => d.accept());
    await btn(author.ui, "Karte 2 löschen").tap();
    await btn(author.ui, "Karte 1 bearbeiten").tap();
    const revisedText =
      original.content.cards[0].text +
      " Ergänzung: Eine spätere Untersuchung wird gesondert dokumentiert.";
    await author.ui
      .getByRole("textbox", { name: "Kartentext", exact: true })
      .fill(revisedText);
    await btn(author.ui, "Karte übernehmen").tap();
    await btn(author.ui, "Karte 4 bearbeiten").tap();
    await author.ui
      .getByLabel("Bild oder Diagramm (PNG, JPEG, WebP)", { exact: true })
      .setInputFiles(join(root, "papierprobe/oxygen-alternative.png"));
    await author.ui
      .getByLabel("Bildbeschreibung (optional)", { exact: true })
      .fill(
        "Überarbeitete Darstellung derselben synthetischen Sauerstoffwerte.",
      );
    await btn(author.ui, "Karte übernehmen").tap();
    await btn(author.ui, "Hilfen bearbeiten").tap();
    await author.ui
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .fill(
        "Unterscheidet dokumentierte Beobachtungen und noch ungeprüfte Vermutungen.",
      );
    await author.ui
      .getByRole("checkbox", {
        name: "Kartennummern als Hilfe markieren",
        exact: true,
      })
      .check();
    await author.ui
      .getByRole("combobox", { name: "Gruppen auswählen", exact: true })
      .selectOption("causes");
    for (const [id, g] of [
      ["1", "group1"],
      ["4", "group2"],
      ["V9", "group3"],
    ])
      await author.ui
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .selectOption(g);
    await author.ui
      .getByRole("searchbox", {
        name: "Karten suchen (Nummer oder Titel)",
        exact: true,
      })
      .fill("V9");
    assert.equal(
      await author.ui.locator(".help-card-assignments li").count(),
      1,
    );
    await btn(author.ui, "Suche zurücksetzen").tap();
    await btn(author.ui, "Mehrere Karten gemeinsam zuordnen").tap();
    await author.ui
      .getByRole("combobox", { name: "Gemeinsame Farbgruppe", exact: true })
      .selectOption("group2");
    for (const id of [3, 4])
      await author.ui
        .getByRole("checkbox", {
          name: `Karte ${id} gemeinsam zuordnen`,
          exact: true,
        })
        .check();
    await btn(author.ui, "Ausgewählte Karten zuordnen").tap();
    await btn(author.ui, "Mehrfachzuordnung schließen").tap();
    await screenshot(author, `${key}-hilfen.png`);
    await btn(author.ui, "Hilfe übernehmen").tap();
    await btn(author.ui, "Entwurf sichern").tap();
    const draft = await download(author, `${key}-entwurf-v2.mysteryboard`);
    assert(
      draft.filename.startsWith(
        "MysteryBoard-Entwurf-Ein-Montagmorgen-am-Parkteich-v1.",
      ),
    );
    assert.equal(draft.doc.content.cards.length, 10);
    assert.equal(draft.doc.content.cards[0].text, revisedText);
    assert.deepEqual(
      draft.doc.content.cards[2].table,
      original.content.cards[3].table,
    );
    assert.notEqual(
      draft.doc.content.cards[3].image,
      original.content.cards[4].image,
    );
    assert.deepEqual(
      draft.doc.content.help.categories.map((g) => g.cardIds),
      [[1], [3, 4], [9]],
    );
    assert.deepEqual(draft.doc.content.initial.edges, []);
    await author.finish();
    const reopened = await app("html", viewport);
    await load(reopened, draft.bytes);
    await btn(reopened.ui, "Schülerversion erstellen").tap();
    const revised = await download(reopened, `${key}-aufgabe-v2.mysteryboard`);
    assert(
      revised.filename.startsWith(
        "MysteryBoard-Aufgabe-Ein-Montagmorgen-am-Parkteich-v1.",
      ),
    );
    assert.deepEqual(revised.doc.content, draft.doc.content);
    assert.equal(revised.doc.kind, "task");
    assert(!("author" in revised.doc));
    await reopened.finish();
    const pupils = await app("scorm", viewport);
    await load(pupils, revised.bytes);
    await pupils.ui
      .getByLabel("Teamname oder Vornamen", { exact: true })
      .fill("Neue Papiergruppe");
    await btn(pupils.ui, "Beginnen").tap();
    await btn(pupils.ui, "Menü").tap();
    await btn(pupils.ui, "Hilfe").tap();
    await btn(pupils.ui, "Weitere Hilfe anzeigen").tap();
    assert(
      (await pupils.ui.locator("#orientation-legend").textContent()).includes(
        "V9",
      ),
    );
    await btn(pupils.ui, "Hilfe schließen").tap();
    await touch(pupils);
    await connection(pupils, 1, 4, "Messwerte prüfen");
    const work = await project(pupils, `${key}-projekt-v2`);
    await btn(pupils.ui, "Menü").tap();
    await btn(pupils.ui, "Kleineres Sicherungsbild").tap();
    const saved = await download(
      pupils,
      `${key}-schuelerarbeit-v2.png`,
      "Sicherungsbild herunterladen",
    );
    assert.deepEqual(saved.doc, work.doc);
    await screenshot(pupils, `${key}-scorm-v2.png`);
    await pupils.finish();
    const fresh = await app("scorm", viewport);
    await load(fresh, saved.bytes, "neu.png");
    assert.deepEqual(
      (await project(fresh, `${key}-restauriert-v2`)).doc,
      work.doc,
    );
    await load(fresh, old.bytes, "alt.png", true);
    assert.deepEqual(
      (await project(fresh, `${key}-alte-fassung-unvermischt`)).doc,
      old.doc,
    );
    await fresh.finish();
    report.checks.push(
      `${key}: alle Originalfelder/Medien gelesen, Karte hinzugefügt/gelöscht, Text/Diagramm/Hilfen geändert, neuer Entwurf und Aufgabe, SCORM mit Touch/Pinch, echte PNG frisch restauriert, alte Fassung unvermischt.`,
    );
  }
  assert.equal(
    sha(
      await readFile(
        join(root, "papierprobe/Parkteich-Aufgabe-v1.mysteryboard"),
      ),
    ),
    sha(baseBytes),
  );
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    join(output, "ERGEBNIS.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
