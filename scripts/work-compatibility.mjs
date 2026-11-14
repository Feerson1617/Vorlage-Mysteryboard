// Focused acceptance of the final standalone HTMLs. No application build,
// Chromium-only CDP, publication, or persistent application storage.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

const usage = `node scripts/work-compatibility.mjs --engine chromium|webkit
  [--executable /path/to/browser] [--playwright-module /path/to/playwright/index.mjs]
  [--expected-version 26.5] [--html-dir artifacts] [--output OUTPUT_DIRECTORY]
  [--source-commit FULL_SHA] [--port 5177]
The selected browser must already be installed. No fallback to another engine.
--expected-version accepts the exact reported version or its dot-prefix.`;
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === "--help") {
    console.log(usage);
    process.exit(0);
  }
  if (
    !/^--(engine|executable|playwright-module|expected-version|html-dir|output|source-commit|port)$/.test(
      key,
    ) ||
    !process.argv[i + 1] ||
    process.argv[i + 1].startsWith("--")
  )
    throw new Error(usage);
  if (options[key.slice(2)] !== undefined)
    throw new Error(`Duplicate option: ${key}`);
  options[key.slice(2)] = process.argv[++i];
}
if (!["chromium", "webkit"].includes(options.engine))
  throw new Error(`An explicit supported --engine is required.\n${usage}`);
if (
  options["source-commit"] &&
  !/^[a-f0-9]{40}$/i.test(options["source-commit"])
)
  throw new Error(
    "--source-commit must contain the full 40-character SHA supplied with the artifacts.",
  );
