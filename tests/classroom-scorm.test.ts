import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { scormEntries, zipScorm } from "../src/core/scorm-package";
import { encodeDocument, taskDocument } from "../src/core/documents";
import { readLaunch, launchJSON } from "../src/core/launch-document";
import source from "../examples/universal/content.json";
const { embedTask } = await import(String("../scripts/embed-task.mjs"));

describe("Lokales Unterrichts-SCORM mit sicherer Aufgaben-Einbettung", () => {
  it("liest auch den formatierten leeren Platzhalter und akzeptiert ausschließlich Aufgaben", () => {
    try {
      vi.stubGlobal("document", {
        getElementById: () => ({ textContent: "\n  null\n" }),
      });
      expect(readLaunch()).toBeNull();
      const task = taskDocument(source);
      vi.stubGlobal("document", {
        getElementById: () => ({ textContent: launchJSON(task, true) }),
      });
      expect(readLaunch()).toEqual({ task, classroom: true });
      vi.stubGlobal("document", {
        getElementById: () => ({
          textContent: JSON.stringify({
            classroom: true,
            task: Buffer.from(
              encodeDocument({
                ...task,
                kind: "draft",
                author: {
                  initials: "AB",
                  status: "in-progress",
                  hiddenCards: [],
                },
              }),
            ).toString("base64"),
          }),
        }),
      });
      expect(() => readLaunch()).toThrow("nur freigegebene");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("verwendet exakt die bestehenden Wrapperbytes und kodiert XML-Sonderzeichen", () => {
    const launch = readFileSync("scorm/launch.html", "utf8"),
      session = readFileSync("scorm/session.js", "utf8"),
      app = new TextEncoder().encode(
        "<!doctype html><html><body>Ä</body></html>",
      );
    const entries = scormEntries(
      app,
      launch,
      session,
      "Mystery-test-1",
      "Ä & < > \" '",
    );
    const zip = zipScorm(entries),
      restored = unzipSync(zip);
    expect(zipScorm(entries)).toEqual(zip);
    expect(Object.keys(restored).sort()).toEqual([
      "app.html",
      "imsmanifest.xml",
      "launch.html",
      "session.js",
    ]);
    for (const [name, bytes] of Object.entries(entries))
      expect(restored[name]).toEqual(bytes);
    expect(new TextDecoder().decode(restored["imsmanifest.xml"])).toContain(
      "Ä &amp; &lt; &gt; &quot; &apos;",
    );
  });
  it("prüft die vollständigen HTML-Bytes einschließlich der eingebetteten Aufgabe", () => {
    expect(() =>
      scormEntries(new Uint8Array(9_999_999), "", "", "Test", "Titel"),
    ).not.toThrow();
    expect(() =>
      scormEntries(new Uint8Array(10_000_000), "", "", "Test", "Titel"),
    ).toThrow("10 MB");
    expect(() =>
      scormEntries(new Uint8Array(1), "", "", 'Test"/>', "Titel"),
    ).toThrow("Kennung");
  });
  it("ersetzt ausschließlich den echten JSON-Platzhalter und erhält JavaScript und Kartentext bytegenau", () => {
    const code =
      'const test = `</html><script id="mysteryboard-launch" type="application/json">null</script>`;';
    // Script source uses escaped closing tags as in production bundles.
    const safeCode = code.replaceAll("</script>", "<\\/script>");
    const template = `<!doctype html><html><head><script type="module">${safeCode}</script></head><body><div id="root"></div><script id="mysteryboard-launch" type="application/json">null</script></body></html>`;
    const task = taskDocument({
      ...source,
      title: 'Sicher </ScRiPt><img src="https://example.invalid">',
    });
    const result = embedTask(template, encodeDocument(task), true);
    expect(result).toContain(safeCode);
    expect(result).not.toContain(task.content.title);
    // Parse the actual inert node independently rather than interpreting HTML.
    const match =
      /<script id="mysteryboard-launch" type="application\/json">({[^<]+})<\/script>/.exec(
        result,
      )!;
    expect(match).toBeTruthy();
    const bootstrap = JSON.parse(match[1]);
    expect(bootstrap.classroom).toBe(true);
    expect(Buffer.from(bootstrap.task, "base64")).toEqual(
      Buffer.from(encodeDocument(task)),
    );
    expect(() => embedTask("<html></html>", encodeDocument(task))).toThrow(
      "Genau eine",
    );
    expect(() =>
      embedTask(
        template.replace(
          "</body>",
          '<script id="mysteryboard-launch" type="application/json">null</script></body>',
        ),
        encodeDocument(task),
      ),
    ).toThrow("Genau eine");
  });
});
