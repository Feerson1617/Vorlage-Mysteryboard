import { readDocument, type Task } from "../../src/core/documents";
import type { Catalogue, LevelInfo } from "./recovery";

export const singleResource = "task.json";
export function resourceName(c: Catalogue, l: LevelInfo) {
  return c.resource === singleResource
    ? singleResource
    : "level-" + l.id + ".json";
}
export function readCatalogue(json: string): Catalogue {
  const c: Catalogue = JSON.parse(json);
  if (
    !c ||
    typeof c.id !== "string" ||
    !c.id ||
    !Array.isArray(c.levels) ||
    !c.levels.length ||
    c.levels.length > 12 ||
    (c.resource !== undefined &&
      (c.resource !== singleResource || c.levels.length !== 1)) ||
    new Set(c.levels.map((l) => l.id)).size !== c.levels.length ||
    c.levels.some(
      (l) =>
        (c.resource ? l.id !== c.id : !/^[a-f0-9-]{36}$/.test(l.id)) ||
        !/^[a-f0-9]{64}$/.test(l.hash) ||
        typeof l.version !== "string" ||
        !["off", "session", "extended"].includes(l.mode),
    )
  )
    throw Error("Ungültiges Aufgabenverzeichnis.");
  return c;
}
export function readResource(
  bytes: Uint8Array,
  c: Catalogue,
  l: LevelInfo,
): Task {
  const task = readDocument(bytes);
  if (
    task.kind !== "task" ||
    task.content.id !== (c.resource ? c.id : c.id + "." + l.id) ||
    task.contentHash !== l.hash ||
    task.content.version !== l.version ||
    (task.content.recovery ?? "off") !== l.mode
  )
    throw Error("Die Aufgabendatei passt nicht zum Aufgabenverzeichnis.");
  return task;
}