const htmlDir = resolve(options["html-dir"] || "artifacts");
const output = resolve(
  options.output ||
    join(tmpdir(), `mysteryboard-work-${options.engine}-${Date.now()}`),
);
const port = Number(options.port || 5177);
assert(
  Number.isInteger(port) && port >= 1024 && port <= 65535,
  "Invalid --port",
);
await mkdir(output, { recursive: true });
const files = [
  { key: "small", name: "MysteryBoard-klein.html", cards: 12 },
  { key: "large", name: "MysteryBoard-umfangreich.html", cards: 60 },
  { key: "boden", name: "MysteryBoard-Boden-Klasse11.html", cards: 18 },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const result = {
  startedAt: new Date().toISOString(),
  status: "running",
  engine: options.engine,
  expectedVersion: options["expected-version"] || null,
  browserVersion: null,
  playwrightModule: options["playwright-module"] || "playwright",
  executable: options.executable || null,
  suppliedSourceCommit: options["source-commit"] || null,
  sourceCommitNote:
    "Supplied provenance; artifact hashes identify the actual tested bytes. This script does not attest a build-to-commit mapping.",
  scriptSha256: sha(await readFile(new URL(import.meta.url))),
  htmlDir,
  variants: [],
  limitations: [
    "Browser automation is not a managed school iPad or Canva acceptance.",
    "Native taps use the selected engine. Delayed-click fault injection uses untrusted DOM events and is identified separately.",
    "Only the exact local HTML document is fetched; all interaction and fresh-session import run offline.",
    "The focused test does not replace the full regression suite or physical pinch/pan testing.",
  ],
};
const log = (text) => console.log(text);
const btn = (page, name) => page.getByRole("button", { name, exact: true });
const dialog = (page) => page.getByRole("dialog");
async function until(check, message, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(message);
}
async function noDialog(page) {
  await until(
    async () => (await dialog(page).count()) === 0,
    "Dialog did not close",
  );
}
async function namedDialog(page, name) {
  await until(
    async () =>
      (await dialog(page).count()) === 1 &&
      (await dialog(page).getAttribute("aria-label")) === name,
    `Expected exactly one dialog: ${name}`,
  );
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function pngState(png) {
  assert(
    png.length <= 30000000 &&
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "Invalid PNG signature or size",
  );
  let packed,
    ended = false,
    image = false;
  for (let offset = 8; offset < png.length;) {
    assert(offset + 12 <= png.length, "Truncated PNG chunk");
    const length = png.readUInt32BE(offset),
      end = offset + length + 12,
      type = png.toString("ascii", offset + 4, offset + 8);
    assert(
      end <= png.length &&
        crc32(png.subarray(offset + 4, end - 4)) === png.readUInt32BE(end - 4),
      `PNG CRC mismatch: ${type}`,
    );
    if (offset === 8)
      assert(type === "IHDR" && length === 13, "Missing PNG header");
    if (type === "IDAT") image = true;
    if (type === "mySt") {
      assert(!packed, "Duplicate state block");
      packed = png.subarray(offset + 8, end - 4);
    }
    if (type === "IEND") {
      assert(length === 0 && end === png.length && image, "Incomplete PNG");
      ended = true;
    }
    offset = end;
  }
  assert(
    ended &&
      packed &&
      packed.length >= 41 &&
      packed.toString("ascii", 0, 3) === "MBS" &&
      [1, 2].includes(packed[3]),
    "Missing/unsupported state block",
  );
  const size = packed.readUInt32BE(4);
  assert(size > 0 && size <= 1000000, "Invalid expanded state length");
  const raw = inflateSync(packed.subarray(40), { maxOutputLength: 1000000 });
  assert(
    raw.length === size && sha(raw) === packed.subarray(8, 40).toString("hex"),
    "State SHA-256 mismatch",
  );
  const compact = JSON.parse(raw.toString("utf8"));
  assert(
    Array.isArray(compact) &&
      compact[0] === packed[3] &&
      compact.length === (packed[3] === 2 ? 7 : 6),
    "Invalid compact state schema",
  );
  return {
    schema: compact[0],
    mystery: compact[1],
    version: compact[2],
    cards: compact[3].map(([id, x, y, color]) => ({ id, x, y, color })),
    edges: compact[4].map(([id, from, to, direction, label]) => ({
      id,
      from,
      to,
      direction,
      label,
    })),
    categories: compact[5],
    ...(compact[0] === 2 ? { team: compact[6] } : {}),
  };
}
async function openPage(context, file, evidence) {
  await context.setOffline(false);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const url = `http://127.0.0.1:${port}/${file.name}`;
  page.on("request", (request) => {
    const document =
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      request.frame() === page.mainFrame() &&
      request.url() === url;
    if (/^https?:/.test(request.url()) && !document)
      evidence.unexpectedRequests.push(request.url());
  });
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  await page.goto(url, { waitUntil: "load" });
  await context.setOffline(true);
  return page;
}
async function download(page, directory, stem) {
  await btn(page, "Menü").tap();
  await btn(page, "Kleineres Sicherungsbild").tap();
  const link = page.getByRole("link", {
    name: "Sicherungsbild herunterladen",
    exact: true,
  });
  await link.waitFor({ state: "visible", timeout: 60000 });
  const pending = page.waitForEvent("download");
  await link.tap();
  const saved = await pending;
  assert.equal(await saved.failure(), null, "PNG download failed");
  const path = join(directory, `${stem}.png`);
  await saved.saveAs(path);
  const png = await readFile(path),
    state = pngState(png);
  await writeFile(
    join(directory, `${stem}.state.json`),
    JSON.stringify(state, null, 2),
  );
  await btn(page, "Schließen").tap();
  await noDialog(page);
  return {
    png,
    state,
    file: `${stem}.png`,
    bytes: png.length,
    sha256: sha(png),
  };
}
async function cardTap(page, id) {
  await page.locator(`[data-card="${id}"] > rect`).tap();
}
async function edgeTap(page, id) {
  // Choose an actually visible label point; do not force through a number badge.
  const point = await page
    .locator(`[data-edge-label="${id}"]`)
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9])
        for (const fy of [0.5, 0.25, 0.75]) {
          const x = rect.x + rect.width * fx,
            y = rect.y + rect.height * fy;
          if (
            document.elementFromPoint(x, y)?.closest("[data-edge-label]") ===
            element
          )
            return { x, y };
        }
      return null;
    });
  assert(point, `Connection ${id} label has no usable visible touch point`);
  await page.touchscreen.tap(point.x, point.y);
}
async function injectDelayedClick(target, kind) {
  // Deliberate test delay, not an application interaction workaround.
  await new Promise((done) => setTimeout(done, 450));
  const prevented = await target.evaluate((element, kind) => {
    const box = element.getBoundingClientRect(),
      init = {
        bubbles: true,
        cancelable: true,
        detail: 1,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      };
    const event =
      kind === "MouseEvent"
        ? new MouseEvent("click", init)
        : new PointerEvent("click", {
            ...init,
            pointerType: "mouse",
            pointerId: 83,
          });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, kind);
  assert.equal(prevented, true, `${kind} delayed click was not blocked`);
}
async function assertStateVisible(page, state) {
  assert.equal(await page.locator("[data-card]").count(), state.cards.length);
  assert.equal(await page.locator("[data-edge]").count(), state.edges.length);
  assert.equal(await page.locator(".team-summary").textContent(), state.team);
  for (const card of state.cards) {
    assert.equal(
      Number(
        await page.locator(`[data-card="${card.id}"]`).getAttribute("data-x"),
      ),
      card.x,
    );
    assert.equal(
      Number(
        await page.locator(`[data-card="${card.id}"]`).getAttribute("data-y"),
      ),
      card.y,
    );
  }
}
let browser, server;
try {
  const documents = new Map();
  for (const file of files) {
    const bytes = await readFile(join(htmlDir, file.name));
    assert(bytes.length < 10000000, `${file.name} exceeds the HTML size limit`);
    documents.set(`/${file.name}`, bytes);
    file.htmlBytes = bytes.length;
    file.htmlSha256 = sha(bytes);
  }
  const moduleName = options["playwright-module"];
  const pw = await import(
    moduleName && (isAbsolute(moduleName) || moduleName.startsWith("."))
      ? pathToFileURL(resolve(moduleName)).href
      : moduleName || "playwright"
  );
  const engine = pw[options.engine] || pw.default?.[options.engine];
  assert(
    engine,
    `The selected Playwright module does not provide ${options.engine}`,
  );
  const launch = { headless: true };
  if (options.executable) launch.executablePath = resolve(options.executable);
  if (options.engine === "chromium") launch.args = ["--no-sandbox"];
  browser = await engine.launch(launch);
  result.browserVersion = browser.version();
  const expected = options["expected-version"];
  assert(
    !expected ||
      result.browserVersion === expected ||
      result.browserVersion.startsWith(`${expected}.`),
    `Requested ${options.engine} ${expected}; actual browser.version() is ${result.browserVersion}. Compatibility proof rejected.`,
  );
  log(`${options.engine}: ${result.browserVersion}; output ${output}`);
  server = createServer((request, response) => {
    const bytes = documents.get(request.url);
    response.writeHead(bytes ? 200 : 404, {
      "Content-Type": bytes ? "text/html; charset=utf-8" : "text/plain",
      "Cache-Control": "no-store",
    });
    response.end(bytes || "Only the three acceptance HTMLs are available.");
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", done);
  });
  for (const file of files) {
    const directory = join(output, file.key);
    await mkdir(directory, { recursive: true });
    const evidence = {
      key: file.key,
      html: file.name,
      htmlBytes: file.htmlBytes,
      htmlSha256: file.htmlSha256,
      status: "running",
      stage: "start",
      steps: [],
      downloads: [],
      unexpectedRequests: [],
      errors: [],
    };
    result.variants.push(evidence);
    let context, fresh;
    try {
      context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 1024, height: 768 },
        acceptDownloads: true,
      });
      const page = await openPage(context, file, evidence),
        name = `Work – Jörg und Özlem ${file.key}`;
      await page
        .getByRole("textbox", { name: "Teamname oder Vornamen", exact: true })
        .fill(name);
      await btn(page, "Beginnen").tap();
      await until(
        async () => (await page.locator("[data-card]").count()) === file.cards,
        "Board failed to start",
      );
      const baseline = await download(page, directory, "01-baseline");
      evidence.downloads.push({
        ...baseline,
        png: undefined,
        state: undefined,
      });
      assert.equal(baseline.state.cards.length, file.cards);
      assert.equal(baseline.state.team, name);
      const expectedState = structuredClone(baseline.state);
      evidence.stage = "native-card-open-close-reopen";
      await cardTap(page, 1);
      await namedDialog(page, "Karte 1");
      await btn(page, "Schließen").tap();
      await noDialog(page);
      await cardTap(page, 1);
      await namedDialog(page, "Karte 1");
      for (const kind of ["PointerEvent", "MouseEvent"]) {
        await injectDelayedClick(btn(page, "Schließen"), kind);
        await namedDialog(page, "Karte 1");
      }
      await btn(page, "Schließen").tap();
      await noDialog(page);
      evidence.steps.push(
        "Native card open, deliberate close, reopen; two injected delayed clicks blocked; subsequent deliberate close works.",
      );
      evidence.stage = "card-color-category";
      await cardTap(page, 1);
      await namedDialog(page, "Karte 1");
      await btn(page, "Blau").tap();
      await page
        .getByRole("textbox", { name: /Name für diese Farbe/ })
        .fill("Work-Kategorie ÄÖÜ");
      await btn(page, "Schließen").tap();
      await noDialog(page);
      expectedState.cards.find((card) => card.id === 1).color = 2;
      expectedState.categories[2] = "Work-Kategorie ÄÖÜ";
      evidence.stage = "create-edit-delete-connection";
      const origin = expectedState.cards.find((card) => card.id === 1);
      // A distant collinear pair can place its label completely under a card.
      // Use the nearest unused pair and still require an actually visible hit.
      const other = expectedState.cards
        .filter(
          (card) =>
            card.id !== 1 &&
            !expectedState.edges.some(
              (edge) =>
                (edge.from === 1 && edge.to === card.id) ||
                (edge.to === 1 && edge.from === card.id),
            ),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
            Math.hypot(b.x - origin.x, b.y - origin.y),
        )[0];
      assert(other, "No unused connection pair available");
      let id = 1;
      while (expectedState.edges.some((edge) => edge.id === id)) id++;
      await cardTap(page, 1);
      await btn(page, "Mit einer Karte verbinden").tap();
      await cardTap(page, other.id);
      const edgeTitle = await dialog(page).getAttribute("aria-label");
      assert(edgeTitle?.startsWith("Verbindung 1 und "));
      await page
        .getByRole("textbox", { name: /Beschriftung/ })
        .fill("Work-Verbindung");
      await page
        .getByRole("combobox", { name: "Richtung", exact: true })
        .selectOption("1");
      await btn(page, "Übernehmen").tap();
      await noDialog(page);
      await edgeTap(page, id);
      await namedDialog(page, edgeTitle);
      for (const kind of ["PointerEvent", "MouseEvent"]) {
        await injectDelayedClick(btn(page, "Verbindung löschen"), kind);
        await namedDialog(page, edgeTitle);
        assert.equal(
          await page.locator("[data-edge]").count(),
          baseline.state.edges.length + 1,
        );
      }
      await page
        .getByRole("textbox", { name: /Beschriftung/ })
        .fill("Bewusst geändert – äöü");
      await page
        .getByRole("combobox", { name: "Richtung", exact: true })
        .selectOption("2");
      await btn(page, "Übernehmen").tap();
      await noDialog(page);
      await edgeTap(page, id);
      await btn(page, "Verbindung löschen").tap();
      await noDialog(page);
      assert.equal(
        await page.locator("[data-edge]").count(),
        baseline.state.edges.length,
      );
      await btn(page, "Rückgängig").tap();
      expectedState.edges.push({
        id,
        from: 1,
        to: other.id,
        direction: 2,
        label: "Bewusst geändert – äöü",
      });
      expectedState.edges.sort((a, b) => a.id - b.id);
      await assertStateVisible(page, expectedState);
      evidence.steps.push(
        "Native create/edit/delete of a connection; both delayed-click injections cannot delete; explicit delete works; Undo restores the edited connection.",
      );
      evidence.stage = "save-full-state";
      const saved = await download(page, directory, "02-edited");
      assert.deepEqual(
        saved.state,
        expectedState,
        "Edited PNG differs from the complete expected state",
      );
      evidence.downloads.push({ ...saved, png: undefined, state: undefined });
      await page.screenshot({ path: join(directory, "edited-board.png") });
      await context.close();
      context = null;
      evidence.stage = "new-context-import";
      fresh = await browser.newContext({
        hasTouch: true,
        viewport: { width: 768, height: 1024 },
        acceptDownloads: true,
      });
      const restored = await openPage(fresh, file, evidence);
      await btn(restored, "Fortsetzen").tap();
      const picker = restored.waitForEvent("filechooser");
      await btn(restored, "Sicherungsbild auswählen").tap();
      await (await picker).setFiles(join(directory, "02-edited.png"));
      await noDialog(restored);
      await assertStateVisible(restored, expectedState);
      assert.equal(await btn(restored, "Rückgängig").isDisabled(), true);
      assert.equal(await btn(restored, "Wiederholen").isDisabled(), true);
      const roundtrip = await download(restored, directory, "03-restored");
      assert.deepEqual(
        roundtrip.state,
        expectedState,
        "Fresh context lost or changed saved state",
      );
      evidence.downloads.push({
        ...roundtrip,
        png: undefined,
        state: undefined,
      });
      evidence.stage = "continue-after-restore";
      await cardTap(restored, 1);
      await namedDialog(restored, "Karte 1");
      await btn(restored, "Rot").tap();
      await btn(restored, "Schließen").tap();
      await noDialog(restored);
      expectedState.cards.find((card) => card.id === 1).color = 5;
      await edgeTap(restored, id);
      await pageIsConnection(restored);
      await restored
        .getByRole("textbox", { name: /Beschriftung/ })
        .fill("Nach Wiederherstellung weiterbearbeitet");
      await btn(restored, "Übernehmen").tap();
      await noDialog(restored);
      expectedState.edges.find((edge) => edge.id === id).label =
        "Nach Wiederherstellung weiterbearbeitet";
      const continued = await download(restored, directory, "04-continued");
      assert.deepEqual(
        continued.state,
        expectedState,
        "Continued state differs from the complete expected state",
      );
      evidence.downloads.push({
        ...continued,
        png: undefined,
        state: undefined,
      });
      await restored.screenshot({
        path: join(directory, "restored-continued-board.png"),
      });
      assert.deepEqual(
        await restored.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
        })),
        { local: 0, session: 0 },
      );
      assert.deepEqual(
        evidence.unexpectedRequests,
        [],
        "Unexpected HTTP(S) requests",
      );
      assert.deepEqual(evidence.errors, [], "Browser runtime errors");
      evidence.steps.push(
        "PNG CRC/state SHA verified; complete work equals expected before and after fresh-context import, including team, all cards/positions/colors, categories and connections; further edits and re-export verified offline.",
      );
      evidence.status = "passed";
      evidence.stage = "complete";
      log(`PASS ${file.name}`);
    } catch (error) {
      evidence.status = "failed";
      evidence.failure = error.stack || String(error);
      log(`FAIL ${file.name}: ${error.message}`);
    } finally {
      if (context) await context.close();
      if (fresh) await fresh.close();
    }
  }
  result.status = result.variants.every(
    (variant) => variant.status === "passed",
  )
    ? "passed"
    : "failed";
} catch (error) {
  result.status = "failed";
  result.failure = error.stack || String(error);
  log(`FAIL: ${error.message}`);
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise((done) => server.close(done));
  result.finishedAt = new Date().toISOString();
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  log(`Report: ${join(output, "result.json")}`);
  if (result.status !== "passed") process.exitCode = 1;
}
async function pageIsConnection(page) {
  await until(
    async () =>
      (await dialog(page).getAttribute("aria-label"))?.startsWith(
        "Verbindung ",
      ),
    "Connection did not open after restore",
  );
}
