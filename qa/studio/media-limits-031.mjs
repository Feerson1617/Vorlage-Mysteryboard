import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium, webkit, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { host } from "./web-host.mjs";
import { button, openExports } from "./controls.mjs";
const root = resolve(process.argv[2]),
  out = join(root, "Unabhaengige-Zusatzpruefung");
await mkdir(out, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const server = await host(root),
  evidence = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  for (const [sample, pack, expected] of [
    ["Grenze", "Einzel-Grenze", 100],
    ["Gemischt", "Gemischte-Sammlung", 2],
  ]) {
    const editor = await browser.newPage();
    editor.setDefaultTimeout(120000);
    const zip = join(out, pack + ".zip");
    await editor.exposeFunction("writeLocal", async (base64) => {
      await writeFile(zip, Buffer.from(base64, "base64"));
      return true;
    });
    await editor.addInitScript((s) => {
      window.mysteryStudio = {
        openProject: async () => ({
          name: s + ".mysteryboard",
          bytes: new Uint8Array(
            await (
              await fetch("/qa-evidence/inputs/" + s + ".mysteryboard")
            ).arrayBuffer(),
          ),
        }),
        recentProjects: async () => [],
        replaceWithExchange: async () => true,
        modalState: async () => {},
        projectState: async () => {},
        onSaved: () => () => {},
        detachProject: async () => {},
        saveExport: (b) => window.writeLocal(b.toBase64()),
      };
    }, sample);
    editor.on("dialog", (d) => d.accept().catch(() => {}));
    await editor.goto(server.origin + "/studio/dist/studio/index.html");
    await button(editor, "Mystery öffnen").click();
    await expect(editor.getByRole("dialog")).toContainText(
      "Technisch exportbereit",
      { timeout: 120000 },
    );
    await button(editor, "Als Projekt übernehmen").click();
    await openExports(editor);
    await button(
      editor,
      sample === "Gemischt"
        ? "Alle Niveaus für itslearning exportieren"
        : "Für itslearning exportieren",
    ).click();
    await expect
      .poll(
        () =>
          stat(zip).then(
            (v) => v.size,
            () => 0,
          ),
        { timeout: 120000 },
      )
      .toBeGreaterThan(0);
    await editor.close();
    const files = unzipSync(await readFile(zip)),
      local = join(out, pack);
    await mkdir(local, { recursive: true });
    for (const [n, b] of Object.entries(files)) {
      assert(!n.includes("/"));
      await writeFile(join(local, n), b);
    }
    const data = Object.keys(files)
      .filter((n) => n.endsWith(".json"))
      .map((n) => JSON.parse(Buffer.from(files[n])));
    const input = JSON.parse(
      await readFile(join(root, "inputs", sample + ".mysteryboard"), "utf8"),
    ).project;
    const url =
      server.origin +
      "/qa-evidence/Unabhaengige-Zusatzpruefung/" +
      pack +
      "/launch.html";
    assert.equal(
      sample === "Grenze" ? files["task.json"].length : data.length,
      sample === "Grenze" ? 19980000 : expected,
    );
    for (const [kind, exe] of [
      [chromium, process.env.CHROMIUM_PATH],
      [webkit, process.env.WEBKIT_PATH],
    ]) {
      const client = await kind.launch({ executablePath: exe });
      try {
        for (let i = 0; i < data.length; i++) {
          const p = await client.newPage();
          p.setDefaultTimeout(120000);
          const outside = [];
          p.on("request", (r) => {
            if (
              /^https?:/.test(r.url()) &&
              !r.url().startsWith(server.origin + "/")
            )
              outside.push(r.url());
          });
          await p.goto(url);
          const learner = p.frameLocator("iframe");
          if (sample === "Gemischt")
            await learner
              .getByRole("button", {
                name: new RegExp("^" + input.levels[i].name),
              })
              .click();
          await learner
            .getByLabel("Gruppenname", { exact: true })
            .fill("Prüfgruppe");
          await button(learner, "Beginnen").click();
          await expect(learner.locator("[data-card]")).toHaveCount(
            data[i].content.cards.length,
            { timeout: 60000 },
          );
          await learner.locator('[data-card="1"]').press("Enter");
          const image = learner.getByRole("dialog").locator("img").first();
          if (data[i].content.cards[0].image) {
            await expect(image).toBeVisible();
            const size = await image.evaluate(async (el) => {
              await el.decode();
              return [el.naturalWidth, el.naturalHeight];
            });
            assert.deepEqual(size, [sample === "Grenze" ? 1200 : 1000, 800]);
            assert.equal(
              await image.getAttribute("src"),
              data[i].content.cards[0].image,
            );
          }
          assert.deepEqual(outside, []);
          evidence.push({
            sample,
            level: i + 1,
            engine: kind.name(),
            version: client.version(),
            cards: data[i].content.cards.length,
            hash: data[i].contentHash,
            archive: sha(await readFile(zip)),
            outside,
            playerBytes: files["app.html"].length,
          });
          await p.close();
        }
      } finally {
        await client.close();
      }
    }
  }
  await writeFile(
    join(out, "Grenzen-und-Medien.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  server.close();
}
