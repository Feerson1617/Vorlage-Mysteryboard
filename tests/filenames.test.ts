import { describe, it, expect } from "vitest";
import { backupFilename } from "../src/core/filenames";

describe("meaningful PNG filenames", () => {
  it("uses actual team and title, preserving German letters and spaces", () => {
    expect(
      backupFilename("Team Nordseeküste", "Ölkatastrophe Deepwater Horizon"),
    ).toBe("Team Nordseeküste_Ölkatastrophe Deepwater Horizon.png");
  });
  it("removes unsafe characters and invisible controls", () => {
    expect(backupFilename("  A/B:C\u0000\u202e  ", 'Öl? *<>"|\\test. ')).toBe(
      "ABC_Öl test.png",
    );
  });
  it("keeps very long Unicode names within a real filesystem byte limit", () => {
    const name = backupFilename("Ä🙂".repeat(80), "Ü🌍".repeat(150));
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(200);
    expect(name.endsWith(".png")).toBe(true);
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    expect(name.split("_")).toHaveLength(2);
  });
  it("normalizes combining accents", () => {
    expect(backupFilename("Ku\u0308ste", "Meer")).toBe("Küste_Meer.png");
  });
  it("rejects unusable names visibly instead of silently substituting a generic name", () => {
    expect(() => backupFilename("///", "Meer")).toThrow(/Teamnamen/);
    expect(() => backupFilename("Küste", "???")).toThrow(/Mystery-Titel/);
  });
});
