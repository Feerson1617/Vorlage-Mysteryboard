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
  output = join(root, "browserpruefung", "ergebnisse");
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
async function app(mode) {
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
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
  const teacher = await app("html");
  await load(
    teacher,
    await readFile(join(root, "beispiele/Hilfe-Lehrkraftentwurf.mysteryboard")),
  );
  await btn(teacher.ui, "Hilfetext festlegen").tap();
  await teacher.ui
    .getByRole("combobox", { name: "Denkimpuls auswählen", exact: true })
    .selectOption("1");
  const method =
    "Prüft eure Erklärung anhand der Karten. Begründet auch unsichere Verbindungen.";
  await teacher.ui
    .getByRole("textbox", { name: "Hilfetext", exact: true })
    .fill(method);
  await teacher.ui
    .getByRole("checkbox", {
      name: "Kartennummern als Hilfe markieren",
      exact: true,
    })
    .check();
  for (let i = 3; i >= 1; i--) {
    await btn(teacher.ui, `Gruppe ${i} entfernen`).tap();
    await btn(teacher.ui, "Gruppe entfernen bestätigen").tap();
  }
  const names = ["Ausgangslage", "Veränderungen", "Beobachtungen"];
  for (let i = 1; i <= 3; i++) {
    await btn(teacher.ui, "Gruppe hinzufügen").tap();
    await teacher.ui
      .getByRole("textbox", { name: `Name Gruppe ${i}`, exact: true })
      .fill(names[i - 1]);
  }
  for (const [id, g] of [
    [1, "group1"],
    [3, "group1"],
    [2, "group2"],
    [4, "group3"],
  ])
    await teacher.ui
      .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
      .selectOption(g);
  assert.equal(
    await teacher.ui
      .getByRole("combobox", { name: "Hilfe für Karte 5", exact: true })
      .inputValue(),
    "",
  );
  await teacher.ui
    .getByRole("checkbox", {
      name: "Kartennummern als Hilfe markieren",
      exact: true,
    })
    .uncheck();
  await teacher.ui
    .getByRole("checkbox", {
      name: "Kartennummern als Hilfe markieren",
      exact: true,
    })
    .check();
  for (const [id, group] of [
    [1, "group1"],
    [3, "group1"],
    [2, "group2"],
    [4, "group3"],
  ])
    assert.equal(
      await teacher.ui
        .getByRole("combobox", { name: `Hilfe für Karte ${id}`, exact: true })
        .inputValue(),
      group,
    );
  await btn(teacher.ui, "Hilfe übernehmen").tap();
  await btn(teacher.ui, "Entwurf sichern").tap();
  const draft = await download(teacher, "unabhaengiger-entwurf.mysteryboard");
  await teacher.finish();
  report.checks.push(
    "Bestehenden Entwurf grafisch bearbeitet, drei Gruppen manuell zugeordnet, weitere Karten unmarkiert, Download und vollständiges Schließen.",
  );
  const reopened = await app("html");
  await load(reopened, draft.bytes);
  await btn(reopened.ui, "Hilfetext festlegen").tap();
  assert.equal(
    await reopened.ui
      .getByRole("textbox", { name: "Hilfetext", exact: true })
      .inputValue(),
    method,
  );
  for (let i = 1; i <= 3; i++)
    assert.equal(
      await reopened.ui
        .getByRole("textbox", { name: `Name Gruppe ${i}`, exact: true })
        .inputValue(),
      names[i - 1],
    );
  await screenshot(reopened, "lehrkraft-hilfe.png");
  await btn(reopened.ui, "Hilfe aus Schülersicht ansehen").tap();
  const preview = reopened.ui.getByRole("dialog", {
    name: "Hilfe aus Schülersicht",
    exact: true,
  });
  assert(
    (
      await preview
        .getByRole("dialog", { name: "Hilfe", exact: true })
        .textContent()
    ).includes(method),
  );
  await btn(preview, "Zurück zu den Hilfen").tap();
  await btn(reopened.ui, "Hilfe übernehmen").tap();
  await btn(reopened.ui, "Schülerversion erstellen").tap();
  const task = await download(
    reopened,
    "unabhaengige-schuelerversion.mysteryboard",
  );
  assert.deepEqual(task.doc.content.help, draft.doc.content.help);
  assert.deepEqual(task.doc.content.initial.edges, []);
  assert(!("author" in task.doc) && !("work" in task.doc));
  await reopened.finish();
  report.checks.push(
    "Frisch geöffnet, Hilfen vollständig verglichen, echte Vorschau, neutrale Schülerversion exportiert.",
  );
  const student = await app("scorm");
  await load(student, task.bytes);
  await student.ui
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Unabhängige Prüfgruppe");
  await btn(student.ui, "Beginnen").tap();
  assert.equal(await student.ui.locator(".learning-help").count(), 0);
  const before = await project(student, "vor-hilfe");
  await btn(student.ui, "Menü").tap();
  await btn(student.ui, "Hilfe").tap();
  assert(
    (
      await student.ui
        .getByRole("dialog", { name: "Hilfe", exact: true })
        .textContent()
    ).includes(method),
  );
  await screenshot(student, "schueler-hilfestufe-1.png");
  await btn(student.ui, "Weitere Hilfe anzeigen").tap();
  for (const g of task.doc.content.help.categories) {
    assert(
      (await student.ui.locator("#orientation-legend").textContent()).includes(
        g.label,
      ),
    );
    for (const id of g.cardIds)
      assert.equal(
        await student.ui
          .locator(`[data-number="${id}"] circle`)
          .getAttribute("fill"),
        g.color,
      );
  }
  await screenshot(student, "schueler-hilfestufe-2.png");
  await btn(student.ui, "Hilfe schließen").tap();
  const during = await project(student, "mit-hilfe");
  assert.deepEqual(during.doc, before.doc);
  await btn(student.ui, "Menü").tap();
  await btn(student.ui, "Hilfe").tap();
  await btn(student.ui, "Orientierung ausblenden").tap();
  await btn(student.ui, "Hilfe schließen").tap();
  await touch(student);
  await connection(student, 1, 2, "Prüfverbindung eins");
  await connection(student, 3, 4, "Prüfverbindung zwei");
  const historyState = await project(student, "vor-undo");
  await btn(student.ui, "Rückgängig").tap();
  const undone = await project(student, "nach-undo");
  assert.equal(undone.doc.work.edges.length, 1);
  await btn(student.ui, "Wiederholen").tap();
  const redone = await project(student, "nach-redo");
  assert.deepEqual(redone.doc, historyState.doc);

  await student.ui.locator('[data-number="4"]').tap();
  await btn(student.ui, "Blau").tap();
  await student.ui
    .getByRole("textbox", {
      name: "Name für diese Farbe (freiwillig)",
      exact: true,
    })
    .fill("Eigene Kategorie");
  await btn(student.ui, "Schließen").tap();
  await btn(student.ui, "Menü").tap();
  await btn(student.ui, "Kleineres Sicherungsbild").tap();
  await student.ui
    .getByRole("link", { name: "Sicherungsbild herunterladen", exact: true })
    .waitFor();
  const png = await download(
    student,
    "unabhaengige-schuelerarbeit.png",
    "Sicherungsbild herunterladen",
  );
  assert.deepEqual(png.doc.content, task.doc.content);
  assert.equal(png.doc.work.team, "Unabhängige Prüfgruppe");
  assert.equal(png.doc.work.edges.length, 2);
  assert.equal(png.doc.work.cards.find((c) => c.id === 4).color, 2);
  assert.equal(png.doc.work.categories[2], "Eigene Kategorie");

  await btn(student.ui, "Menü").tap();
  await btn(student.ui, "Druckfassung / PDF").tap();
  for (const paper of ["a4", "a3"]) {
    await student.ui
      .getByRole("combobox", { name: "Papierformat", exact: true })
      .selectOption(paper);
    await student.ui
      .getByRole("button", { name: "Drucken / PDF speichern", exact: true })
      .waitFor();
    const printButton = student.ui.getByRole("button", {
      name: "Drucken / PDF speichern",
      exact: true,
    });
    const deadline = Date.now() + 30000;
    while (!(await printButton.isEnabled())) {
      assert(Date.now() < deadline, "Druckvorschau nicht rechtzeitig bereit");
      await student.ui.evaluate(
        () => new Promise((r) => requestAnimationFrame(r)),
      );
    }
    const frame = await student.ui
      .locator('iframe[title="Druckvorschau"]')
      .elementHandle()
      .then((h) => h.contentFrame());
    await frame.waitForFunction(
      (expected) =>
        document.documentElement.dataset.printPaper === expected &&
        Number(document.body.dataset.pageCount) > 0,
      paper,
    );
    const printPage = await browser.newPage();
    await printPage.context().setOffline(true);
    await printPage.setContent(await frame.content());
    await printPage.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    const pdf = await printPage.pdf({
      path: join(output, `druck-${paper}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    const dimensions = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(
      pdf.toString("latin1"),
    );
    assert(dimensions, "PDF-Papiergröße fehlt");
    const width = Number(dimensions[1]),
      height = Number(dimensions[2]);
    assert(
      Math.abs(width - (paper === "a4" ? 841.89 : 1190.55)) < 3 &&
        Math.abs(height - (paper === "a4" ? 595.28 : 841.89)) < 3,
      "PDF-Papierformat stimmt nicht",
    );
    (report.pdfPaperDimensions ??= []).push({ paper, width, height });
    await printPage.close();
  }
  await btn(student.ui, "Schließen").tap();
  report.checks.push(
    "Undo/Redo mit vollständigem Zustandsvergleich; echte Chromium-PDF-Dateien für A4 und A3. Kein Nachweis des Safari-Systemdruckdialogs.",
  );
  await student.finish();
  report.checks.push(
    "Tatsächliche SCORM-ZIP, beide Hilfestufen und Farben/Legende, unveränderter Work-Zustand beim Hilfewechsel, Deaktivierung, Touch/Pinch, eigene Farbe/Kategorie, zwei beschriftete Verbindungen und echte PNG.",
  );
  const fresh = await app("scorm");
  await load(fresh, png.bytes, "arbeit.png");
  const restored = await project(fresh, "frisch-wiederhergestellt");
  assert.deepEqual(restored.doc, png.doc);
  await connection(fresh, 5, 6, "Nach Wiederherstellung ergänzt");
  const continued = await project(fresh, "weiterbearbeitet");
  assert.equal(continued.doc.work.edges.length, 3);
  await screenshot(fresh, "wiederhergestellt-und-weiterbearbeitet.png");
  await fresh.finish();
  report.checks.push(
    "Neue SCORM-Sitzung: vollständiger Inhalts-/Arbeitsvergleich und Weiterbearbeitung.",
  );
  const revision = await app("html");
  await load(revision, task.bytes);
  await btn(revision.ui, "Lehrkräftemodus – Mystery bearbeiten").tap();
  await revision.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("AB");
  await btn(revision.ui, "Lehrkräftemodus öffnen").tap();
  await btn(revision.ui, "Karte hinzufügen").tap();
  await revision.ui
    .getByLabel("Kartenüberschrift", { exact: true })
    .fill("Neue Prüfkarte");
  await revision.ui
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .fill("Diese Karte gehört zur neuen Fassung.");
  await btn(revision.ui, "Karte übernehmen").tap();
  revision.page.once("dialog", (d) => d.accept());
  await btn(revision.ui, "Karte 1 löschen").tap();
  await btn(revision.ui, "Hilfetext festlegen").tap();
  await revision.ui
    .getByRole("textbox", { name: "Name Gruppe 1", exact: true })
    .fill("Ausgangslage überarbeitet");
  await btn(revision.ui, "Hilfe übernehmen").tap();
  await btn(revision.ui, "Schülerversion erstellen").tap();
  const updated = await download(
    revision,
    "unabhaengige-revision.mysteryboard",
  );
  assert.notEqual(updated.doc.content.version, task.doc.content.version);
  assert.deepEqual(updated.doc.content.help.categories[0].cardIds, [2]);
  await revision.finish();
  const old = await app("scorm");
  await load(old, updated.bytes);
  await old.ui
    .getByLabel("Teamname oder Vornamen", { exact: true })
    .fill("Neue Fassung");
  await btn(old.ui, "Beginnen").tap();
  await load(old, png.bytes, "alte-arbeit.png", true);
  const restoredOld = await project(old, "alte-fassung-unvermischt");
  assert.deepEqual(restoredOld.doc, png.doc);
  await old.finish();
  report.checks.push(
    "Revision mit neuer/gelöschter Karte und angepassten Hilfen; alte Schülerarbeit danach unvermischt geöffnet.",
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
