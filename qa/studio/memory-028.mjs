import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { chromium, expect } from "@playwright/test";
import { host } from "./web-host.mjs";
import { button } from "./controls.mjs";
const out = resolve(process.argv[2]),
  reference = await readFile(process.argv[3]);
assert.equal(
  createHash("sha256").update(reference).digest("hex"),
  "142824ace0cb8e6b95dd5e8f39b8de90b22fb89d62b53483a9ee06b565d8edd1",
);
const before = new TextDecoder().decode(unzipSync(reference)["app.html"]);
const template = await readFile("studio/dist/player/index.html", "utf8");
const tag =
  /<script id="mysteryboard-launch" type="application\/json">([^<]+)<\/script>/;
const launch = before.match(tag);
const task = JSON.parse(launch[1]).task;
const after = template.replace(tag, () => launch[0]);
const hoster = await host(out),
  b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
const results = {
  browser: b.version(),
  taskBytes: Buffer.from(task, "base64").length,
  cases: [],
};
try {
  for (const [label, html] of [
    ["0.2.7", before],
    ["0.2.8", after],
  ]) {
    const page = await b.newPage();
    await page.addInitScript((size) => {
      const original = window.atob;
      window.taskDecodes = 0;
      window.atob = (s) => {
        if (s.length === size) window.taskDecodes++;
        return original(s);
      };
    }, task.length);
    await page.route("**/memory.html", (r) =>
      r.fulfill({ body: html, contentType: "text/html" }),
    );
    await page.goto(hoster.origin + "/memory.html");
    await expect(button(page, "Beginnen")).toBeVisible();
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    const heap = async () => {
      await client.send("HeapProfiler.collectGarbage");
      return (await client.send("Performance.getMetrics")).metrics.find(
        (m) => m.name === "JSHeapUsedSize",
      ).value;
    };
    const heapBefore = await heap();
    for (let i = 0; i < 5; i++) {
      await button(page, "Fortsetzen").click();
      await button(page, "Schließen").click();
    }
    results.cases.push({
      label,
      taskDecodes: await page.evaluate(() => window.taskDecodes),
      heapBefore,
      heapAfter: await heap(),
    });
    await page.close();
  }
  assert.equal(results.cases[1].taskDecodes, 1);
  assert(results.cases[0].taskDecodes > results.cases[1].taskDecodes);
  await writeFile(
    join(out, "Speichermessung-028.json"),
    JSON.stringify(results, null, 2),
  );
} finally {
  await b.close();
  hoster.close();
}
