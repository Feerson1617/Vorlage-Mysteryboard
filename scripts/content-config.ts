import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMystery } from "../src/core/model.ts";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export type BuildTarget = {
  key: string;
  content: string;
  output: string;
  testOnly: boolean;
};
export function loadBuildTargets(
  path = resolve(projectRoot, "mysteries.json"),
): BuildTarget[] {
  const config: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Ungültige Mystery-Build-Konfiguration.");
  const outputs = new Set<string>();
  const entries = Object.entries(config);
  if (!entries.length) throw new Error("Die Build-Konfiguration ist leer.");
  return entries.map(([key, raw]) => {
    if (
      !/^[a-z][a-z0-9-]*$/.test(key) ||
      ["development", "production", "test"].includes(key) ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      throw new Error(`Ungültiger Build-Eintrag: ${key}.`);
    const value = raw as Record<string, unknown>;
    if (
      Object.keys(value).some(
        (k) => !["content", "output", "testOnly"].includes(k),
      ) ||
      typeof value.content !== "string" ||
      !value.content.endsWith(".json") ||
      isAbsolute(value.content) ||
      relative(projectRoot, resolve(projectRoot, value.content)).startsWith(
        "..",
      ) ||
      typeof value.output !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]*\.html$/.test(value.output) ||
      (value.testOnly !== undefined && typeof value.testOnly !== "boolean")
    )
      throw new Error(`Ungültige Inhaltsdatei oder HTML-Ausgabe: ${key}.`);
    const output = `${value.testOnly ? "tests/" : ""}${value.output}`;
    if (outputs.has(output))
      throw new Error(`Doppelte HTML-Ausgabe: ${output}.`);
    outputs.add(output);
    return {
      key,
      content: value.content,
      output: value.output,
      testOnly: value.testOnly === true,
    };
  });
}
export function selectBuildTargets(
  names: string[] = [],
  targets = loadBuildTargets(),
): BuildTarget[] {
  if (!names.length) return targets.filter((t) => !t.testOnly);
  if (names.length === 1 && names[0] === "--tests")
    return targets.filter((t) => t.testOnly);
  return names.map((name) => {
    const target = targets.find((t) => t.key === name);
    if (!target)
      throw new Error(
        `Unbekanntes Mystery „${name}“. Verfügbare Builds: ${targets.map((t) => t.key).join(", ")}.`,
      );
    return target;
  });
}
export function targetForMode(mode: string): BuildTarget {
  const name = ["development", "production", "test"].includes(mode)
    ? "small"
    : mode;
  return selectBuildTargets([name])[0];
}

// Check the complete registry even for a single requested build. Otherwise two
// different student files could share an identity and accept each other's PNGs.
export function validateBuildContents(
  targets = loadBuildTargets(),
  root = projectRoot,
): void {
  const identities = new Map<string, string>();
  for (const target of targets) {
    const mystery = validateMystery(
      JSON.parse(readFileSync(resolve(root, target.content), "utf8")),
    );
    const identity = `${mystery.id}\u0000${mystery.version}`;
    const previous = identities.get(identity);
    if (previous)
      throw new Error(
        `Mehrere Inhalte verwenden dieselbe Mystery-ID und Inhaltsversion: ${previous} und ${target.key} (${mystery.id} ${mystery.version}).`,
      );
    identities.set(identity, target.key);
  }
}
