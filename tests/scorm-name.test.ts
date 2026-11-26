import { describe, expect, it } from "vitest";
import { scormName } from "../src/core/scorm-name";

describe("SCORM-Dateinamen", () => {
  it("benennt eine Sammlung, ein Niveau und eine Einzelaufgabe", () => {
    expect(scormName("Flüsse & Küsten", undefined, true)).toBe(
      "Flüsse_Küsten_SCORM_alle_Niveaus.zip",
    );
    expect(scormName("Flüsse & Küsten", "Überprüfung")).toBe(
      "Flüsse_Küsten_SCORM_Überprüfung.zip",
    );
    expect(scormName("  Du\u0308nen: / Küste? ")).toBe("Dünen_Küste_SCORM.zip");
  });
  it("entfernt nur wiederholte ganze Titel- und Niveaubestandteile", () => {
    for (const label of ["Küste – Basis", "Basis: Küste", "Basis"]) {
      expect(scormName("Küste", label)).toBe("Küste_SCORM_Basis.zip");
    }
    expect(scormName("Küste – Basis", "Basis")).toBe("Küste_SCORM_Basis.zip");
    expect(scormName("Küste", "Küste")).toBe("Küste_SCORM.zip");
    expect(scormName("Basiswissen", "Basis")).toBe(
      "Basiswissen_SCORM_Basis.zip",
    );
  });
  it("begrenzt lange Unicode-Dateinamen in Bytes", () => {
    const name = scormName("ä".repeat(100), "Ö".repeat(60));
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255);
    expect(name).toMatch(/^ä+_SCORM_Ö+\.zip$/u);
  });
});
