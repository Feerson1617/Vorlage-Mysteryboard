import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { MAX_PNG_BYTES, embedWork, restorePng } from "../src/core/png";
import { packWork } from "../src/core/codec";
import { initialWork, validateMystery } from "../src/core/model";
import smallData from "../src/content/small.json";
import largeData from "../src/content/large.json";
import { paddedPng } from "./fixtures/png";
const small = validateMystery(smallData),
  large = validateMystery(largeData);
// Several complete 30 MB CRC passes are CPU-bound; keep timing separate from byte-limit assertions.
describe("fertige Sicherungen an der PNG-Grenze", () => {
  it("weist eine gültige Eingangs-PNG knapp unter dem Limit zurück, wenn der Zustandsblock nicht mehr passt", () => {
    const png = paddedPng(MAX_PNG_BYTES - 1);
    expect(png.length).toBeLessThan(MAX_PNG_BYTES);
    expect(() => embedWork(png, initialWork(small))).toThrow(
      /einschließlich Arbeitsstand größer als 30 MB/,
    );
  }, 20_000);
  for (const mystery of [small, large])
    it(`${mystery.cards.length} Karten: exakt am Limit wiederherstellbar, bestehender Block wird ersetzt`, () => {
      const work = initialWork(mystery),
        extra = packWork(work).length + 12;
      const result = embedWork(paddedPng(MAX_PNG_BYTES - extra), work);
      expect(result.length).toBe(MAX_PNG_BYTES);
      expect(restorePng(result, mystery)).toEqual(work);
      const replaced = embedWork(result, work);
      expect(replaced.length).toBe(MAX_PNG_BYTES);
      expect(restorePng(replaced, mystery)).toEqual(work);
    }, 20_000);
});
it("HTML-Build verweigert die verbindliche Grenze von 10.000.000 Bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "mysteryboard-build-limit-"));
  try {
    mkdirSync(join(dir, "dist/small"), { recursive: true });
    symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
    writeFileSync(
      join(dir, "dist/small/index.html"),
      Buffer.alloc(10_000_000, 120),
    );
    const run = spawnSync(
      process.execPath,
      [resolve("scripts/check-build.mjs")],
      { cwd: dir, encoding: "utf8" },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Erlaubt sind weniger als 10.000.000 Bytes");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
