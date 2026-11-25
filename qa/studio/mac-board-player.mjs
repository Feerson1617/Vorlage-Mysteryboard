import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";
import { releaseOnly } from "./student-release.mjs";
import { createHash } from "node:crypto";
import { unzlibSync } from "fflate";

const out = resolve(process.env.BOARD_EVIDENCE || "artifacts/mac-board-tests");
const dir = join(out, "sco");
const archive = unzipSync(
  new Uint8Array(await readFile(join(out, "Starthilfe-SCORM.zip"))),
);
assert.deepEqual(Object.keys(archive).sort(), [
  "app.html",
  "imsmanifest.xml",
  "launch.html",
  "session.js",
]);
assert.match(
  Buffer.from(archive["imsmanifest.xml"]).toString(),
  /<schemaversion>1\.2<\/schemaversion>/,
);
assert(!Buffer.from(archive["session.js"]).includes("LMSSetValue"));
await mkdir(dir, { recursive: true });
for (const [name, bytes] of Object.entries(archive))
  await writeFile(join(dir, name), bytes);
const server = await host(out);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const requests = [];
async function learner() {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 790 },
    hasTouch: true,
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(server.origin + "/")) {
      requests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(server.origin + "/qa-evidence/sco/launch.html");
  const ui = page.frameLocator("iframe");
  return { context, page, ui };
}
const button = (ui, name) => ui.getByRole("button", { name, exact: true });
const snapshot = (ui) =>
  ui.locator("svg.board").evaluate((svg) => ({
    cards: [...svg.querySelectorAll("[data-card]")].map((e) => [
      e.dataset.card,
      e.dataset.x,
      e.dataset.y,
    ]),
    edges: [...svg.querySelectorAll("[data-edge]")].map((e) => [
      e.dataset.edge,
      e.getAttribute("aria-label"),
      e.querySelector("line[marker-start]") !== null,
    ]),
  }));
