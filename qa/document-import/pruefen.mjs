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
  output = join(root, "browserpruefung", "ergebnisse", "dokumentimport");
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
async function printPdf(a, key, paper) {
  await btn(a.ui, "Menü").tap();
  await btn(a.ui, "Druckfassung / PDF").tap();
  await a.ui
    .getByRole("combobox", { name: "Papierformat", exact: true })
    .selectOption(paper);
  await a.ui
    .locator(".print-preview")
    .getByRole("status")
    .filter({ hasText: /\d+ Seiten vorbereitet/ })
    .waitFor({ timeout: 60000 });
  const printFrame = await a.ui
    .locator('iframe[title="Druckvorschau"]')
    .elementHandle();
  const inner = await printFrame.contentFrame();
  const innerHtml = await inner.content();
  assert(innerHtml.includes("<html") && innerHtml.includes("@page"));
  assert(innerHtml.includes(`size: ${paper.toUpperCase()} landscape`));
  const context = await browser.newContext(),
    p = await context.newPage();
  await context.setOffline(true);
  await p.setContent(innerHtml);
  await p.evaluate(async () => {
    await Promise.all([...document.images].map((i) => i.decode()));
    await document.fonts.ready;
  });
  const bytes = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  assert(bytes.subarray(0, 5).toString() === "%PDF-");
  await writeFile(join(output, `${key}-${paper}.pdf`), bytes);
  await context.close();
  await btn(a.ui, "Schließen").tap();
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
const norm = (s) => s.replace(/\s+/g, " ").trim();
async function teacher(a) {
  await btn(a.ui, "Eigenes Mystery erstellen").tap();
  await a.ui.getByLabel("Lehrkraftkürzel", { exact: true }).fill("DI");
  await btn(a.ui, "Lehrkräftemodus öffnen").tap();
}
async function parse(a, name) {
  const pending = a.page.waitForEvent("filechooser");
  await btn(a.ui, "Word- oder PDF-Datei auswählen").tap();
  await (await pending).setFiles(join(root, "dateien", name));
  await a.ui
    .getByRole("heading", { name: "2. Karten prüfen", exact: true })
    .waitFor({ timeout: 45000 });
  await a.ui.waitForFunction(
    () => !document.querySelector(".import-step-body").disabled,
  );
  assert.equal(await a.ui.getByRole("alert").count(), 0);
}
async function choose(a, i) {
  await btn(a.ui, "Karten ansehen").tap();
  await a.ui
    .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
    .selectOption(String(i));
}
async function take(a) {
  await btn(a.ui, "Weiter zur Übernahme").tap();
  await a.ui
    .getByRole("checkbox", {
      name: "Ich habe Texte, Grenzen, Bilder, Tabellen und Pflicht-/Vertiefungskarten mit dem Original geprüft.",
      exact: true,
    })
    .check();
  await btn(a.ui, "Geprüfte Karten übernehmen").tap();
  await btn(a.ui, "Dokument importieren").waitFor();
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
  const original = JSON.parse(
    await readFile(join(root, "dateien/ORIGINAL-INHALTE.json"), "utf8"),
  );
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 600, height: 800 },
    { width: 320, height: 700 },
  ])
    for (const format of ["docx", "pdf"]) {
      const key = `${format}-${viewport.width}x${viewport.height}`,
        a = await app("html", viewport);
      await teacher(a);
      await a.ui
        .getByLabel("Mystery-Titel", { exact: true })
        .fill("Importprobe " + key);
      await btn(a.ui, "Dokument importieren").tap();
      await parse(
        a,
        format === "docx"
          ? "B-Word-Medien-Tabelle.docx"
          : "C-PDF-12-Karten.pdf",
      );
      const source = format === "docx" ? original.B : original.A;
      assert.equal(
        await a.ui
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option")
          .count(),
        source.length,
      );
      for (let i = 0; i < source.length; i++) {
        await choose(a, i);
        assert.equal(
          await a.ui
            .getByRole("textbox", { name: "Überschrift", exact: true })
            .inputValue(),
          source[i].title,
        );
        const body = await a.ui
          .getByRole("textbox", { name: "Kartentext", exact: true })
          .inputValue();
        for (const part of source[i].paragraphs)
          assert(norm(body).includes(norm(part)));
        assert.equal(
          norm(body),
          norm(
            [...source[i].paragraphs, ...(source[i].bullets || [])].join(
              "\n\n",
            ),
          ),
        );
        if (format === "docx" && source[i].image) {
          const src = await a.ui
            .locator(".import-cards .media-view > img")
            .getAttribute("src");
          assert.equal(
            sha(Buffer.from(src.split(",")[1], "base64")),
            sha(await readFile(join(root, "dateien", source[i].image))),
          );
        }
        assert.equal(
          norm(
            await a.ui
              .getByRole("textbox", { name: "Quellenangabe", exact: true })
              .inputValue(),
          ),
          norm(source[i].source),
        );
        assert.equal(
          await a.ui
            .getByRole("combobox", { name: "Import-Kartengruppe", exact: true })
            .inputValue(),
          source[i].extension ? "extension" : "required",
        );
      }
      if (format === "docx") {
        await choose(a, 2);
        for (let r = 0; r < original.table.rows.length; r++)
          for (let c = 0; c < original.table.headers.length; c++)
            assert.equal(
              await a.ui
                .getByRole("textbox", {
                  name: `Zeile ${r + 1}, Spalte ${c + 1}`,
                  exact: true,
                })
                .inputValue(),
              original.table.rows[r][c],
            );
        await a.ui
          .getByRole("textbox", { name: "Zeile 1, Spalte 2", exact: true })
          .fill("13,75");
      }
      await choose(a, 0);
      const text = a.ui.getByRole("textbox", {
        name: "Kartentext",
        exact: true,
      });
      const originalText = await text.inputValue();
      const originalSource = await a.ui
        .getByRole("textbox", { name: "Quellenangabe", exact: true })
        .inputValue();
      await text.press("Control+Home");
      await text.press("Control+ArrowRight");
      await btn(a.ui, "Karte am Textcursor teilen").tap();
      assert.equal(
        await a.ui
          .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
          .locator("option")
          .count(),
        source.length + 1,
      );
      await btn(a.ui, "Mit nächster Karte zusammenfügen").tap();
      assert.equal(await text.inputValue(), originalText);
      assert.equal(
        await a.ui
          .getByRole("textbox", { name: "Quellenangabe", exact: true })
          .inputValue(),
        originalSource,
      );
      await a.ui
        .getByLabel("Bild ersetzen (PNG, JPEG, WebP)", { exact: true })
        .setInputFiles(join(root, "dateien/bild-2.jpeg"));
      await a.ui.waitForFunction(
        () => !document.querySelector(".import-step-body").disabled,
      );
      await btn(a.ui, "Importkarte hinzufügen").tap();
      await a.ui
        .getByRole("textbox", { name: "Überschrift", exact: true })
        .fill("Zusätzliche Kontrollkarte");
      await a.ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill("Bewusste Ergänzung im Importassistenten.");
      await a.ui
        .getByRole("combobox", { name: "Import-Kartengruppe", exact: true })
        .selectOption("extension");
      await choose(a, source.length - 1);
      await btn(a.ui, "Importkarte entfernen").tap();
      await screenshot(a, key + "-karten.png");
      await btn(a.ui, "Original ansehen").tap();
      await screenshot(a, key + "-original.png");
      await take(a);
      await btn(a.ui, "Hilfen bearbeiten").tap();
      await a.ui
        .getByRole("textbox", { name: "Hilfetext", exact: true })
        .fill("Begründet eure Zusammenhänge anhand der Beobachtungen.");
      await btn(a.ui, "Hilfe übernehmen").tap();
      await btn(a.ui, "Entwurf sichern").tap();
      const draft = await download(a, key + "-entwurf.mysteryboard");
      assert.equal(draft.doc.content.cards.length, source.length);
      assert.equal(draft.doc.content.cards[0].text, originalText);
      assert.equal(draft.doc.content.cards[0].source, originalSource);
      assert(draft.doc.content.cards[0].image.startsWith("data:image/jpeg;"));
      if (format === "docx")
        assert.equal(draft.doc.content.cards[2].table.rows[0][1], "13,75");
      await a.finish();
      const reopened = await app("html", viewport);
      await load(reopened, draft.bytes);
      await btn(reopened.ui, "Schülerversion erstellen").tap();
      const task = await download(reopened, key + "-aufgabe.mysteryboard");
      assert.deepEqual(task.doc.content, draft.doc.content);
      assert.equal(task.doc.kind, "task");
      assert.equal(task.doc.content.cards[0].text, originalText);
      assert.equal(task.doc.content.cards[0].source, originalSource);
      // Two actual content versions, both exported through the existing editor.
      await btn(reopened.ui, "Karte 1 bearbeiten").tap();
      await reopened.ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .fill(originalText + "\n\nBewusste technische Revision 2.");
      await btn(reopened.ui, "Karte übernehmen").tap();
      await btn(reopened.ui, "Entwurf sichern").tap();
      const revisionDraft = await download(
        reopened,
        key + "-entwurf-v2.mysteryboard",
      );
      await btn(reopened.ui, "Schülerversion erstellen").tap();
      const revisionTask = await download(
        reopened,
        key + "-aufgabe-v2.mysteryboard",
      );
      assert.equal(revisionTask.doc.content.id, task.doc.content.id);
      assert.notEqual(
        revisionTask.doc.content.version,
        task.doc.content.version,
      );
      assert.deepEqual(revisionTask.doc.content, revisionDraft.doc.content);
      assert.equal(
        revisionTask.doc.content.cards[0].text,
        originalText + "\n\nBewusste technische Revision 2.",
      );
      await reopened.finish();
      const pupils = await app("scorm", viewport);
      await load(pupils, task.bytes);
      await pupils.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("Importgruppe");
      await btn(pupils.ui, "Beginnen").tap();
      await touch(pupils);
      await connection(pupils, 1, 2, "Begründeter Zusammenhang");
      const before = await project(pupils, key + "-projekt");
      await btn(pupils.ui, "Rückgängig").tap();
      const undone = await project(pupils, key + "-undo");
      assert.equal(
        undone.doc.work.edges.length,
        before.doc.work.edges.length - 1,
      );
      await btn(pupils.ui, "Wiederholen").tap();
      assert.deepEqual((await project(pupils, key + "-redo")).doc, before.doc);
      for (const paper of ["a4", "a3"]) await printPdf(pupils, key, paper);
      await btn(pupils.ui, "Menü").tap();
      await btn(pupils.ui, "Kleineres Sicherungsbild").tap();
      const png = await download(
        pupils,
        key + "-schueler.png",
        "Sicherungsbild herunterladen",
      );
      assert.deepEqual(png.doc, before.doc);
      await screenshot(pupils, key + "-scorm.png");
      await pupils.finish();
      const fresh = await app("scorm", viewport);
      await load(fresh, png.bytes, "stand.png");
      assert.deepEqual(
        (await project(fresh, key + "-restauriert")).doc,
        before.doc,
      );
      await connection(fresh, 2, 3, "Weitergearbeitet");
      await fresh.finish();
      const revised = await app("scorm", viewport);
      await load(revised, revisionTask.bytes);
      await revised.ui
        .getByLabel("Teamname oder Vornamen", { exact: true })
        .fill("Revisionsteam");
      await btn(revised.ui, "Beginnen").tap();
      const revisedProject = await project(revised, key + "-projekt-v2");
      assert.deepEqual(revisedProject.doc.content, revisionTask.doc.content);
      assert.notEqual(
        revisedProject.doc.content.version,
        before.doc.content.version,
      );
      revised.page.once("dialog", (d) => d.accept());
      await load(revised, png.bytes, "stand-v1.png", true);
      assert.deepEqual(
        (await project(revised, key + "-v1-in-v2-wiederhergestellt")).doc,
        before.doc,
      );
      await revised.finish();
      report.checks.push(
        key +
          ": Originalfelder, exakter Split/Merge, Ergänzen/Löschen, Bild/Tabelle, Hilfen, zwei tatsächliche Inhaltsversionen, frischer Entwurf, Schülerversion, tatsächliche SCORM, Touch/Pinch/Pfeil/Undo/Redo, A4/A3-PDF und vollständiger PNG-Restore.",
      );
    }
  const check = await app("html", { width: 768, height: 1024 });
  await teacher(check);
  await btn(check.ui, "Dokument importieren").tap();
  await parse(check, "A-Word-12-Karten.docx");
  for (let i = 0; i < 12; i++) {
    await choose(check, i);
    assert.equal(
      await check.ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .inputValue(),
      original.A[i].paragraphs.join("\n\n"),
    );
  }
  await take(check);
  await btn(check.ui, "Entwurf sichern").tap();
  const twelve = await download(check, "A-zwoelf-entwurf.mysteryboard");
  assert.deepEqual(
    twelve.doc.content.cards
      .filter((c) => c.group === "extension")
      .map((c) => c.id),
    [3, 8, 12],
  );
  await check.finish();
  const scan = await app("html", { width: 768, height: 1024 });
  await teacher(scan);
  await btn(scan.ui, "Dokument importieren").tap();
  await parse(scan, "E-PDF-Scan-ohne-Text.pdf");
  assert(
    (await scan.ui.locator(".document-import").textContent()).includes(
      "keinen auslesbaren Text",
    ),
  );
  assert.equal(
    await scan.ui
      .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
      .count(),
    0,
  );
  await btn(scan.ui, "Original ansehen").tap();
  await btn(scan.ui, "Seite als Bildkarte hinzufügen").tap();
  await scan.ui.waitForFunction(
    () => !document.querySelector(".import-step-body").disabled,
  );
  await take(scan);
  await btn(scan.ui, "Entwurf sichern").tap();
  const imageOnly = await download(scan, "E-scan-bildkarte.mysteryboard");
  assert.equal(imageOnly.doc.content.cards[0].text, "");
  assert(imageOnly.doc.content.cards[0].image.startsWith("data:image/"));
  await scan.finish();
  report.checks.push(
    "A: zwölf Karten, explizite V3/V8/V12, neun Pflichtkarten; E: keine OCR behauptet, echte Seite als Bildkarte.",
  );
  const complex = await app("html", { width: 1024, height: 768 });
  await teacher(complex);
  await btn(complex.ui, "Dokument importieren").tap();
  await parse(complex, "D-PDF-Mehrspaltig.pdf");
  assert.equal(
    await complex.ui
      .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
      .locator("option")
      .count(),
    6,
  );
  for (let i = 0; i < original.B.length; i++) {
    await choose(complex, i);
    assert.equal(
      await complex.ui
        .getByRole("textbox", { name: "Überschrift", exact: true })
        .inputValue(),
      original.B[i].title,
    );
    const body = (
      await complex.ui
        .getByRole("textbox", { name: "Kartentext", exact: true })
        .inputValue()
    ).replace(/\s+/g, " ");
    for (const part of original.B[i].paragraphs) assert(body.includes(part));
    if (i === 2)
      for (const row of original.table.rows)
        for (const value of row) assert(body.includes(value));
    assert.equal(
      (
        await complex.ui
          .getByRole("textbox", { name: "Quellenangabe", exact: true })
          .inputValue()
      ).trim(),
      original.B[i].source,
    );
  }
  await btn(complex.ui, "Original ansehen").tap();
  await screenshot(complex, "D-mehrspaltiges-original.png");
  await complex.finish();
  const across = await app("html", { width: 600, height: 800 });
  await teacher(across);
  await btn(across.ui, "Dokument importieren").tap();
  await parse(across, "G-PDF-Seitenuebergreifend.pdf");
  assert.equal(
    await across.ui
      .getByRole("combobox", { name: "Importkarte auswählen", exact: true })
      .locator("option")
      .count(),
    2,
  );
  const acrossText = await across.ui
    .getByRole("textbox", { name: "Kartentext", exact: true })
    .inputValue();
  assert(acrossText.includes("Erster Teil: 12,5 °C."));
  assert(
    acrossText.includes("Fortsetzung ohne neue Kartenüberschrift: 3,50 g."),
  );
  await take(across);
  await btn(across.ui, "Entwurf sichern").tap();
  const acrossDraft = await download(
    across,
    "G-seitenuebergreifend-entwurf.mysteryboard",
  );
  assert(
    acrossDraft.doc.content.cards[0].text.includes(
      "Fortsetzung ohne neue Kartenüberschrift: 3,50 g.",
    ),
  );
  assert.equal(acrossDraft.doc.content.cards[1].group, "extension");
  await across.finish();
  const unsafe = await app("html", { width: 768, height: 1024 });
  await load(unsafe, twelve.bytes);
  for (const name of [
    "F-Altformat.doc",
    "F-Defekt.docx",
    "F-Defekt.pdf",
    "F-Word-komprimiert.docx",
    "F-Word-aktive-Inhalte.docx",
    "F-Word-Mediengrenze.docx",
    "F-PDF-JavaScript.pdf",
  ]) {
    await btn(unsafe.ui, "Dokument importieren").tap();
    await unsafe.ui
      .getByLabel("Word- oder PDF-Datei", { exact: true })
      .setInputFiles(join(root, "dateien", name));
    await unsafe.ui.getByRole("alert").waitFor({ timeout: 45000 });
    await btn(unsafe.ui, "Zurück zum Entwurf").tap();
  }
  await btn(unsafe.ui, "Dokument importieren").tap();
  await unsafe.ui
    .getByLabel("Word- oder PDF-Datei", { exact: true })
    .setInputFiles(join(root, "dateien/H-PDF-Abbruch-38-Seiten.pdf"));
  await btn(unsafe.ui, "Import abbrechen").tap();
  await btn(unsafe.ui, "Entwurf sichern").tap();
  const unchanged = await download(
    unsafe,
    "F-nach-fehlern-und-abbruch.mysteryboard",
  );
  assert.deepEqual(unchanged.doc, twelve.doc);
  await unsafe.finish();
  report.checks.push(
    "D: sechs Originalkarten mit allen Texten/Quellen und allen Messwerten aus beiden Spalten; G: echter seitenübergreifender Text im heruntergeladenen Entwurf; F/H: sieben zurückgewiesene Dateien und großer Importabbruch erhalten den vorhandenen Entwurf exakt.",
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
