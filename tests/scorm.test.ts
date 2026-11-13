import { describe, it, expect } from "vitest";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { unzipSync } from "fflate";
const { packageScorm } = await import(String("../scripts/package-scorm.mjs"));

describe("SCORM-Verpackung ohne Lerndaten", () => {
  it("verpackt unveränderte HTML-Bytes deterministisch mit vollständigen lokalen Ressourcen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mysteryboard-scorm-"));
    try {
      const html = Buffer.from(
        "<!doctype html><html lang=de><body>Prüfdatei ÄÖÜ</body></html>",
      );
      const input = join(dir, "final.html");
      await writeFile(input, html);
      const a = await packageScorm(input, join(dir, "a.zip"));
      const b = await packageScorm(input, join(dir, "b.zip"));
      expect(a.zip.sha256).toBe(b.zip.sha256);
      const files = unzipSync(await readFile(join(dir, "a.zip")));
      expect(Object.keys(files).sort()).toEqual([
        "app.html",
        "imsmanifest.xml",
        "launch.html",
        "session.js",
      ]);
      expect(Buffer.from(files["app.html"])).toEqual(html);
      expect(Buffer.from(files["imsmanifest.xml"]).toString()).toContain(
        "<schemaversion>1.2</schemaversion>",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  const run = async (mode: string) => {
    const calls: string[][] = [],
      listeners: Record<string, (event: { persisted: boolean }) => void> = {};
    const record =
      (name: string, result: string) =>
      (...args: string[]) => {
        calls.push([name, ...args]);
        return result;
      };
    const api = {
      LMSInitialize: record(
        "LMSInitialize",
        mode === "rejected" ? "false" : "true",
      ),
      LMSFinish: record("LMSFinish", "true"),
      LMSGetValue: record("LMSGetValue", ""),
      LMSSetValue: record("LMSSetValue", "true"),
      LMSCommit: record("LMSCommit", "true"),
    };
    const top: any = { API: api };
    top.parent = top;
    const win: any = {
      parent: mode === "absent" ? null : top,
      opener: null,
      addEventListener: (
        name: string,
        fn: (event: { persisted: boolean }) => void,
      ) => {
        listeners[name] = fn;
      },
    };
    if (mode === "cross-origin")
      Object.defineProperty(win, "parent", {
        get() {
          throw new Error("Blocked by browser");
        },
      });
    vm.runInNewContext(await readFile("scorm/session.js", "utf8"), {
      window: win,
    });
    return { calls, listeners };
  };
  it("initialisiert nur einmal, erhält bfcache-Sitzungen und beendet ohne Get/Set/Commit", async () => {
    const { calls, listeners } = await run("normal");
    expect(calls).toEqual([["LMSInitialize", ""]]);
    expect(listeners.beforeunload).toBeUndefined();
    listeners.pagehide({ persisted: true });
    expect(calls).toEqual([["LMSInitialize", ""]]);
    listeners.pagehide({ persisted: false });
    listeners.pagehide({ persisted: false });
    expect(calls).toEqual([
      ["LMSInitialize", ""],
      ["LMSFinish", ""],
    ]);
  });
  for (const mode of ["absent", "rejected", "cross-origin"])
    it(`blockiert die Anwendung bei ${mode} API nicht`, async () => {
      const { calls, listeners } = await run(mode);
      listeners.pagehide({ persisted: false });
      expect(calls).toEqual(mode === "rejected" ? [["LMSInitialize", ""]] : []);
    });
});