try {
  const current = await learner();
  const { ui } = current;
  await ui.getByLabel(/^(Teamname oder Vornamen|Gruppenname)$/).fill("Team Wirkung");
  await button(ui, "Beginnen").tap();
  await expect(ui.locator("[data-edge]")).toHaveCount(1);
  await expect(ui.locator("[data-edge]")).toHaveAttribute(
    "aria-label",
    /Beobachtung als Starthilfe/,
  );
  const motion = await releaseOnly(ui, 1, { dx: 33, dy: 15, type: "touch" });
  assert.deepEqual(motion.actual, motion.target);
  await current.page.screenshot({
    path: join(out, "Schuelerplayer-Starthilfe.png"),
  });
  await ui.locator("[data-edge-label]").tap();
  const form = ui.getByRole("dialog");
  await form.getByRole("combobox", { name: "Richtung" }).selectOption("2");
  await form
    .getByRole("textbox", { name: "Beschriftung (freiwillig)" })
    .fill("Unser erklärter Zusammenhang");
  await button(form, "Übernehmen").tap();
  const expected = await snapshot(ui);
  await expect(ui.locator("[data-edge-label]")).toContainText(
    "Unser erklärter Zusammenhang",
  );
  await ui.locator("[data-edge-label]").tap();
  await button(form, "Verbindung löschen").tap();
  await expect(ui.locator("[data-edge]")).toHaveCount(0);
  await button(ui, "Rückgängig").tap();
  assert.deepEqual(await snapshot(ui), expected);
  await button(ui, "Wiederholen").tap();
  await expect(ui.locator("[data-edge]")).toHaveCount(0);
  await button(ui, "Rückgängig").tap();
  await button(ui, "Menü").tap();
  await button(ui, "Kleineres Sicherungsbild").tap();
  const pending = current.page.waitForEvent("download");
  await ui.getByRole("link", { name: /^(Sicherungsbild herunterladen|PNG herunterladen)$/ }).tap();
  const download = await pending;
  assert.match(download.suggestedFilename(), /^Team Wirkung_.*\.png$/);
  const png = join(out, "Schuelerarbeit-Original.png");
  await download.saveAs(png);
  await current.context.close();
  const fresh = await learner();
  await button(fresh.ui, /^(Fortsetzen|Original-PNG öffnen)$/).tap();
  await fresh.ui.getByLabel("Schüler-Sicherung").setInputFiles(png);
  await expect(fresh.ui.locator("[data-card]")).toHaveCount(5);
  assert.deepEqual(await snapshot(fresh.ui), expected);
  const payload = join(out, "Schuelerarbeit-geprueft.mysteryboard");
  execFileSync("python3", ["qa/touch-saving/verify-png.py", png, payload], {
    stdio: "inherit",
  });
  const restored = JSON.parse(await readFile(payload, "utf8"));
  assert.equal(restored.work.team, "Team Wirkung");
  assert.equal(restored.work.edges[0].label, "Unser erklärter Zusammenhang");
  assert.equal(restored.work.edges[0].direction, 2);
  assert.equal(
    restored.content.initial.edges[0].label,
    "Beobachtung als Starthilfe",
  );
  assert(!JSON.stringify(restored).includes("Planung bleibt intern"));
  await fresh.context.close();
  const legacyDir = join(out, "legacy-sco");
  await mkdir(legacyDir, { recursive: true });
  const legacy = unzipSync(
    new Uint8Array(await readFile(join(out, "Altaufgabe-neu-exportiert.zip"))),
  );
  for (const [name, bytes] of Object.entries(legacy)) {
    assert(Object.hasOwn(archive, name));
    await writeFile(join(legacyDir, name), bytes);
  }
  const oldPng = resolve("qa/studio/evidence/legacy/Studio-0.2.0-Original.png");
  const oldDecoded = join(out, "Altstand-extrahiert.mysteryboard");
  execFileSync(
    "python3",
    ["qa/touch-saving/verify-png.py", oldPng, oldDecoded],
    { stdio: "inherit" },
  );
  const oldState = JSON.parse(await readFile(oldDecoded, "utf8"));
  const old = await learner();
  await old.page.goto(server.origin + "/qa-evidence/legacy-sco/launch.html");
  await button(old.ui, /^(Fortsetzen|Original-PNG öffnen)$/).tap();
  await old.ui.getByLabel("Schüler-Sicherung").setInputFiles(oldPng);
  await expect(old.ui.locator("[data-card]")).toHaveCount(
    oldState.work.cards.length,
  );
  const oldBoard = await snapshot(old.ui);
  assert.deepEqual(
    oldBoard.cards
      .map(([id, x, y]) => [Number(id), Number(x), Number(y)])
      .sort((a, b) => a[0] - b[0]),
    oldState.work.cards
      .map((card) => [card.id, card.x, card.y])
      .sort((a, b) => a[0] - b[0]),
  );
  await expect(old.ui.locator("[data-edge-label]")).toContainText(
    oldState.work.edges[0].label,
  );
  await expect(old.ui.locator(".team-summary")).toContainText(
    oldState.work.team,
  );
  await old.context.close();
  const priorDir = join(out, "legacy-021-sco");
  await mkdir(priorDir, { recursive: true });
  const priorSCO = unzipSync(
    await readFile(join(out, "Altprojekt-021-SCORM.zip")),
  );
  for (const [name, data] of Object.entries(priorSCO)) {
    assert(Object.hasOwn(archive, name));
    await writeFile(join(priorDir, name), data);
  }
  const priorPNG = resolve(
    "qa/studio/evidence/player-021/Schuelerarbeit-Original.png",
  );
  const priorJSON = join(out, "Altstand-021-extrahiert.mysteryboard");
  execFileSync(
    "python3",
    ["qa/touch-saving/verify-png.py", priorPNG, priorJSON],
    { stdio: "inherit" },
  );
  const priorState = JSON.parse(await readFile(priorJSON, "utf8"));
  const prior = await learner();
  await prior.page.goto(
    server.origin + "/qa-evidence/legacy-021-sco/launch.html",
  );
  await button(prior.ui, /^(Fortsetzen|Original-PNG öffnen)$/).tap();
  await prior.ui.getByLabel("Schüler-Sicherung").setInputFiles(priorPNG);
  await expect(prior.ui.locator("[data-card]")).toHaveCount(5);
  await expect(prior.ui.locator("[data-edge-label]")).toContainText(
    priorState.work.edges[0].label,
  );
  await expect(prior.ui.locator(".team-summary")).toContainText(
    priorState.work.team,
  );
  assert.deepEqual(
    (await snapshot(prior.ui)).cards.map(([id, x, y]) => [
      Number(id),
      Number(x),
      Number(y),
    ]),
    priorState.work.cards.map(({ id, x, y }) => [id, x, y]),
  );
  await prior.context.close();

  const pngTask = await readFile(join(out, "Aufgabe-mit-Starthilfe.png"));
  let taskPayload;
  for (let offset = 8; offset + 12 <= pngTask.length;) {
    const length = pngTask.readUInt32BE(offset);
    if (pngTask.toString("ascii", offset + 4, offset + 8) === "mySt")
      taskPayload = pngTask.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
  }
  assert(taskPayload);
  const decodedTask = Buffer.from(unzlibSync(taskPayload.subarray(40)));
  assert.equal(decodedTask.length, taskPayload.readUInt32BE(4));
  assert(
    createHash("sha256")
      .update(decodedTask)
      .digest()
      .equals(taskPayload.subarray(8, 40)),
  );
  const taskFromScorm = JSON.parse(
    Buffer.from(
      JSON.parse(
        Buffer.from(archive["app.html"])
          .toString()
          .match(
            /<script id="mysteryboard-launch" type="application\/json">([\s\S]*?)<\/script>/,
          )[1],
      ).task,
      "base64",
    ).toString(),
  );
  assert.deepEqual(JSON.parse(decodedTask), taskFromScorm);
  assert.deepEqual(requests, []);
  await writeFile(
    join(out, "Mac-Starthilfe-SCORM.json"),
    JSON.stringify(
      {
        passed: true,
        engine: browser.version(),
        freshSessionEqual: true,
        originalPNG: download.suggestedFilename(),
        studentCanEditAndRemove: true,
        actualStudio020PngRestoredInNewPlayer: true,
        actualStudio021PngRestoredInNewPlayer: true,
        confirmedTaskPngMatchesScorm: true,
        undoRedo: true,
        externalRequests: requests,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
  server.close();
}
