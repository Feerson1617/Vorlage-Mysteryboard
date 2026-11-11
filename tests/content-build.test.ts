import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadBuildTargets,
  selectBuildTargets,
  targetForMode,
  validateBuildContents,
} from "../scripts/content-config";
import { cardNumber, validateMystery } from "../src/core/model";
import soilData from "../src/content/boden-klasse11.json";
import reuseData from "./fixtures/reusable-five.json";
import source from "./fixtures/boden-source-fingerprint.json";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("Inhalte und wiederverwendbarer Build", () => {
  it("übernimmt alle 18 geprüften Boden-Karten sowie die Startanordnung unverändert", () => {
    const mystery = validateMystery(soilData);
    const cardsWithoutNewMetadata = mystery.cards.map(
      ({ group: _group, ...card }) => card,
    );
    expect(digest(cardsWithoutNewMetadata)).toBe(source.canonicalCardsSha256);
    expect(digest(mystery.initial)).toBe(source.canonicalInitialSha256);
    expect({
      id: mystery.id,
      version: mystery.version,
      title: mystery.title,
    }).toEqual(source.identity);
    expect(mystery.cards).toHaveLength(18);
    expect(mystery.initial.edges).toEqual([]);
    expect(mystery.initial.categories).toEqual(Array(6).fill(""));
    expect(mystery.initial.cards.every((c) => c.color === 0)).toBe(true);
    for (const mapping of source.explicitMapping) {
      expect(cardNumber(mystery, mapping.id)).toBe(mapping.anzeige);
      const card = mystery.cards.find((c) => c.id === mapping.id)!;
      expect(mystery.cardGroups![card.group!].label).toBe(
        mapping.arbeitsumfang,
      );
    }
  });
  it("unterstützt andere Anzahl und nicht zusammenhängende Vertiefungs-IDs aus Metadaten", () => {
    const mystery = validateMystery(reuseData);
    expect(mystery.cards.map((c) => cardNumber(mystery, c.id))).toEqual([
      "1",
      "Z2",
      "3",
      "4",
      "Z5",
    ]);
    expect(mystery.initial.edges).toEqual([]);
    expect(mystery.cards).toHaveLength(5);
  });
  it("erhält die vorhandenen Varianten und trennt auch zusätzliche Testinhalte", () => {
    const registry = loadBuildTargets(),
      production = selectBuildTargets([], registry),
      verification = selectBuildTargets(["--tests"], registry);
    expect(production.map((t) => t.output)).toEqual(
      expect.arrayContaining([
        "MysteryBoard-klein.html",
        "MysteryBoard-umfangreich.html",
        "MysteryBoard-Boden-Klasse11.html",
      ]),
    );
    expect(verification.map((t) => t.key)).toEqual(
      expect.arrayContaining(["review", "reuse-example"]),
    );
    expect(production.every((t) => !t.testOnly)).toBe(true);
    expect(verification.every((t) => t.testOnly)).toBe(true);
    expect([...production, ...verification].map((t) => t.key).sort()).toEqual(
      registry.map((t) => t.key).sort(),
    );
    for (const target of registry) {
      expect(() =>
        validateMystery(JSON.parse(readFileSync(target.content, "utf8"))),
      ).not.toThrow();
    }
  });
  it("wählt neue Inhalte ausschließlich per Konfiguration und weist unbekannte Modi zurück", () => {
    const neutral = selectBuildTargets(["reuse-example"])[0];
    expect(neutral.content).toBe("tests/fixtures/reusable-five.json");
    expect(targetForMode("boden-klasse11").content).toBe(
      "src/content/boden-klasse11.json",
    );
    expect(() => targetForMode("nicht-eingerichtet")).toThrow(
      /Unbekanntes Mystery/,
    );
    expect(targetForMode("development").key).toBe("small");
  });
  it("ein zusätzlicher Registry-Eintrag genügt, ohne Änderung an Anwendung oder UI", () => {
    const dir = mkdtempSync(join(tmpdir(), "mysteryboard-registry-"));
    try {
      const path = join(dir, "mysteries.json");
      writeFileSync(
        path,
        JSON.stringify({
          "zukunft-7": {
            content: "src/content/zukunft-7.json",
            output: "MysteryBoard-Zukunft7.html",
          },
        }),
      );
      const selected = selectBuildTargets(
        ["zukunft-7"],
        loadBuildTargets(path),
      );
      expect(selected).toEqual([
        {
          key: "zukunft-7",
          content: "src/content/zukunft-7.json",
          output: "MysteryBoard-Zukunft7.html",
          testOnly: false,
        },
      ]);
      writeFileSync(
        path,
        JSON.stringify({ a: { content: "../fremd.json", output: "A.html" } }),
      );
      expect(() => loadBuildTargets(path)).toThrow(/Ungültige Inhaltsdatei/);
      writeFileSync(
        path,
        JSON.stringify({
          a: { content: "src/content/small.json", output: "A.html" },
          b: { content: "src/content/large.json", output: "A.html" },
        }),
      );
      expect(() => loadBuildTargets(path)).toThrow(/Doppelte HTML-Ausgabe/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

it("reserviert Vite-Standardmodi und verhindert Identitätskollisionen auch bei Einzelbuilds", () => {
  const dir = mkdtempSync(join(tmpdir(), "mysteryboard-identity-"));
  try {
    const config = join(dir, "mysteries.json");
    for (const key of ["development", "production", "test"]) {
      writeFileSync(
        config,
        JSON.stringify({
          [key]: { content: "first.json", output: "First.html" },
        }),
      );
      expect(() => loadBuildTargets(config)).toThrow(
        /Ungültiger Build-Eintrag/,
      );
    }
    writeFileSync(
      config,
      JSON.stringify({
        first: { content: "first.json", output: "First.html" },
        second: { content: "second.json", output: "Second.html" },
      }),
    );
    writeFileSync(join(dir, "first.json"), JSON.stringify(reuseData));
    writeFileSync(
      join(dir, "second.json"),
      JSON.stringify({
        ...reuseData,
        title: "Anderer Inhalt unter versehentlich derselben Identität",
      }),
    );
    const registry = loadBuildTargets(config);
    expect(selectBuildTargets(["second"], registry)).toHaveLength(1);
    expect(() => validateBuildContents(registry, dir)).toThrow(
      /dieselbe Mystery-ID und Inhaltsversion/,
    );
    writeFileSync(
      join(dir, "second.json"),
      JSON.stringify({ ...reuseData, id: "ein-eigenes-mystery" }),
    );
    expect(() => validateBuildContents(registry, dir)).not.toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
