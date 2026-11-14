import { describe, expect, it } from "vitest";
import { Script } from "node:vm";
import { appendLicenseNotices } from "../scripts/check-build.mjs";

describe("Lizenzhinweise in eigenständigen Schüler-HTMLs", () => {
  it("erhält ausführbares JavaScript mit eingebettetem Druckdokument unverändert", () => {
    const javascript =
      "const printTemplate = `<!doctype html><html><body>Druck</body></html>`;";
    const source = `<!doctype html><html><head><script>${javascript}</script></head><body></body></html>\n`;
    const license =
      "Third-party notices\n```text\nLizenz -- unverändert im Kommentar\n```\n$&";
    const result = appendLicenseNotices(source, license);
    const embedded = result.match(/<script>([\s\S]*?)<\/script>/)![1];
    expect(embedded).toBe(javascript);
    expect(() => new Script(embedded)).not.toThrow();
    expect(result.indexOf("Third-party notices")).toBeGreaterThan(
      result.indexOf("</body>"),
    );
    expect(result).toContain("Lizenz - - unverändert im Kommentar");
    expect(result).toContain("$&");
    expect(result.endsWith("-->\n</html>\n")).toBe(true);
  });

  it("weist eine unvollständige Datei mit nur einem inneren HTML-Endtag zurück", () => {
    expect(() =>
      appendLicenseNotices(
        '<html><script>const print = "</html>";</script>',
        "Lizenz",
      ),
    ).toThrow("abschließenden Dokumenttag");
  });
});
