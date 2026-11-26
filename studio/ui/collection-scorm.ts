import {scormName} from "./scorm-name";
import { publishDraft } from "../../src/core/authoring";
import { encodeDocument, type Task } from "../../src/core/documents";
import { launchJSON } from "../../src/core/launch-document";
import {
  validateCollection,
  COLLECTION_BYTES,
  type Collection,
} from "../../src/core/levels";
import { scormEntries, zipScorm } from "../../src/core/scorm-package";
import { importLevels, type ImportedProject } from "../exchange/import";
import { resourceName, singleResource } from "../player/resources";
import type { Catalogue } from "../player/recovery";

const encoder = new TextEncoder();
type Player = [template: string, launch: string, session: string];
type Entries = Record<string, Uint8Array>;
function levelInfo(
  task: Task,
  id = task.content.id,
  name = task.content.title,
  description = "",
) {
  return {
    id,
    name,
    description,
    hash: task.contentHash,
    version: task.content.version,
    mode: task.content.recovery ?? ("off" as const),
  };
}
function externalEntries(
  c: Catalogue,
  files: Entries,
  identifier: string,
  [template, launch, session]: Player,
) {
  const json = JSON.stringify(c).replaceAll("<", "\\u003c");
  const end = template.lastIndexOf("</body>");
  if (end < 0) throw Error("Der geprüfte Schülerplayer fehlt.");
  const html =
    template.slice(0, end) +
    '<script id="mysteryboard-levels" type="application/json">' +
    json +
    "</script>" +
    template.slice(end);
  const entries = scormEntries(
    encoder.encode(html),
    launch,
    session,
    identifier,
    c.title,
  );
  const manifest = new TextDecoder().decode(entries["imsmanifest.xml"]).replace(
    "</resource>",
    Object.keys(files)
      .map((name) => '<file href="' + name + '"/>')
      .join("") + "</resource>",
  );
  entries["imsmanifest.xml"] = encoder.encode(manifest);
  return { ...entries, ...files };
}
export function singleEntries(task: Task, ...player: Player): Entries {
  const [template, launch, session] = player;
  const marker =
    /(<script\s+id="mysteryboard-launch"\s+type="application\/json">)\s*null\s*(<\/script>)/g;
  const matches = [...template.matchAll(marker)];
  if (matches.length !== 1) throw Error("Der geprüfte Schülerplayer fehlt.");
  const data = encodeDocument(task);
  const identifier =
    "MysteryBoard-" + task.content.id + "-" + task.content.version;
  const empty = template.replace(marker, '$1{"classroom":true,"task":""}$2');
  if (
    encoder.encode(empty).length + 4 * Math.ceil(data.length / 3) <
    10_000_000
  ) {
    const html = template.replace(
      marker,
      (_, open, close) => open + launchJSON(task, true, data) + close,
    );
    return scormEntries(
      encoder.encode(html),
      launch,
      session,
      identifier,
      task.content.title,
    );
  }
  const c: Catalogue = {
    resource: singleResource,
    id: task.content.id,
    title: task.content.title,
    levels: [levelInfo(task)],
  };
  return externalEntries(c, { [singleResource]: data }, identifier, player);
}
export function collectionEntries(c: Collection, ...player: Player): Entries {
  validateCollection(c);
  const catalogue: Catalogue = { id: c.id, title: c.title, levels: [] };
  const files: Entries = {};
  let total = 0;
  for (const l of c.levels) {
    const task = publishDraft(l.draft);
    const data = encodeDocument(task);
    if ((total += data.length) > COLLECTION_BYTES)
      throw Error("Die Aufgaben überschreiten zusammen 60 MB.");
    const info = levelInfo(task, l.id, l.name, l.description);
    catalogue.levels.push(info);
    files[resourceName(catalogue, info)] = data;
  }
  return externalEntries(catalogue, files, "MysteryBoard-" + c.id, player);
}
export function collectionScorm(c: Collection, ...player: Player) {
  return new File(
    [new Uint8Array(zipScorm(collectionEntries(c, ...player)))],
    scormName(c.title,undefined,true),
    { type: "application/zip" },
  );
}
export function exportIssues(project: ImportedProject, ...player: Player) {
  const issues: string[] = [];
  for (const { name, draft } of importLevels(project)) {
    try {
      singleEntries(publishDraft(draft), ...player);
    } catch (e) {
      const allHidden = draft.content.cards.every((c) =>
        draft.author.hiddenCards.includes(c.id),
      );
      issues.push(
        name +
          " – " +
          (allHidden
            ? "author.hiddenCards: Mindestens eine Schülerkarte muss sichtbar bleiben."
            : (e as Error).message),
      );
    }
  }
  if (
    !issues.length &&
    project.format === "MysteryBoardCollection" &&
    project.levels.length > 1
  ) {
    try {
      collectionEntries(project, ...player);
    } catch (e) {
      issues.push(project.title + " – " + (e as Error).message);
    }
  }
  return issues;
}
