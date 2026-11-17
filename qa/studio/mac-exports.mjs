import { chromium, webkit, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { host } from "./web-host.mjs";
import { playerWorkflow } from "./player-workflow.mjs";

const out = resolve(
  process.env.STUDIO_EVIDENCE || "/workspace/mysteryboard-studio-evidence",
);
const engine = process.env.STUDIO_ENGINE || "chromium";
await mkdir(out, { recursive: true });
const native = JSON.parse(
  await readFile(join(out, "Mac/native-macos.json"), "utf8"),
);
expect(native.passed).toBe(true);
const server = await host(out);
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  executablePath:
    engine === "webkit" ? process.env.WEBKIT_EXECUTABLE : "/usr/bin/chromium",
  args: engine === "webkit" ? [] : ["--no-sandbox"],
});
try {
  const proofs = [];
  for (const n of [5, 16]) {
    proofs.push(
      await playerWorkflow(
        browser,
        server.origin,
        out,
        join(out, `Mac/Studio-${n}-SCORM.zip`),
        `Mac-${engine}-${n}`,
        n,
        { skipCDPPinch: engine === "webkit" },
      ),
    );
  }
  for (const p of proofs) expect(p.externalRequests).toEqual([]);
  await writeFile(
    join(out, `Mac-SCORM-${engine}.json`),
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        platform: process.platform,
        realSafariOrIpad: false,
        sourceCommit: native.prefs.sourceCommit,
        proofs,
      },
      null,
      2,
    ),
  );
  console.log(
    `Mac-exported SCORM: ${engine} ${browser.version()}, both mysteries and fresh-session PNG restoration passed.`,
  );
} finally {
  await browser.close();
  server.close();
}
